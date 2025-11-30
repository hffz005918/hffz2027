// super-storage.js - 超强健壮的存储管理器
class SuperStorage {
    constructor() {
        this.serverFile = 'server-fixed.php';
        this.maxRetries = 3;
    }

    // 清理响应文本，移除任何非JSON内容
    cleanResponse(text) {
        // 移除BOM头
        text = text.replace(/^\uFEFF/, '');
        
        // 查找第一个 { 和最后一个 }
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        
        if (start === -1 || end === -1) {
            throw new Error('响应中没有找到JSON数据');
        }
        
        return text.substring(start, end + 1);
    }

    async request(params = {}, retryCount = 0) {
        try {
            // 构建URL
            const urlParams = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null) {
                    urlParams.append(key, value.toString());
                }
            }
            
            const url = `${this.serverFile}?${urlParams.toString()}&_t=${Date.now()}`;
            console.log('🔍 请求URL:', url);

            // 发送请求
            const response = await fetch(url);
            const rawText = await response.text();
            
            console.log('📨 原始响应:', rawText.substring(0, 200) + '...');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // 清理响应
            const cleanText = this.cleanResponse(rawText);
            console.log('🧹 清理后:', cleanText);

            // 解析JSON
            let data;
            try {
                data = JSON.parse(cleanText);
            } catch (parseError) {
                console.error('❌ JSON解析失败:', parseError);
                console.error('原始文本:', rawText);
                throw new Error('服务器返回了无效的JSON数据');
            }

            if (!data.success) {
                throw new Error(data.error || '操作失败');
            }

            return data;

        } catch (error) {
            console.error(`❌ 请求失败 (尝试 ${retryCount + 1}/${this.maxRetries}):`, error.message);
            
            // 重试逻辑
            if (retryCount < this.maxRetries - 1) {
                console.log(`🔄 第 ${retryCount + 1} 次重试...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return this.request(params, retryCount + 1);
            }
            
            throw error;
        }
    }

    async getFeedbacks() {
        try {
            const result = await this.request({ action: 'get_all' });
            return Array.isArray(result.data) ? result.data : [];
        } catch (error) {
            console.error('获取反馈失败:', error);
            // 返回空数组而不是抛出错误
            return [];
        }
    }

    async saveFeedback(feedbackData) {
        try {
            const encodedData = encodeURIComponent(JSON.stringify(feedbackData));
            const result = await this.request({
                action: 'save_feedback',
                data: encodedData
            });
            
            return {
                success: true,
                id: result.id,
                message: result.message || '保存成功'
            };
        } catch (error) {
            console.error('保存反馈失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async updateFeedbackStatus(feedbackId, status) {
        try {
            await this.request({
                action: 'update_status',
                id: feedbackId,
                status: status
            });
            return { success: true };
        } catch (error) {
            console.error('更新状态失败:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteFeedback(feedbackId) {
        try {
            await this.request({
                action: 'delete_feedback',
                id: feedbackId
            });
            return { success: true };
        } catch (error) {
            console.error('删除失败:', error);
            return { success: false, error: error.message };
        }
    }

    async testConnection() {
        try {
            const result = await this.request({ action: 'test' });
            return {
                success: true,
                message: result.message || '连接正常',
                serverInfo: result
            };
        } catch (error) {
            console.error('连接测试失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}