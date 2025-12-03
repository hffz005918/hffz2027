// jsonbin-storage.js - 强制固定Bin ID版本
class JsonBinStorage {
    constructor() {
        // ⚠️ 核心修改：硬编码固定Bin ID，禁止自动创建
        this.binId = '692fb6c4d0ea881f400f2b52'; // 固定使用这个ID
        
        // 保存到localStorage确保一致性
        localStorage.setItem('feedbackBinId', this.binId);
        console.log('📌 强制使用固定Bin ID:', this.binId);
        
        // API Keys（暂时用你的，生产环境需要更换）
        this.readOnlyKey = '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m';
        this.masterKey = '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m';
        
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
    }

    /**
     * 测试连接 - 只检查不创建
     */
    async testConnection() {
        try {
            console.log('🔗 测试Bin连接:', this.binId);
            
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`❌ Bin不存在 (ID: ${this.binId})\n请先在JSONBin.io手动创建Bin或使用正确ID`);
                }
                throw new Error(`连接失败: ${response.status}`);
            }
            
            const data = await response.json();
            const feedbackCount = data.record?.feedbacks?.length || 0;
            
            console.log(`✅ Bin连接成功，有 ${feedbackCount} 条反馈`);
            
            return {
                connected: true,
                message: `✅ 连接到Bin成功 (${feedbackCount}条反馈)`,
                binId: this.binId,
                feedbackCount: feedbackCount
            };
            
        } catch (error) {
            console.error('连接测试失败:', error.message);
            return {
                connected: false,
                message: error.message,
                binId: this.binId
            };
        }
    }

    /**
     * 获取所有反馈 - 简化版本
     */
    async getFeedbacks() {
        try {
            console.log('📥 获取反馈数据，Bin:', this.binId);
            
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) {
                console.error('获取失败:', response.status);
                return [];
            }
            
            const data = await response.json();
            const feedbacks = data.record?.feedbacks || [];
            
            console.log(`获取到 ${feedbacks.length} 条反馈`);
            return feedbacks;
            
        } catch (error) {
            console.error('❌ 获取反馈失败:', error);
            return [];
        }
    }

    /**
     * 保存新反馈
     */
    async saveFeedback(feedbackData) {
        try {
            console.log('💾 保存反馈到Bin:', this.binId);
            
            // 1. 先获取现有数据
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) {
                throw new Error(`无法获取现有数据: ${response.status}`);
            }
            
            const data = await response.json();
            const record = data.record;
            
            // 2. 创建新反馈
            const newFeedback = {
                id: 'fb_' + Date.now(),
                employeeName: feedbackData.employeeName || '匿名员工',
                type: feedbackData.type,
                content: feedbackData.content,
                images: feedbackData.images || [],
                status: 'pending',
                timestamp: new Date().toISOString()
            };
            
            // 3. 添加到数组
            if (!record.feedbacks) {
                record.feedbacks = [];
            }
            record.feedbacks.push(newFeedback);
            
            // 4. 更新统计和时间戳
            if (!record.stats) {
                record.stats = { total: 0, pending: 0, processed: 0 };
            }
            record.stats.total = record.feedbacks.length;
            record.stats.pending = record.feedbacks.filter(f => f.status === 'pending').length;
            
            if (!record.system) {
                record.system = {};
            }
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
                throw new Error(`保存失败: ${saveResponse.status}`);
            }
            
            console.log('✅ 反馈保存成功:', newFeedback.id);
            
            return {
                success: true,
                id: newFeedback.id,
                message: '反馈已保存到云端',
                binId: this.binId
            };
            
        } catch (error) {
            console.error('❌ 保存失败:', error);
            
            // 保存到本地作为备份
            const localId = 'local_' + Date.now();
            const localFeedbacks = JSON.parse(localStorage.getItem('local_feedbacks') || '[]');
            localFeedbacks.push({
                ...feedbackData,
                id: localId,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('local_feedbacks', JSON.stringify(localFeedbacks));
            
            return {
                success: false,
                id: localId,
                message: '云端保存失败，已保存到本地',
                warning: '请检查Bin ID和Master Key是否正确'
            };
        }
    }

    /**
     * 更新反馈状态
     */
    async updateFeedbackStatus(feedbackId, status) {
        try {
            console.log(`🔄 更新反馈状态: ${feedbackId} -> ${status}`);
            
            // 获取数据
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) throw new Error('获取数据失败');
            
            const data = await response.json();
            const record = data.record;
            
            // 查找并更新
            const feedback = record.feedbacks.find(f => f.id === feedbackId);
            if (!feedback) throw new Error('反馈不存在');
            
            feedback.status = status;
            feedback.updatedAt = new Date().toISOString();
            
            // 更新统计
            record.stats.pending = record.feedbacks.filter(f => f.status === 'pending').length;
            record.stats.processed = record.feedbacks.filter(f => f.status === 'processed').length;
            record.system.lastUpdated = new Date().toISOString();
            
            // 保存
            const saveResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!saveResponse.ok) throw new Error('保存失败');
            
            return { success: true, message: '状态更新成功' };
            
        } catch (error) {
            console.error('更新失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 获取统计数据
     */
    async getStats() {
        try {
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
            
        } catch (error) {
            console.error('获取统计失败:', error);
            return {
                total: 0, pending: 0, processed: 0,
                suggestions: 0, problems: 0, complaints: 0, others: 0
            };
        }
    }
}

// 创建全局实例
const jsonBinStorage = new JsonBinStorage();

// 自动测试连接
jsonBinStorage.testConnection().then(result => {
    console.log('自动连接测试:', result.message);
});