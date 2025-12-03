// jsonbin-storage-fixed.js - 修复版本
class JsonBinStorage {
    constructor() {
        // 🎯 核心修复：硬编码固定Bin ID
        this.binId = '692fb6c4d0ea881f400f2b52'; // 固定使用这个
        
        // API Keys
        this.readOnlyKey = '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m';
        this.masterKey = '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m';
        
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        
        console.log('初始化JSONBin存储，固定Bin ID:', this.binId);
    }
    
    // 简化版testConnection（不自动创建）
    async testConnection() {
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
                    message: `Bin ${this.binId} 不存在`,
                    binId: this.binId
                };
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            return {
                connected: true,
                message: `✅ 连接成功`,
                binId: this.binId,
                feedbackCount: data.record?.feedbacks?.length || 0
            };
            
        } catch (error) {
            return {
                connected: false,
                message: `连接失败: ${error.message}`,
                binId: this.binId
            };
        }
    }
    
    // 简化版getFeedbacks
    async getFeedbacks() {
        try {
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) return [];
            
            const data = await response.json();
            return data.record?.feedbacks || [];
            
        } catch (error) {
            console.error('获取反馈失败:', error);
            return [];
        }
    }
    
    // 保存反馈（简化版）
    async saveFeedback(feedbackData) {
        try {
            // 获取当前数据
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) throw new Error('获取数据失败');
            
            const data = await response.json();
            const record = data.record || { feedbacks: [], stats: {}, system: {} };
            
            // 创建新反馈
            const newFeedback = {
                id: 'fb_' + Date.now(),
                employeeName: feedbackData.employeeName || '匿名员工',
                type: feedbackData.type,
                content: feedbackData.content,
                images: feedbackData.images || [],
                status: 'pending',
                timestamp: new Date().toISOString()
            };
            
            // 添加到数组
            if (!record.feedbacks) record.feedbacks = [];
            record.feedbacks.push(newFeedback);
            
            // 更新统计
            if (!record.stats) record.stats = {};
            record.stats.total = record.feedbacks.length;
            record.stats.pending = record.feedbacks.filter(f => f.status === 'pending').length;
            
            // 更新时间
            if (!record.system) record.system = {};
            record.system.lastUpdated = new Date().toISOString();
            
            // 保存回云端
            const saveResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!saveResponse.ok) throw new Error('保存失败');
            
            return {
                success: true,
                id: newFeedback.id,
                message: '反馈已保存到云端',
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
}

// 全局实例
const jsonBinStorage = new JsonBinStorage();