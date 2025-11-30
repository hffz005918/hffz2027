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
            const response = await fetch(this.serverURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`服务器错误: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '服务器返回错误');
            }

            return result;
        } catch (error) {
            this.log(`请求失败: ${error.message}`);
            throw error;
        }
    }

    // 保存反馈
    async saveFeedback(feedbackData) {
        try {
            this.log('保存反馈到服务器...');
            
            // 确保有ID和时间戳
            if (!feedbackData.id) {
                feedbackData.id = 'feedback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }
            if (!feedbackData.timestamp) {
                feedbackData.timestamp = new Date().toISOString();
            }
            
            const result = await this.request({
                action: 'save',
                feedback: feedbackData
            });

            this.log('✅ 反馈保存成功');
            return { 
                success: true, 
                id: feedbackData.id
            };
        } catch (error) {
            this.log(`❌ 保存失败: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // 获取所有反馈
    async getFeedbacks() {
        try {
            this.log('从服务器获取反馈数据...');
            
            const result = await this.request({
                action: 'get'
            });

            this.log(`获取到 ${result.data.length} 条反馈`);
            return Array.isArray(result.data) ? result.data : [];
        } catch (error) {
            this.log(`❌ 获取数据失败: ${error.message}`);
            return [];
        }
    }

    // 添加评论
    async addComment(feedbackId, commentData) {
        try {
            const result = await this.request({
                action: 'add_comment',
                feedbackId: feedbackId,
                comment: commentData
            });

            return { success: true, commentId: commentData.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 更新反馈状态
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

    // 删除反馈
    async deleteFeedback(feedbackId) {
        try {
            await this.request({
                action: 'delete',
                feedbackId: feedbackId
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 点赞反馈
    async likeFeedback(feedbackId, userId) {
        try {
            await this.request({
                action: 'like',
                feedbackId: feedbackId,
                userId: userId
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}