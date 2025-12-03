// jsonbin-storage.js - JSONBin.io 云端存储实现
class JsonBinStorage {
    constructor() {
        // JSONBin.io 配置
        // 从localStorage获取已保存的binId，如果没有则为空（将自动创建）
        this.binId = localStorage.getItem('feedbackBinId') || '';
        // 前端只应使用Read-Only Key进行读取
        this.readOnlyKey = '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m';
        // ⚠️ 重要：实际部署时Master Key应该在后端，这里仅用于紧急创建
        this.masterKey = '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m'; 
        
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        
        // 模拟数据，以防网络问题
        this.fallbackData = {
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
    }

    /**
     * 测试与JSONBin.io服务器的连接
     * @returns {Promise<Object>} 连接状态
     */
    async testConnection() {
        try {
            console.log('正在测试JSONBin.io连接...');
            
            // 如果有binId，先尝试连接现有Bin
            if (this.binId) {
                try {
                    const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Access-Key': this.readOnlyKey
                        }
                    });
                    
                    if (response.ok) {
                        console.log('✅ 连接到现有Bin成功');
                        const data = await response.json();
                        return {
                            connected: true,
                            message: '✅ 连接到现有Bin成功',
                            data: data.record,
                            binId: this.binId,
                            binExists: true
                        };
                    }
                    // 如果404，Bin不存在，继续创建流程
                    if (response.status === 404) {
                        console.log('现有Bin不存在，将创建新Bin...');
                        this.binId = ''; // 清空无效的binId
                        localStorage.removeItem('feedbackBinId');
                    }
                } catch (error) {
                    console.warn('连接现有Bin失败:', error.message);
                }
            }
            
            // 创建新的Bin
            console.log('正在创建新的Bin...');
            
            // 准备创建请求头
            const createHeaders = {
                'Content-Type': 'application/json',
                'X-Master-Key': this.masterKey,
                'X-Bin-Name': 'Hongfang-Feedback-System',
                'X-Bin-Private': 'false'
            };
            
            const createResponse = await fetch(this.baseUrl, {
                method: 'POST',
                headers: createHeaders,
                body: JSON.stringify(this.fallbackData)
            });
            
            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                console.error('创建Bin失败:', createResponse.status, errorText);
                
                // 检查是否是Master Key权限问题
                if (createResponse.status === 403) {
                    throw new Error('Master Key权限不足或已失效，请检查API密钥');
                }
                throw new Error(`创建Bin失败: ${createResponse.status}`);
            }
            
            const createData = await createResponse.json();
            this.binId = createData.metadata.id;
            
            // 保存到localStorage供以后使用
            localStorage.setItem('feedbackBinId', this.binId);
            console.log('✅ 新Bin创建成功，ID:', this.binId);
            
            return {
                connected: true,
                message: '✅ 新Bin创建并连接成功',
                binId: this.binId,
                binExists: false,
                createdNew: true
            };
            
        } catch (error) {
            console.error('❌ JSONBin.io连接失败:', error.message);
            return {
                connected: false,
                message: `❌ 连接失败: ${error.message}`,
                usingFallback: true,
                error: error.message
            };
        }
    }

    /**
     * 获取完整的数据记录
     * @returns {Promise<Object>} 完整数据记录
     */
    async getFullRecord() {
        // 如果没有binId，先测试连接（会自动创建）
        if (!this.binId) {
            const connection = await this.testConnection();
            if (!connection.connected) {
                console.warn('使用本地模拟数据');
                return this.fallbackData;
            }
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    // Bin被意外删除，重新创建
                    console.warn('Bin不存在，重新创建...');
                    localStorage.removeItem('feedbackBinId');
                    this.binId = '';
                    const connection = await this.testConnection();
                    if (connection.connected) {
                        return this.fallbackData; // 返回初始数据
                    }
                }
                throw new Error(`获取数据失败: ${response.status}`);
            }
            
            const data = await response.json();
            return data.record || this.fallbackData;
        } catch (error) {
            console.error('获取数据失败，使用模拟数据:', error);
            return this.fallbackData;
        }
    }

    /**
     * 获取所有反馈数据
     * @returns {Promise<Array>} 反馈列表
     */
    async getFeedbacks() {
        const record = await this.getFullRecord();
        return record.feedbacks || [];
    }

    /**
     * 保存新的反馈
     * @param {Object} feedbackData 反馈数据
     * @returns {Promise<Object>} 保存结果
     */
    async saveFeedback(feedbackData) {
        try {
            // 1. 获取当前完整数据
            const currentRecord = await this.getFullRecord();
            
            // 2. 生成新反馈的ID
            const feedbackId = 'fb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // 3. 创建新反馈对象
            const newFeedback = {
                id: feedbackId,
                employeeName: feedbackData.employeeName || '匿名员工',
                type: feedbackData.type,
                typeText: this.getTypeText(feedbackData.type),
                content: feedbackData.content,
                images: feedbackData.images || [],
                status: 'pending',
                statusText: '待处理',
                timestamp: new Date().toISOString(),
                likes: 0,
                views: 0
            };
            
            // 4. 添加到反馈列表
            currentRecord.feedbacks.push(newFeedback);
            
            // 5. 更新统计信息
            this.updateStats(currentRecord);
            
            // 6. 更新最后修改时间
            currentRecord.system.lastUpdated = new Date().toISOString();
            
            // 7. 保存到JSONBin.io（需要Master Key）
            console.log('正在保存到JSONBin.io，Bin ID:', this.binId);
            
            const saveResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(currentRecord)
            });
            
            if (!saveResponse.ok) {
                console.warn('云端保存失败，数据仅保存在本地');
                // 本地保存
                localStorage.setItem('local_feedback_' + feedbackId, JSON.stringify(newFeedback));
                
                return {
                    success: true,
                    id: feedbackId,
                    message: '反馈已提交（本地保存）',
                    warning: '云端保存失败，请联系管理员检查Master Key'
                };
            }
            
            console.log('✅ 反馈保存到云端成功');
            
            return {
                success: true,
                id: feedbackId,
                message: '反馈已成功保存到云端',
                binId: this.binId
            };
            
        } catch (error) {
            console.error('保存反馈失败:', error);
            
            // 本地保存作为后备
            const feedbackId = 'fb_local_' + Date.now();
            localStorage.setItem('local_feedback_' + feedbackId, JSON.stringify({
                ...feedbackData,
                id: feedbackId,
                timestamp: new Date().toISOString()
            }));
            
            return {
                success: true,
                id: feedbackId,
                message: '反馈已提交（本地模式）',
                warning: '因网络问题，数据保存在本地，稍后会自动同步'
            };
        }
    }

    /**
     * 更新统计信息
     * @param {Object} record 数据记录
     */
    updateStats(record) {
        const stats = record.stats;
        const feedbacks = record.feedbacks || [];
        
        stats.total = feedbacks.length;
        stats.pending = feedbacks.filter(f => f.status === 'pending').length;
        stats.processed = feedbacks.filter(f => f.status === 'processed').length;
        
        // 按类型统计
        stats.suggestions = feedbacks.filter(f => f.type === 'suggestion').length;
        stats.problems = feedbacks.filter(f => f.type === 'problem').length;
        stats.complaints = feedbacks.filter(f => f.type === 'complaint').length;
        stats.others = feedbacks.filter(f => f.type === 'other').length;
    }

    // ... 其他方法（getTypeText, getStats等）保持不变 ...

    /**
     * 同步本地数据到云端（可选功能）
     */
    async syncLocalData() {
        try {
            // 获取所有本地保存的反馈
            const localKeys = Object.keys(localStorage).filter(key => key.startsWith('local_feedback_'));
            if (localKeys.length === 0) return;
            
            console.log(`发现 ${localKeys.length} 条本地待同步反馈`);
            
            const currentRecord = await this.getFullRecord();
            let syncedCount = 0;
            
            for (const key of localKeys) {
                try {
                    const localFeedback = JSON.parse(localStorage.getItem(key));
                    // 检查是否已存在
                    const exists = currentRecord.feedbacks.some(f => f.id === localFeedback.id);
                    if (!exists) {
                        currentRecord.feedbacks.push(localFeedback);
                        syncedCount++;
                    }
                    // 移除已处理的本地记录
                    localStorage.removeItem(key);
                } catch (error) {
                    console.error('同步单条反馈失败:', error);
                }
            }
            
            if (syncedCount > 0) {
                this.updateStats(currentRecord);
                currentRecord.system.lastUpdated = new Date().toISOString();
                
                // 保存到云端
                await fetch(`${this.baseUrl}/${this.binId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Master-Key': this.masterKey
                    },
                    body: JSON.stringify(currentRecord)
                });
                
                console.log(`✅ 成功同步 ${syncedCount} 条本地反馈到云端`);
            }
            
        } catch (error) {
            console.error('同步本地数据失败:', error);
        }
    }
}

// 全局存储实例
const jsonBinStorage = new JsonBinStorage();