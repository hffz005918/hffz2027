// simple-storage.js - 简化的存储管理器
class SimpleStorage {
    constructor() {
        this.serverURL = 'server-get.php';
    }

    async request(params = {}) {
        try {
            // 构建URL参数
            const urlParams = new URLSearchParams();
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    urlParams.append(key, params[key]);
                }
            });

            const url = `${this.serverURL}?${urlParams.toString()}`;
            console.log('请求URL:', url);

            const response = await fetch(url);
            const text = await response.text();
            
            console.log('服务器响应:', text);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // 尝试解析JSON
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('JSON解析失败:', e);
                console.error('原始响应:', text);
                throw new Error('服务器返回了无效的JSON数据');
            }

            if (!data.success) {
                throw new Error(data.error || '操作失败');
            }

            return data;
        } catch (error) {
            console.error('请求失败:', error);
            throw error;
        }
    }

    // 获取所有反馈
    async getFeedbacks() {
        const result = await this.request({ action: 'get_all' });
        return result.data || [];
    }

    // 保存反馈
    async saveFeedback(feedbackData) {
        // 将数据编码为JSON字符串
        const encodedData = encodeURIComponent(JSON.stringify(feedbackData));
        const result = await this.request({
            action: 'save_feedback',
            data: encodedData
        });
        
        return {
            success: true,
            id: result.id,
            message: result.message
        };
    }

    // 更新状态
    async updateFeedbackStatus(feedbackId, status) {
        await this.request({
            action: 'update_status',
            id: feedbackId,
            status: status
        });
        return { success: true };
    }

    // 删除反馈
    async deleteFeedback(feedbackId) {
        await this.request({
            action: 'delete_feedback',
            id: feedbackId
        });
        return { success: true };
    }

    // 测试连接
    async testConnection() {
        const result = await this.request({ action: 'test' });
        return { 
            success: true, 
            message: result.message 
        };
    }
}