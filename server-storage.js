// server-storage.js - 支持 GET 和 POST 的服务器存储管理器
class ServerStorage {
    constructor() {
        this.serverURL = 'server.php';
        this.debug = true;
    }

    log(message) {
        if (this.debug) {
            console.log('🔍 ServerStorage:', message);
        }
    }

    async request(data = {}) {
        try {
            this.log(`发送请求: ${JSON.stringify(data)}`);
            
            const action = data.action || 'get_all';
            
            // 对于获取数据使用 GET 请求，对于修改数据使用 POST 请求
            const useGet = action === 'get_all';
            
            let url = this.serverURL;
            let options = {
                method: useGet ? 'GET' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            };
            
            if (useGet) {
                // GET 请求通过 URL 参数传递
                const params = new URLSearchParams();
                params.append('action', action);
                url += '?' + params.toString();
            } else {
                // POST 请求通过 body 传递
                options.body = JSON.stringify(data);
            }
            
            this.log(`请求URL: ${url}, 方法: ${options.method}`);
            
            const response = await fetch(url, options);

            this.log(`响应状态: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                let errorDetail = '';
                try {
                    const errorResponse = await response.text();
                    errorDetail = errorResponse;
                } catch (e) {
                    errorDetail = '无法读取错误详情';
                }
                
                throw new Error(`服务器错误: ${response.status} ${response.statusText} - ${errorDetail}`);
            }

            const resultText = await response.text();
            this.log(`原始响应: ${resultText}`);
            
            let result;
            try {
                result = JSON.parse(resultText);
            } catch (parseError) {
                throw new Error(`响应JSON解析失败: ${parseError.message} - 原始响应: ${resultText}`);
            }
            
            this.log(`解析后的响应: ${JSON.stringify(result)}`);
            
            if (!result.success) {
                throw new Error(result.error || '服务器返回错误');
            }

            return result;
        } catch (error) {
            this.log(`❌ 请求失败: ${error.message}`);
            throw error;
        }
    }

    // 获取所有反馈 - 使用 GET
    async getFeedbacks() {
        try {
            this.log('从服务器获取反馈数据...');
            
            const result = await this.request({
                action: 'get_all'
            });

            this.log(`获取到 ${result.data.length} 条反馈`);
            return Array.isArray(result.data) ? result.data : [];
        } catch (error) {
            this.log(`❌ 获取数据失败: ${error.message}`);
            throw error;
        }
    }

    // 保存反馈 - 使用 POST
    async saveFeedback(feedbackData) {
        try {
            this.log('保存反馈到服务器...');
            
            const result = await this.request({
                action: 'save_feedback',
                feedback: feedbackData
            });

            this.log('✅ 反馈保存成功');
            return { 
                success: true, 
                id: result.id,
                message: result.message
            };
        } catch (error) {
            this.log(`❌ 保存失败: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // 其他方法保持不变...
    async addComment(feedbackId, commentData) {
        try {
            const result = await this.request({
                action: 'add_comment',
                feedbackId: feedbackId,
                comment: commentData
            });

            return { success: true, commentId: result.commentId };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateFeedbackStatus(feedbackId, status) {
        try {
            await this.request({
                action: 'update_status',
                feedbackId: feedbackId,
                status: status
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteFeedback(feedbackId) {
        try {
            await this.request({
                action: 'delete_feedback',
                feedbackId: feedbackId
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async likeFeedback(feedbackId, userId) {
        try {
            await this.request({
                action: 'like_feedback',
                feedbackId: feedbackId,
                userId: userId
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}