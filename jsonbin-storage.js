// jsonbin-storage.js - 稳定的JSONBin.io存储实现
class JsonBinStorage {
    constructor() {
        // ⚠️ 第一步：固定使用一个有效的Bin ID
        // 从 localStorage 读取，如果没有则使用默认值
        const defaultBinId = '692fb6c4d0ea881f400f2b52'; // 使用你提供的Bin ID
        this.binId = localStorage.getItem('feedbackBinId') || defaultBinId;
        
        // 保存到localStorage，确保后续一致
        localStorage.setItem('feedbackBinId', this.binId);
        
        // ⚠️ 第二步：API Keys
        // 这些Key需要从JSONBin.io获取，目前先用你的测试Key
        this.readOnlyKey = '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m';
        this.masterKey = '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m';
        
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        
        // 初始化状态
        this.isConnected = false;
        this.retryCount = 0;
        
        console.log('JSONBin存储初始化，Bin ID:', this.binId);
    }

    /**
     * 测试连接并确保Bin存在
     */
    async initialize() {
        try {
            console.log('初始化JSONBin连接...');
            
            // 测试连接
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (response.status === 404) {
                console.warn('Bin不存在，准备创建...');
                return await this.createBin();
            }
            
            if (!response.ok) {
                throw new Error(`连接失败: ${response.status}`);
            }
            
            const data = await response.json();
            this.isConnected = true;
            
            console.log('✅ JSONBin连接成功');
            console.log('当前反馈数量:', data.record?.feedbacks?.length || 0);
            
            return {
                success: true,
                message: '✅ 连接到现有Bin成功',
                binId: this.binId,
                data: data.record
            };
            
        } catch (error) {
            console.error('初始化失败:', error);
            return {
                success: false,
                message: `初始化失败: ${error.message}`,
                error: error
            };
        }
    }

    /**
     * 创建新的Bin（如果不存在）
     */
    async createBin() {
        try {
            console.log('创建新Bin...');
            
            const initialData = {
                feedbacks: [],
                stats: {
                    total: 0,
                    pending: 0,
                    processed: 0,
                    suggestions: 0,
                    problems: 0,
                    complaints: 0,
                    others: 0
                },
                system: {
                    created: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    version: '1.0.0'
                }
            };
            
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey,
                    'X-Bin-Name': '宏方纺织员工反馈'
                },
                body: JSON.stringify(initialData)
            });
            
            if (!response.ok) {
                throw new Error(`创建Bin失败: ${response.status}`);
            }
            
            const data = await response.json();
            this.binId = data.metadata.id;
            
            // 保存新的Bin ID
            localStorage.setItem('feedbackBinId', this.binId);
            this.isConnected = true;
            
            console.log('✅ 新Bin创建成功:', this.binId);
            
            return {
                success: true,
                message: '✅ 新Bin创建成功',
                binId: this.binId,
                data: initialData
            };
            
        } catch (error) {
            console.error('创建Bin失败:', error);
            return {
                success: false,
                message: `创建Bin失败: ${error.message}`,
                error: error
            };
        }
    }

    /**
     * 获取完整记录
     */
    async getFullRecord() {
        try {
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) {
                throw new Error(`获取数据失败: ${response.status}`);
            }
            
            const data = await response.json();
            return data.record;
            
        } catch (error) {
            console.error('获取完整记录失败:', error);
            throw error;
        }
    }

    /**
     * 获取所有反馈
     */
    async getFeedbacks() {
        try {
            const record = await this.getFullRecord();
            return record.feedbacks || [];
        } catch (error) {
            console.error('获取反馈失败:', error);
            return [];
        }
    }

    /**
     * 保存新反馈
     */
    async saveFeedback(feedbackData) {
        try {
            // 确保已连接
            if (!this.isConnected) {
                await this.initialize();
            }
            
            // 获取当前数据
            const record = await this.getFullRecord();
            
            // 创建新反馈
            const newFeedback = {
                id: 'fb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                employeeName: feedbackData.employeeName || '匿名员工',
                type: feedbackData.type,
                content: feedbackData.content,
                images: feedbackData.images || [],
                status: 'pending',
                timestamp: new Date().toISOString(),
                likes: 0
            };
            
            // 添加到列表
            record.feedbacks.push(newFeedback);
            
            // 更新统计
            this.updateStats(record);
            record.system.lastUpdated = new Date().toISOString();
            
            // 保存到云端
            const saveResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!saveResponse.ok) {
                throw new Error(`保存失败: ${saveResponse.status}`);
            }
            
            console.log('✅ 反馈保存成功，ID:', newFeedback.id);
            
            return {
                success: true,
                id: newFeedback.id,
                message: '反馈已成功保存到云端',
                binId: this.binId
            };
            
        } catch (error) {
            console.error('保存反馈失败:', error);
            
            // 备用方案：保存到本地
            const localId = 'local_' + Date.now();
            this.saveToLocalStorage(feedbackData, localId);
            
            return {
                success: false,
                id: localId,
                message: '云端保存失败，已保存到本地',
                error: error.message
            };
        }
    }

    /**
     * 更新反馈状态
     */
    async updateFeedbackStatus(feedbackId, status) {
        try {
            const record = await this.getFullRecord();
            const feedback = record.feedbacks.find(f => f.id === feedbackId);
            
            if (!feedback) {
                throw new Error('反馈不存在');
            }
            
            feedback.status = status;
            feedback.updatedAt = new Date().toISOString();
            
            this.updateStats(record);
            record.system.lastUpdated = new Date().toISOString();
            
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!response.ok) {
                throw new Error(`更新失败: ${response.status}`);
            }
            
            return { success: true, message: '状态更新成功' };
            
        } catch (error) {
            console.error('更新状态失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 删除反馈
     */
    async deleteFeedback(feedbackId) {
        try {
            const record = await this.getFullRecord();
            const initialLength = record.feedbacks.length;
            
            record.feedbacks = record.feedbacks.filter(f => f.id !== feedbackId);
            
            if (record.feedbacks.length === initialLength) {
                throw new Error('反馈不存在');
            }
            
            this.updateStats(record);
            record.system.lastUpdated = new Date().toISOString();
            
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!response.ok) {
                throw new Error(`删除失败: ${response.status}`);
            }
            
            return { success: true, message: '删除成功' };
            
        } catch (error) {
            console.error('删除失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 更新统计信息
     */
    updateStats(record) {
        const feedbacks = record.feedbacks || [];
        const stats = record.stats;
        
        stats.total = feedbacks.length;
        stats.pending = feedbacks.filter(f => f.status === 'pending').length;
        stats.processed = feedbacks.filter(f => f.status === 'processed').length;
        
        // 按类型统计
        stats.suggestions = feedbacks.filter(f => f.type === 'suggestion').length;
        stats.problems = feedbacks.filter(f => f.type === 'problem').length;
        stats.complaints = feedbacks.filter(f => f.type === 'complaint').length;
        stats.others = feedbacks.filter(f => f.type === 'other').length;
    }

    /**
     * 本地存储后备方案
     */
    saveToLocalStorage(feedbackData, id) {
        try {
            const localFeedbacks = JSON.parse(localStorage.getItem('local_feedbacks') || '[]');
            
            localFeedbacks.push({
                ...feedbackData,
                id: id,
                timestamp: new Date().toISOString(),
                isLocal: true
            });
            
            localStorage.setItem('local_feedbacks', JSON.stringify(localFeedbacks));
            console.log('已保存到本地存储:', id);
            
        } catch (error) {
            console.error('本地存储失败:', error);
        }
    }

    /**
     * 获取统计数据
     */
    async getStats() {
        try {
            const record = await this.getFullRecord();
            return record.stats;
        } catch (error) {
            console.error('获取统计失败:', error);
            return {
                total: 0,
                pending: 0,
                processed: 0,
                suggestions: 0,
                problems: 0,
                complaints: 0,
                others: 0
            };
        }
    }

    /**
     * 测试连接
     */
    async testConnection() {
        const result = await this.initialize();
        return {
            connected: result.success,
            message: result.message,
            binId: this.binId
        };
    }
}

// 创建全局实例
const jsonBinStorage = new JsonBinStorage();

// 初始化连接
jsonBinStorage.initialize().then(result => {
    console.log('JSONBin初始化完成:', result.message);
});