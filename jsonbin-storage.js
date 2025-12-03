// jsonbin-storage-simple.js - 最简单稳定的版本
class JsonBinStorage {
    constructor() {
        // 🔧 第一步：先运行上面的 createAndSetupNewBin() 获取新的Bin ID
        // 然后用那个新ID替换下面的值
        this.binId = '69302a1243b1c97be9d4f52e'; // ← 替换这里！
        
        // 如果binId还是默认值，提示用户
        if (this.binId === '692fcd96ae596e708f8004bb') {
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
        this.readOnlyKey = '$2a$10$7HImvQnFOiRjiLQJO3Gj2ucB.zYHhZUGO41thxxh4IHpaGhEUQa/G';
        this.masterKey = '$2a$10$7HImvQnFOiRjiLQJO3Gj2ucB.zYHhZUGO41thxxh4IHpaGhEUQa/G';
        
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
            return data.record?.feedbacks || [];
            
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
}

// 全局实例
const jsonBinStorage = new JsonBinStorage();