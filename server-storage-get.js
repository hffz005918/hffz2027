// server-storage-get.js - 纯GET版本的存储管理器
class ServerStorage {
    constructor() {
        this.serverURL = 'server-get.php';
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
            const params = new URLSearchParams();
            params.append('action', action);
            
            // 对于不同操作添加不同参数
            if (action === 'save_feedback' && data.feedback) {
                // 将反馈数据编码为URL参数
                const feedbackData = encodeURIComponent(JSON.stringify(data.feedback));
                params.append('data', feedbackData);
            } else if (action === 'update_status') {
                params.append('id', data.feedbackId);
                params.append('status', data.status);
            } else if (action === 'delete_feedback') {
                params.append('id', data.feedbackId);
            }
            
            const url = this.serverURL + '?' + params.toString();
            this.log(`请求URL: ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            this.log(`响应状态: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                throw new Error(`服务器错误: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            this.log(`响应数据: ${JSON.stringify(result)}`);
            
            if (!result.success) {
                throw new Error(result.error || '服务器返回错误');
            }

            return result;
        } catch (error) {
            this.log(`❌ 请求失败: ${error.message}`);
            throw error;
        }
    }

    // 获取所有反馈
    async getFeedbacks() {
        try {
            this.log('从服务器获取反馈数据...');
            const result = await this.request({ action: 'get_all' });
            this.log(`获取到 ${result.data.length} 条反馈`);
            return Array.isArray(result.data) ? result.data : [];
        } catch (error) {
            this.log(`❌ 获取数据失败: ${error.message}`);
            throw error;
        }
    }

    // 保存反馈
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

    // 更新反馈状态
    async updateFeedbackStatus(feedbackId, status) {
        try {
            const result = await this.request({
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
            const result = await this.request({
                action: 'delete_feedback',
                feedbackId: feedbackId
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 测试连接
    async testConnection() {
        try {
            this.log('测试服务器连接...');
            const result = await this.request({ action: 'test' });
            this.log('✅ 服务器连接正常');
            return { success: true, message: result.message };
        } catch (error) {
            this.log('❌ 服务器连接失败');
            return { success: false, error: error.message };
        }
    }
}

// 本地存储回退方案
class LocalStorageFallback {
    constructor() {
        this.storageKey = 'employeeFeedbacks_local';
    }

    async getFeedbacks() {
        return new Promise((resolve) => {
            try {
                const feedbacks = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
                resolve(feedbacks);
            } catch (error) {
                resolve([]);
            }
        });
    }

    async saveFeedback(feedbackData) {
        return new Promise((resolve) => {
            try {
                const feedbacks = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
                feedbackData.id = 'local_' + Date.now();
                feedbackData.timestamp = new Date().toISOString();
                feedbackData.status = 'pending';
                feedbackData.likes = 0;
                feedbackData.comments = [];
                
                feedbacks.push(feedbackData);
                localStorage.setItem(this.storageKey, JSON.stringify(feedbacks));
                resolve({ success: true, id: feedbackData.id });
            } catch (error) {
                resolve({ success: false, error: error.message });
            }
        });
    }

    async updateFeedbackStatus(feedbackId, status) {
        return new Promise((resolve) => {
            try {
                const feedbacks = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
                const feedback = feedbacks.find(f => f.id === feedbackId);
                if (feedback) {
                    feedback.status = status;
                    localStorage.setItem(this.storageKey, JSON.stringify(feedbacks));
                    resolve({ success: true });
                } else {
                    resolve({ success: false, error: '反馈不存在' });
                }
            } catch (error) {
                resolve({ success: false, error: error.message });
            }
        });
    }

    async deleteFeedback(feedbackId) {
        return new Promise((resolve) => {
            try {
                const feedbacks = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
                const newFeedbacks = feedbacks.filter(f => f.id !== feedbackId);
                localStorage.setItem(this.storageKey, JSON.stringify(newFeedbacks));
                resolve({ success: true });
            } catch (error) {
                resolve({ success: false, error: error.message });
            }
        });
    }

    async testConnection() {
        return { success: true, message: '本地存储模式' };
    }
}

// 智能存储选择器
class SmartStorage {
    constructor() {
        this.serverStorage = new ServerStorage();
        this.localStorage = new LocalStorageFallback();
        this.useLocalStorage = false;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            // 测试服务器连接
            const testResult = await this.serverStorage.testConnection();
            if (!testResult.success) {
                throw new Error('服务器连接失败');
            }
            this.useLocalStorage = false;
            console.log('✅ 使用服务器存储');
        } catch (error) {
            this.useLocalStorage = true;
            console.log('⚠️ 使用本地存储:', error.message);
        }
        this.initialized = true;
    }

    async getFeedbacks() {
        await this.initialize();
        if (this.useLocalStorage) {
            return this.localStorage.getFeedbacks();
        }
        return this.serverStorage.getFeedbacks();
    }

    async saveFeedback(feedbackData) {
        await this.initialize();
        if (this.useLocalStorage) {
            return this.localStorage.saveFeedback(feedbackData);
        }
        return this.serverStorage.saveFeedback(feedbackData);
    }

    async updateFeedbackStatus(feedbackId, status) {
        await this.initialize();
        if (this.useLocalStorage) {
            return this.localStorage.updateFeedbackStatus(feedbackId, status);
        }
        return this.serverStorage.updateFeedbackStatus(feedbackId, status);
    }

    async deleteFeedback(feedbackId) {
        await this.initialize();
        if (this.useLocalStorage) {
            return this.localStorage.deleteFeedback(feedbackId);
        }
        return this.serverStorage.deleteFeedback(feedbackId);
    }

    async testConnection() {
        await this.initialize();
        if (this.useLocalStorage) {
            return this.localStorage.testConnection();
        }
        return this.serverStorage.testConnection();
    }
}