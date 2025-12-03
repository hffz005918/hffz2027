// jsonbin-storage-fixed.js - 完全修复版
class JsonBinStorage {
    constructor() {
        // ✅ 固定Bin ID - 使用已创建的Bin
        this.binId = '693022ded0ea881f400fee67';
        
        // ✅ 必须更新这两个Key！
        this.readOnlyKey = '$2a$10$0Tjd7CvwY9K98sbp0UqH0e7CRfpCZRRkD14gamCT9ohnbyXFFCDky'; // ← 必须替换！
        this.masterKey = '$2a$10$0Tjd7CvwY9K98sbp0UqH0e7CRfpCZRRkD14gamCT9ohnbyXFFCDky';    // ← 确保这个也是有效的
        
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        
        console.log('✅ JSONBin存储已初始化');
        console.log('Bin ID:', this.binId);
        console.log('请确保Read-Only Key有效');
    }

    /**
     * 智能连接测试
     */
    async testConnection() {
        try {
            console.log('🔗 测试连接，Bin ID:', this.binId);
            
            // 先测试Read-Only Key
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (response.status === 401) {
                console.error('❌ Read-Only Key无效或已过期');
                return {
                    connected: false,
                    message: 'Read-Only Key无效，请更新API Key',
                    error: 'INVALID_KEY'
                };
            }
            
            if (response.status === 404) {
                console.error('❌ Bin不存在:', this.binId);
                return {
                    connected: false,
                    message: `Bin不存在 (${this.binId})`,
                    error: 'BIN_NOT_FOUND'
                };
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const feedbackCount = data.record?.feedbacks?.length || 0;
            
            console.log(`✅ 连接成功！${feedbackCount}条反馈`);
            
            return {
                connected: true,
                message: `✅ 服务器连接正常 (${feedbackCount}条反馈)`,
                binId: this.binId,
                feedbackCount: feedbackCount
            };
            
        } catch (error) {
            console.error('连接测试失败:', error);
            return {
                connected: false,
                message: `连接失败: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * 获取所有反馈（修复版）
     */
    async getFeedbacks() {
        try {
            console.log('📥 获取反馈数据...');
            
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (response.status === 401) {
                console.error('❌ 权限错误：Read-Only Key无效');
                throw new Error('API Key无效，请更新Read-Only Key');
            }
            
            if (!response.ok) {
                console.error('获取失败:', response.status, response.statusText);
                throw new Error(`获取失败: ${response.status}`);
            }
            
            const data = await response.json();
            const feedbacks = data.record?.feedbacks || [];
            
            console.log(`✅ 获取到 ${feedbacks.length} 条反馈`);
            return feedbacks;
            
        } catch (error) {
            console.error('获取反馈失败:', error.message);
            // 返回空数组而不是抛出错误，避免页面崩溃
            return [];
        }
    }

    /**
     * 保存反馈
     */
    async saveFeedback(feedbackData) {
        try {
            console.log('💾 保存反馈...');
            
            // 1. 先获取当前数据（用Read-Only Key）
            const getResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!getResponse.ok) {
                throw new Error('无法获取当前数据');
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
                timestamp: new Date().toISOString(),
                likes: 0
            };
            
            // 3. 添加到数组
            record.feedbacks.push(newFeedback);
            
            // 4. 更新统计
            record.stats.total = record.feedbacks.length;
            record.stats.pending = record.feedbacks.filter(f => f.status === 'pending').length;
            record.system.lastUpdated = new Date().toISOString();
            
            // 5. 保存回云端（用Master Key）
            console.log('正在保存到云端...');
            const saveResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!saveResponse.ok) {
                if (saveResponse.status === 401) {
                    throw new Error('Master Key无效，无法保存');
                }
                throw new Error(`保存失败: ${saveResponse.status}`);
            }
            
            console.log('✅ 反馈保存成功:', newFeedback.id);
            
            return {
                success: true,
                id: newFeedback.id,
                message: '反馈已成功保存到云端',
                binId: this.binId
            };
            
        } catch (error) {
            console.error('❌ 保存失败:', error.message);
            
            // 本地备份
            const localId = 'local_' + Date.now();
            const localData = {
                ...feedbackData,
                id: localId,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };
            
            localStorage.setItem('local_fb_' + localId, JSON.stringify(localData));
            
            return {
                success: false,
                id: localId,
                message: '云端保存失败，已保存到本地',
                error: error.message,
                warning: '请检查Master Key和网络连接'
            };
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
    
    /**
     * 检查API Key状态
     */
    async checkApiKeys() {
        console.log('🔑 检查API Key状态...');
        
        let readOnlyValid = false;
        let masterValid = false;
        
        // 检查Read-Only Key
        try {
            const roResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: { 'X-Access-Key': this.readOnlyKey }
            });
            readOnlyValid = roResponse.ok;
            console.log('Read-Only Key:', readOnlyValid ? '✅ 有效' : '❌ 无效');
        } catch (error) {
            console.log('Read-Only Key: ❌ 测试失败');
        }
        
        // 检查Master Key（尝试创建测试Bin）
        try {
            const testResponse = await fetch('https://api.jsonbin.io/v3/b', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey,
                    'X-Bin-Name': 'Test-Key-Validation'
                },
                body: JSON.stringify({ test: true, timestamp: new Date().toISOString() })
            });
            
            if (testResponse.ok) {
                masterValid = true;
                const data = await testResponse.json();
                // 删除测试Bin
                await fetch(`https://api.jsonbin.io/v3/b/${data.metadata.id}`, {
                    method: 'DELETE',
                    headers: { 'X-Master-Key': this.masterKey }
                });
            }
            console.log('Master Key:', masterValid ? '✅ 有效' : '❌ 无效');
        } catch (error) {
            console.log('Master Key: ❌ 测试失败');
        }
        
        return { readOnlyValid, masterValid };
    }
}

// 创建实例
const jsonBinStorage = new JsonBinStorage();

// 自动检查Key状态
setTimeout(() => {
    jsonBinStorage.checkApiKeys().then(status => {
        if (!status.readOnlyValid) {
            console.error('⚠️ 请更新Read-Only Key！');
        }
    });
}, 1000);