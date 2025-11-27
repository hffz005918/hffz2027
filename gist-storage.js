class GistStorage {
    constructor() {
        this.token = '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'; // 替换为你的GitHub Token
        this.gistId = null; // 公开Gist的ID
        this.gistFilename = 'employee-feedbacks.json';
        this.baseURL = 'https://api.github.com';
        this.init();
    }

    async init() {
        // 尝试获取或创建公开Gist
        await this.getOrCreatePublicGist();
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            }
        };

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                throw new Error(`GitHub API错误: ${response.status}`);
            }

            return response.json();
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    }

    // 创建或获取公开Gist
    async getOrCreatePublicGist() {
        // 如果已有Gist ID，直接使用
        if (this.gistId) {
            return await this.request(`/gists/${this.gistId}`);
        }

        // 创建新的公开Gist
        const newGist = await this.request('/gists', {
            method: 'POST',
            body: JSON.stringify({
                description: '宏方纺织员工反馈系统 - 公开讨论区',
                public: true, // 公开Gist，所有人都可查看和评论
                files: {
                    [this.gistFilename]: {
                        content: JSON.stringify([], null, 2)
                    }
                }
            })
        });

        this.gistId = newGist.id;
        console.log('✅ 创建公开Gist成功:', newGist.html_url);
        return newGist;
    }

    // 保存反馈
    async saveFeedback(feedbackData) {
        try {
            const gist = await this.getOrCreatePublicGist();
            const currentData = JSON.parse(gist.files[this.gistFilename].content);
            
        // 生成唯一ID
        feedbackData.id = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        feedbackData.timestamp = new Date().toISOString();
        feedbackData.status = feedbackData.status || 'pending';
        feedbackData.comments = feedbackData.comments || []; // 初始化评论数组
        feedbackData.likes = feedbackData.likes || 0; // 点赞数
        feedbackData.likedBy = feedbackData.likedBy || []; // 点赞用户
        
        currentData.push(feedbackData);
            
            // 更新Gist
            await this.request(`/gists/${this.gistId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    files: {
                        [this.gistFilename]: {
                            content: JSON.stringify(currentData, null, 2)
                        }
                    }
                })
            });

            console.log('✅ 反馈已保存到公开Gist');
            return { 
                success: true, 
                id: feedbackData.id,
                gistUrl: gist.html_url 
            };
        } catch (error) {
            console.error('❌ 保存到Gist失败:', error);
            throw error;
        }
    }

    // 获取所有反馈
    async getFeedbacks() {
        try {
            const gist = await this.getOrCreatePublicGist();
            const data = JSON.parse(gist.files[this.gistFilename].content);
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('❌ 从Gist获取数据失败:', error);
            return [];
        }
    }

    // 添加评论
    async addComment(feedbackId, commentData) {
        try {
            const gist = await this.getOrCreatePublicGist();
            const currentData = JSON.parse(gist.files[this.gistFilename].content);
            
            const feedbackIndex = currentData.findIndex(fb => fb.id === feedbackId);
            if (feedbackIndex !== -1) {
                if (!currentData[feedbackIndex].comments) {
                    currentData[feedbackIndex].comments = [];
                }
                
                commentData.id = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                commentData.timestamp = new Date().toISOString();
                
                currentData[feedbackIndex].comments.push(commentData);
                
                await this.request(`/gists/${this.gistId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        files: {
                            [this.gistFilename]: {
                                content: JSON.stringify(currentData, null, 2)
                            }
                        }
                    })
                });
                
                return { success: true, commentId: commentData.id };
            }
            return { success: false, error: '反馈不存在' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 点赞反馈
    async likeFeedback(feedbackId, userId) {
        try {
            const gist = await this.getOrCreatePublicGist();
            const currentData = JSON.parse(gist.files[this.gistFilename].content);
            
            const feedbackIndex = currentData.findIndex(fb => fb.id === feedbackId);
            if (feedbackIndex !== -1) {
                if (!currentData[feedbackIndex].likedBy) {
                    currentData[feedbackIndex].likedBy = [];
                }
                
                const userIndex = currentData[feedbackIndex].likedBy.indexOf(userId);
                if (userIndex === -1) {
                    // 点赞
                    currentData[feedbackIndex].likedBy.push(userId);
                    currentData[feedbackIndex].likes = (currentData[feedbackIndex].likes || 0) + 1;
                } else {
                    // 取消点赞
                    currentData[feedbackIndex].likedBy.splice(userIndex, 1);
                    currentData[feedbackIndex].likes = Math.max(0, (currentData[feedbackIndex].likes || 1) - 1);
                }
                
                await this.request(`/gists/${this.gistId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        files: {
                            [this.gistFilename]: {
                                content: JSON.stringify(currentData, null, 2)
                            }
                        }
                    })
                });
                
                return { 
                    success: true, 
                    likes: currentData[feedbackIndex].likes,
                    isLiked: currentData[feedbackIndex].likedBy.includes(userId)
                };
            }
            return { success: false, error: '反馈不存在' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 获取Gist URL（用于公开访问和评论）
    getGistUrl() {
        return this.gistId ? `https://gist.github.com/${this.gistId}` : null;
    }

    // 获取Gist的评论（通过GitHub Issues API）
    async getGistComments() {
        try {
            const comments = await this.request(`/gists/${this.gistId}/comments`);
            return comments;
        } catch (error) {
            console.error('获取Gist评论失败:', error);
            return [];
        }
    }

    // 在Gist中添加评论（公开讨论）
    async addGistComment(commentBody) {
        try {
            const comment = await this.request(`/gists/${this.gistId}/comments`, {
                method: 'POST',
                body: JSON.stringify({
                    body: commentBody
                })
            });
            return { success: true, comment };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}