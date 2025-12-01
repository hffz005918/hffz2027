// jsonbin-storage.js - JSONBin.io 存储解决方案
class JsonBinStorage {
    constructor() {
        // 🔧 这里填入你的配置信息
        this.config = {
            binId: '692d257b1a35bc08957ff712',  
            apiKey: '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m',
            apiUrl: 'https://api.jsonbin.io/v3/b'
        };
        
        console.log('✅ JSONBin 存储已初始化');
    }
    
    // 测试连接
    async testConnection() {
        try {
            console.log('🔗 测试服务器连接...');
            
            const response = await fetch(`${this.config.apiUrl}/${this.config.binId}/latest`, {
                method: 'GET',
                headers: {
                    'X-Master-Key': this.config.apiKey,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                console.log('✅ 服务器连接成功');
                return {
                    success: true,
                    message: '✅ 服务器连接正常'
                };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ 连接测试失败:', error);
            return {
                success: false,
                error: '连接失败: ' + error.message
            };
        }
    }
    
    // 保存反馈
    async saveFeedback(feedbackData) {
        try {
            console.log('📤 开始保存反馈...', feedbackData);
            
            // 生成唯一ID
            const feedbackId = 'fb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // 准备完整数据
            const completeFeedback = {
                id: feedbackId,
                employeeName: feedbackData.employeeName || '匿名用户',
                type: feedbackData.type || 'other',
                content: feedbackData.content,
                timestamp: new Date().toISOString(),
                status: 'pending',
                ip: await this.getClientIP()
            };
            
            console.log('📝 完整反馈数据:', completeFeedback);
            
            // 1. 先获取现有数据
            const existingFeedbacks = await this.getFeedbacks();
            
            // 2. 添加新反馈
            const allFeedbacks = [completeFeedback, ...existingFeedbacks];
            
            // 3. 更新到 JSONBin
            const response = await fetch(`${this.config.apiUrl}/${this.config.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.config.apiKey,
                    'X-Bin-Versioning': 'false'
                },
                body: JSON.stringify(allFeedbacks)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`保存失败 (${response.status}): ${errorData.message || '未知错误'}`);
            }
            
            const result = await response.json();
            console.log('✅ 保存成功:', result);
            
            return {
                success: true,
                id: feedbackId,
                message: '反馈提交成功！',
                record: completeFeedback
            };
            
        } catch (error) {
            console.error('❌ 保存失败:', error);
            return {
                success: false,
                error: '保存失败: ' + error.message
            };
        }
    }
    
    // 获取所有反馈
    async getFeedbacks() {
        try {
            console.log('📥 获取反馈数据...');
            
            const response = await fetch(`${this.config.apiUrl}/${this.config.binId}/latest`, {
                headers: {
                    'X-Master-Key': this.config.apiKey,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                console.warn('⚠️ 获取数据失败，返回空数组');
                return [];
            }
            
            const data = await response.json();
            console.log('📊 获取到数据条数:', data.record ? data.record.length : 0);
            
            return data.record || [];
            
        } catch (error) {
            console.error('❌ 获取数据失败:', error);
            return [];
        }
    }
    
    // 获取客户端IP（用于记录）
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch {
            return 'unknown';
        }
    }
    
    // 删除反馈（管理员用）
    async deleteFeedback(feedbackId) {
        try {
            // 1. 获取所有数据
            const allFeedbacks = await this.getFeedbacks();
            
            // 2. 过滤掉要删除的
            const filteredFeedbacks = allFeedbacks.filter(fb => fb.id !== feedbackId);
            
            // 3. 更新到 JSONBin
            const response = await fetch(`${this.config.apiUrl}/${this.config.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.config.apiKey
                },
                body: JSON.stringify(filteredFeedbacks)
            });
            
            if (response.ok) {
                return { success: true, message: '删除成功' };
            } else {
                throw new Error('删除失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // 更新反馈状态（管理员用）
    async updateStatus(feedbackId, newStatus) {
        try {
            // 1. 获取所有数据
            const allFeedbacks = await this.getFeedbacks();
            
            // 2. 找到并更新
            const updatedFeedbacks = allFeedbacks.map(fb => {
                if (fb.id === feedbackId) {
                    return { ...fb, status: newStatus };
                }
                return fb;
            });
            
            // 3. 更新到 JSONBin
            const response = await fetch(`${this.config.apiUrl}/${this.config.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.config.apiKey
                },
                body: JSON.stringify(updatedFeedbacks)
            });
            
            if (response.ok) {
                return { success: true, message: '状态更新成功' };
            } else {
                throw new Error('更新失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}