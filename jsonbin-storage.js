// jsonbin-storage-simple.js - 修复删除和状态更新功能
class JsonBinStorage {
    constructor() {
        // 🔧 第一步：先运行上面的 createAndSetupNewBin() 获取新的Bin ID
        // 然后用那个新ID替换下面的值
        this.binId = '69304a8bd0ea881f401049f7'; // ← 替换这里！
        
        // 如果binId还是默认值，提示用户
        if (this.binId === '69304a8bd0ea881f401049f7') {
            console.error(`
            ❌ 请先设置正确的Bin ID！
            
            运行步骤：
            1. 在控制台运行 createAndSetupNewBin()
            2. 复制返回的新Bin ID
            3. 替换第5行的 binId 值
            4. 刷新页面
            `);
        }
        
        // API Keys
        this.readOnlyKey = '$2a$10$AOxCSd1PIW2XUkxQvRpVVeimltcnLXIoOlqvBvFJwlxCihUD2wope';
        this.masterKey = '$2a$10$AOxCSd1PIW2XUkxQvRpVVeimltcnLXIoOlqvBvFJwlxCihUD2wope';
        
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        
        console.log('🔄 JSONBin存储初始化，Bin ID:', this.binId);
    }
    
    /**
     * 测试连接
     */
    async testConnection() {
        if (this.binId.includes('这里放你的新BinID')) {
            return {
                connected: false,
                message: '❌ 请先设置正确的Bin ID'
            };
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (response.status === 404) {
                return {
                    connected: false,
                    message: `❌ Bin ${this.binId} 不存在，请创建新Bin`
                };
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const count = data.record?.feedbacks?.length || 0;
            
            return {
                connected: true,
                message: `✅ 连接成功 (${count}条反馈)`,
                binId: this.binId,
                feedbackCount: count
            };
            
        } catch (error) {
            return {
                connected: false,
                message: `❌ 连接失败: ${error.message}`,
                binId: this.binId
            };
        }
    }
    
    /**
     * 获取所有反馈
     */
    async getFeedbacks() {
        try {
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) {
                console.warn('获取失败，返回空数组');
                return [];
            }
            
            const data = await response.json();
            const feedbacks = data.record?.feedbacks || [];
            
            // 确保每个反馈都有必要的数组
            feedbacks.forEach(feedback => {
                if (!feedback.comments) {
                    feedback.comments = [];
                }
                if (!feedback.likes) {
                    feedback.likes = {
                        count: 0,
                        users: []
                    };
                }
                
                // 确保每个评论都有点赞数据
                if (feedback.comments) {
                    feedback.comments.forEach(comment => {
                        if (!comment.likes) {
                            comment.likes = {
                                count: 0,
                                users: []
                            };
                        }
                    });
                }
            });
            
            return feedbacks;
            
        } catch (error) {
            console.error('获取反馈失败:', error);
            return [];
        }
    }
    
    /**
     * 保存反馈
     */
    async saveFeedback(feedbackData) {
        try {
            // 1. 获取当前数据
            const getResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!getResponse.ok) {
                throw new Error('获取当前数据失败');
            }
            
            const getData = await getResponse.json();
            const record = getData.record;
            
            // 2. 创建新反馈
            const newFeedback = {
                id: 'fb_' + Date.now(),
                employeeName: feedbackData.employeeName || '匿名员工',
                type: feedbackData.type,
                content: feedbackData.content,
                images: feedbackData.images || [],
                status: 'pending',
                comments: [], // 初始化评论数组
                likes: {      // 初始化点赞数据
                    count: 0,
                    users: []
                },
                timestamp: new Date().toISOString()
            };
            
            // 3. 添加到数组
            record.feedbacks.push(newFeedback);
            
            // 4. 更新统计
            record.stats.total = record.feedbacks.length;
            record.stats.pending = record.feedbacks.filter(f => f.status === 'pending').length;
            record.system.lastUpdated = new Date().toISOString();
            
            // 5. 保存回云端
            const saveResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!saveResponse.ok) {
                throw new Error('保存失败: ' + saveResponse.status);
            }
            
            console.log('✅ 反馈保存成功:', newFeedback.id);
            
            return {
                success: true,
                id: newFeedback.id,
                message: '反馈已成功保存到云端',
                binId: this.binId
            };
            
        } catch (error) {
            console.error('保存失败:', error);
            return {
                success: false,
                message: '保存失败: ' + error.message
            };
        }
    }
    
    /**
     * 添加评论到反馈
     */
    async addComment(feedbackId, commentData) {
        try {
            console.log(`🔄 正在添加评论到反馈 ${feedbackId}:`, commentData);
            
            // 1. 获取当前数据
            const getResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!getResponse.ok) {
                throw new Error('获取当前数据失败');
            }
            
            const getData = await getResponse.json();
            const record = getData.record;
            
            // 2. 查找目标反馈
            const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
            
            if (feedbackIndex === -1) {
                throw new Error('未找到对应的反馈');
            }
            
            // 3. 确保评论数组存在
            if (!record.feedbacks[feedbackIndex].comments) {
                record.feedbacks[feedbackIndex].comments = [];
            }
            
            // 4. 创建新评论
            const newComment = {
                id: 'cm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                author: commentData.author || '匿名同事',
                content: commentData.content,
                timestamp: new Date().toISOString(),
                likes: {  // 初始化评论点赞数据
                    count: 0,
                    users: []
                }
            };
            
            // 5. 添加到评论数组
            record.feedbacks[feedbackIndex].comments.push(newComment);
            
            // 6. 更新统计和时间戳
            record.system.lastUpdated = new Date().toISOString();
            
            // 7. 保存回云端
            const saveResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!saveResponse.ok) {
                throw new Error('保存评论失败: ' + saveResponse.status);
            }
            
            console.log('✅ 评论添加成功:', newComment.id);
            
            return {
                success: true,
                message: '评论已成功添加',
                binId: this.binId,
                updatedFeedback: record.feedbacks[feedbackIndex],
                newComment: newComment
            };
            
        } catch (error) {
            console.error('添加评论失败:', error);
            return {
                success: false,
                message: '添加评论失败: ' + error.message
            };
        }
    }
    
    /**
     * 点赞/取消点赞反馈
     */
    async toggleLike(feedbackId, userId = 'anonymous') {
        try {
            console.log(`🔄 处理点赞: 反馈 ${feedbackId}, 用户 ${userId}`);
            
            // 1. 获取当前数据
            const getResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!getResponse.ok) {
                throw new Error('获取当前数据失败');
            }
            
            const getData = await getResponse.json();
            const record = getData.record;
            
            // 2. 查找目标反馈
            const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
            
            if (feedbackIndex === -1) {
                throw new Error('未找到对应的反馈');
            }
            
            // 3. 确保点赞数据结构存在
            const feedback = record.feedbacks[feedbackIndex];
            if (!feedback.likes) {
                feedback.likes = {
                    count: 0,
                    users: []
                };
            }
            
            // 4. 检查用户是否已经点赞
            const userIndex = feedback.likes.users.indexOf(userId);
            let action = '';
            
            if (userIndex === -1) {
                // 用户未点赞，添加点赞
                feedback.likes.users.push(userId);
                feedback.likes.count++;
                action = 'liked';
            } else {
                // 用户已点赞，取消点赞
                feedback.likes.users.splice(userIndex, 1);
                feedback.likes.count--;
                action = 'unliked';
            }
            
            // 5. 更新时间戳
            record.system.lastUpdated = new Date().toISOString();
            
            // 6. 保存回云端
            const saveResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!saveResponse.ok) {
                throw new Error('保存点赞失败: ' + saveResponse.status);
            }
            
            console.log(`✅ 点赞操作成功: ${action}, 当前点赞数: ${feedback.likes.count}`);
            
            return {
                success: true,
                message: `已${action === 'liked' ? '点赞' : '取消点赞'}`,
                action: action,
                likesCount: feedback.likes.count,
                isLiked: action === 'liked',
                binId: this.binId
            };
            
        } catch (error) {
            console.error('点赞操作失败:', error);
            return {
                success: false,
                message: '点赞操作失败: ' + error.message
            };
        }
    }
    
    /**
     * 点赞/取消点赞评论
     */
    async toggleCommentLike(feedbackId, commentId, userId = 'anonymous') {
        try {
            console.log(`🔄 处理评论点赞: 反馈 ${feedbackId}, 评论 ${commentId}, 用户 ${userId}`);
            
            // 1. 获取当前数据
            const getResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!getResponse.ok) {
                throw new Error('获取当前数据失败');
            }
            
            const getData = await getResponse.json();
            const record = getData.record;
            
            // 2. 查找目标反馈
            const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
            
            if (feedbackIndex === -1) {
                throw new Error('未找到对应的反馈');
            }
            
            const feedback = record.feedbacks[feedbackIndex];
            
            // 3. 查找目标评论
            const commentIndex = feedback.comments.findIndex(c => c.id === commentId);
            
            if (commentIndex === -1) {
                throw new Error('未找到对应的评论');
            }
            
            const comment = feedback.comments[commentIndex];
            
            // 4. 确保点赞数据结构存在
            if (!comment.likes) {
                comment.likes = {
                    count: 0,
                    users: []
                };
            }
            
            // 5. 检查用户是否已经点赞
            const userIndex = comment.likes.users.indexOf(userId);
            let action = '';
            
            if (userIndex === -1) {
                // 用户未点赞，添加点赞
                comment.likes.users.push(userId);
                comment.likes.count++;
                action = 'liked';
            } else {
                // 用户已点赞，取消点赞
                comment.likes.users.splice(userIndex, 1);
                comment.likes.count--;
                action = 'unliked';
            }
            
            // 6. 更新时间戳
            record.system.lastUpdated = new Date().toISOString();
            
            // 7. 保存回云端
            const saveResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!saveResponse.ok) {
                throw new Error('保存评论点赞失败: ' + saveResponse.status);
            }
            
            console.log(`✅ 评论点赞操作成功: ${action}, 当前点赞数: ${comment.likes.count}`);
            
            return {
                success: true,
                message: `已${action === 'liked' ? '点赞' : '取消点赞'}`,
                action: action,
                likesCount: comment.likes.count,
                isLiked: action === 'liked',
                binId: this.binId
            };
            
        } catch (error) {
            console.error('评论点赞操作失败:', error);
            return {
                success: false,
                message: '评论点赞操作失败: ' + error.message
            };
        }
    }
    
    /**
     * 获取用户是否点赞了某个反馈
     */
    async getUserLikeStatus(feedbackId, userId = 'anonymous') {
        try {
            const feedbacks = await this.getFeedbacks();
            const feedback = feedbacks.find(f => f.id === feedbackId);
            
            if (!feedback || !feedback.likes) {
                return {
                    isLiked: false,
                    likesCount: 0
                };
            }
            
            return {
                isLiked: feedback.likes.users.includes(userId),
                likesCount: feedback.likes.count || 0
            };
        } catch (error) {
            console.error('获取点赞状态失败:', error);
            return {
                isLiked: false,
                likesCount: 0
            };
        }
    }
    
    /**
     * 删除反馈
     */
    async deleteFeedback(feedbackId) {
        try {
            // 1. 获取当前数据
            const getResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!getResponse.ok) {
                throw new Error('获取当前数据失败');
            }
            
            const getData = await getResponse.json();
            const record = getData.record;
            
            // 2. 查找并删除反馈
            const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
            
            if (feedbackIndex === -1) {
                throw new Error('未找到要删除的反馈');
            }
            
            // 从数组中移除
            record.feedbacks.splice(feedbackIndex, 1);
            
            // 3. 更新统计
            record.stats.total = record.feedbacks.length;
            record.stats.pending = record.feedbacks.filter(f => f.status === 'pending').length;
            record.system.lastUpdated = new Date().toISOString();
            
            // 4. 保存回云端
            const saveResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!saveResponse.ok) {
                throw new Error('删除失败: ' + saveResponse.status);
            }
            
            console.log('✅ 反馈删除成功:', feedbackId);
            
            return {
                success: true,
                message: '反馈已成功删除',
                binId: this.binId
            };
            
        } catch (error) {
            console.error('删除失败:', error);
            return {
                success: false,
                message: '删除失败: ' + error.message
            };
        }
    }
    
    /**
     * 更新反馈状态
     */
    async updateFeedbackStatus(feedbackId, newStatus) {
        try {
            // 1. 获取当前数据
            const getResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!getResponse.ok) {
                throw new Error('获取当前数据失败');
            }
            
            const getData = await getResponse.json();
            const record = getData.record;
            
            // 2. 查找并更新反馈
            const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
            
            if (feedbackIndex === -1) {
                throw new Error('未找到要更新的反馈');
            }
            
            // 更新状态
            record.feedbacks[feedbackIndex].status = newStatus;
            record.feedbacks[feedbackIndex].processedAt = new Date().toISOString();
            
            // 3. 更新统计
            record.stats.pending = record.feedbacks.filter(f => f.status === 'pending').length;
            record.system.lastUpdated = new Date().toISOString();
            
            // 4. 保存回云端
            const saveResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!saveResponse.ok) {
                throw new Error('更新失败: ' + saveResponse.status);
            }
            
            console.log('✅ 反馈状态更新成功:', feedbackId, '->', newStatus);
            
            return {
                success: true,
                message: '反馈状态已更新',
                binId: this.binId
            };
            
        } catch (error) {
            console.error('更新状态失败:', error);
            return {
                success: false,
                message: '更新状态失败: ' + error.message
            };
        }
    }
    
    /**
     * 获取统计
     */
    async getStats() {
        const feedbacks = await this.getFeedbacks();
        
        return {
            total: feedbacks.length,
            pending: feedbacks.filter(f => f.status === 'pending').length,
            processed: feedbacks.filter(f => f.status === 'processed').length,
            suggestions: feedbacks.filter(f => f.type === 'suggestion').length,
            problems: feedbacks.filter(f => f.type === 'problem').length,
            complaints: feedbacks.filter(f => f.type === 'complaint').length,
            others: feedbacks.filter(f => f.type === 'other').length
        };
    }
    
    /**
     * 获取单个反馈（用于测试）
     */
    async getFeedbackById(feedbackId) {
        try {
            const feedbacks = await this.getFeedbacks();
            return feedbacks.find(f => f.id === feedbackId);
        } catch (error) {
            console.error('获取单个反馈失败:', error);
            return null;
        }
    }
}

// 全局实例
const jsonBinStorage = new JsonBinStorage();