class GistStorage {
    constructor() {
        // 使用你提供的Token
        this.token = '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';
        this.gistId = localStorage.getItem('feedbackGistId'); // 从本地存储获取Gist ID
        this.gistFilename = 'employee-feedbacks.json';
        this.baseURL = 'https://api.github.com';
        this.debug = true;
    }

    log(message) {
        if (this.debug) {
            console.log('🔍 GistStorage:', message);
        }
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        this.log(`请求: ${options.method || 'GET'} ${url}`);
        
        const headers = {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
        };

        try {
            const response = await fetch(url, { 
                ...options, 
                headers: headers 
            });
            
            this.log(`响应状态: ${response.status} ${response.statusText}`);
            
            if (response.status === 401) {
                throw new Error('GitHub Token无效或权限不足');
            }
            
            if (response.status === 403) {
                const resetTime = response.headers.get('x-ratelimit-reset');
                if (resetTime) {
                    const resetDate = new Date(resetTime * 1000);
                    throw new Error(`API速率限制，请在 ${resetDate.toLocaleTimeString()} 后重试`);
                }
                throw new Error('API权限不足，请检查Token权限');
            }
            
            if (response.status === 404) {
                throw new Error('资源不存在，可能Gist已被删除');
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GitHub API错误: ${response.status} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            this.log(`请求失败: ${error.message}`);
            
            // 如果是网络错误，提供更友好的提示
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error('网络连接失败，请检查网络连接或使用本地存储方案');
            }
            
            throw error;
        }
    }

    // 测试Token有效性
    async testToken() {
        try {
            this.log('测试Token有效性...');
            const user = await this.request('/user');
            this.log(`✅ Token有效，用户: ${user.login}`);
            return { success: true, user: user.login };
        } catch (error) {
            this.log(`❌ Token测试失败: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // 创建新的Gist
    async createGist() {
        this.log('创建新的公开Gist...');
        
        try {
            const newGist = await this.request('/gists', {
                method: 'POST',
                body: JSON.stringify({
                    description: '宏方纺织员工反馈系统 - 公开讨论区',
                    public: true,
                    files: {
                        [this.gistFilename]: {
                            content: JSON.stringify([], null, 2)
                        }
                    }
                })
            });

            this.gistId = newGist.id;
            
            // 保存Gist ID到本地存储
            localStorage.setItem('feedbackGistId', this.gistId);
            localStorage.setItem('feedbackGistUrl', newGist.html_url);
            
            this.log(`✅ 创建公开Gist成功: ${newGist.html_url}`);
            return newGist;
        } catch (error) {
            this.log(`❌ 创建Gist失败: ${error.message}`);
            throw error;
        }
    }

    // 获取现有Gist
    async getExistingGist() {
        if (!this.gistId) {
            throw new Error('没有Gist ID');
        }
        
        try {
            this.log(`获取现有Gist: ${this.gistId}`);
            const gist = await this.request(`/gists/${this.gistId}`);
            return gist;
        } catch (error) {
            this.log(`获取Gist失败: ${error.message}`);
            throw error;
        }
    }

    // 获取或创建Gist
    async getOrCreatePublicGist() {
        // 先测试Token
        const tokenTest = await this.testToken();
        if (!tokenTest.success) {
            throw new Error(`Token验证失败: ${tokenTest.error}`);
        }

        // 如果已有Gist ID，尝试获取现有Gist
        if (this.gistId) {
            try {
                return await this.getExistingGist();
            } catch (error) {
                this.log(`读取现有Gist失败，创建新Gist: ${error.message}`);
                // 如果读取失败，创建新的Gist
            }
        }

        // 创建新的Gist
        return await this.createGist();
    }

    // 保存反馈
    async saveFeedback(feedbackData) {
        try {
            this.log('开始保存反馈...');
            
            const gist = await this.getOrCreatePublicGist();
            let currentData = [];
            
            // 读取现有数据
            try {
                if (gist.files && gist.files[this.gistFilename]) {
                    currentData = JSON.parse(gist.files[this.gistFilename].content);
                }
            } catch (e) {
                this.log('解析现有数据失败，使用空数组');
            }
            
            // 准备反馈数据
            feedbackData.id = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            feedbackData.timestamp = new Date().toISOString();
            feedbackData.status = feedbackData.status || 'pending';
            feedbackData.comments = feedbackData.comments || [];
            feedbackData.likes = feedbackData.likes || 0;
            feedbackData.likedBy = feedbackData.likedBy || [];
            
            currentData.push(feedbackData);
            
            this.log(`更新Gist，现有数据条数: ${currentData.length}`);
            
            // 更新Gist
            await this.request(`/gists/${this.gistId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    description: '宏方纺织员工反馈系统 - 公开讨论区',
                    files: {
                        [this.gistFilename]: {
                            content: JSON.stringify(currentData, null, 2)
                        }
                    }
                })
            });

            this.log('✅ 反馈已保存到公开Gist');
            return { 
                success: true, 
                id: feedbackData.id,
                gistUrl: gist.html_url 
            };
        } catch (error) {
            this.log(`❌ 保存到Gist失败: ${error.message}`);
            throw error;
        }
    }

    // 获取所有反馈
    async getFeedbacks() {
        try {
            this.log('获取反馈数据...');
            
            if (!this.gistId) {
                this.gistId = localStorage.getItem('feedbackGistId');
                if (!this.gistId) {
                    this.log('没有Gist ID，返回空数组');
                    return [];
                }
            }
            
            const gist = await this.getExistingGist();
            if (gist.files && gist.files[this.gistFilename]) {
                const data = JSON.parse(gist.files[this.gistFilename].content);
                this.log(`获取到 ${data.length} 条反馈`);
                return Array.isArray(data) ? data : [];
            }
            
            return [];
        } catch (error) {
            this.log(`❌ 从Gist获取数据失败: ${error.message}`);
            return [];
        }
    }

    // 添加评论
    async addComment(feedbackId, commentData) {
        try {
            const gist = await this.getExistingGist();
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

    // 获取Gist URL
    getGistUrl() {
        return localStorage.getItem('feedbackGistUrl') || 
               (this.gistId ? `https://gist.github.com/${this.gistId}` : null);
    }

    // 获取Gist信息
    async getGistInfo() {
        try {
            if (!this.gistId) {
                return { success: false, error: '没有Gist ID' };
            }
            
            const gist = await this.getExistingGist();
            return {
                success: true,
                url: gist.html_url,
                description: gist.description,
                createdAt: gist.created_at,
                updatedAt: gist.updated_at
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}