// jsonbin-storage-fixed.js - 修复版 JSONBin 存储
class JsonBinStorage {
    constructor() {
        // 🔧 修改这里 - 填入你的信息
        this.config = {
            binId: '692d257b1a35bc08957ff712',  // 改成你的 Bin ID
            apiKey: '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m', // 改成你的 Secret Key
            binName: 'employee-feedback' // 可自定义
        };
        
        console.log('✅ JSONBin 存储初始化');
        console.log('Bin ID:', this.config.binId);
        console.log('API Key:', this.config.apiKey ? '已设置' : '未设置');
    }
    
    // 测试连接（简单验证）
    async testConnection() {
        try {
            console.log('🔗 测试服务器连接...');
            
            const response = await fetch(`https://api.jsonbin.io/v3/b/${this.config.binId}`, {
                headers: {
                    'X-Master-Key': this.config.apiKey,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('响应状态:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('连接成功，当前数据:', data);
                return {
                    success: true,
                    message: '✅ 服务器连接正常',
                    data: data
                };
            } else {
                // 尝试创建新的Bin
                if (response.status === 404) {
                    console.log('Bin不存在，尝试创建...');
                    return await this.createBin();
                }
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
    
    // 创建新的Bin
    async createBin() {
        try {
            const initialData = [];
            
            const response = await fetch('https://api.jsonbin.io/v3/b', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.config.apiKey,
                    'X-Bin-Name': this.config.binName,
                    'X-Bin-Private': 'false'
                },
                body: JSON.stringify(initialData)
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ 创建成功:', data);
                // 更新Bin ID
                this.config.binId = data.metadata.id;
                return {
                    success: true,
                    message: '✅ 已创建新的数据存储',
                    binId: data.metadata.id
                };
            } else {
                throw new Error('创建失败: ' + response.status);
            }
        } catch (error) {
            return {
                success: false,
                error: '创建存储失败: ' + error.message
            };
        }
    }
    
    // 保存反馈
    async saveFeedback(feedbackData) {
        try {
            console.log('📤 开始保存反馈...');
            
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
                date: new Date().toLocaleString('zh-CN')
            };
            
            console.log('📝 反馈数据:', completeFeedback);
            
            // 方法1: 直接添加到现有数据
            try {
                // 先获取现有数据
                const existing = await this.getFeedbacks();
                const allData = [completeFeedback, ...existing];
                
                // 更新数据
                const response = await fetch(`https://api.jsonbin.io/v3/b/${this.config.binId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Master-Key': this.config.apiKey
                    },
                    body: JSON.stringify(allData)
                });
                
                if (response.ok) {
                    console.log('✅ 保存成功');
                    return {
                        success: true,
                        id: feedbackId,
                        message: '反馈提交成功！'
                    };
                } else {
                    console.log('方法1失败，尝试方法2...');
                    // 尝试方法2
                    return await this.saveViaCreate(completeFeedback);
                }
                
            } catch (error) {
                console.log('方法1出错，尝试方法2...', error);
                return await this.saveViaCreate(completeFeedback);
            }
            
        } catch (error) {
            console.error('❌ 保存失败:', error);
            return {
                success: false,
                error: '保存失败: ' + error.message
            };
        }
    }
    
    // 方法2: 通过创建新记录保存
    async saveViaCreate(feedbackData) {
        try {
            const response = await fetch('https://api.jsonbin.io/v3/b', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.config.apiKey,
                    'X-Bin-Name': `feedback-${Date.now()}`,
                    'X-Bin-Private': 'false'
                },
                body: JSON.stringify([feedbackData])
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ 通过创建新Bin保存成功');
                return {
                    success: true,
                    id: feedbackData.id,
                    message: '反馈提交成功！',
                    binId: data.metadata.id
                };
            } else {
                throw new Error('保存失败');
            }
        } catch (error) {
            return {
                success: false,
                error: '保存失败，请稍后重试'
            };
        }
    }
    
    // 获取所有反馈
    async getFeedbacks() {
        try {
            console.log('📥 获取反馈数据...');
            
            const response = await fetch(`https://api.jsonbin.io/v3/b/${this.config.binId}/latest`, {
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
            console.log('📊 获取到数据:', data);
            
            return data.record || [];
            
        } catch (error) {
            console.error('❌ 获取数据失败:', error);
            return [];
        }
    }
}

// 备用方案：如果JSONBin不可用，使用本地存储
class FallbackStorage {
    constructor() {
        this.storageKey = 'employee_feedbacks';
        console.log('⚠️ 使用本地存储备用方案');
    }
    
    async saveFeedback(feedbackData) {
        try {
            const feedbacks = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
            
            const newFeedback = {
                id: 'local_' + Date.now(),
                employeeName: feedbackData.employeeName || '匿名用户',
                type: feedbackData.type || 'other',
                content: feedbackData.content,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };
            
            feedbacks.push(newFeedback);
            localStorage.setItem(this.storageKey, JSON.stringify(feedbacks));
            
            return {
                success: true,
                id: newFeedback.id,
                message: '反馈已保存（本地模式）'
            };
        } catch (error) {
            return {
                success: false,
                error: '保存失败'
            };
        }
    }
    
    async getFeedbacks() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        } catch {
            return [];
        }
    }
    
    async testConnection() {
        return {
            success: true,
            message: '✅ 本地存储模式'
        };
    }
}