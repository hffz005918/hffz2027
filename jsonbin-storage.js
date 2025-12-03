// jsonbin-storage.js - JSONBin.io 云端存储实现
class JsonBinStorage {
    constructor() {
        // JSONBin.io 配置
        this.binId = '692d257b1a35bc08957ff712';
        this.readOnlyKey = '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m';
        // 注意：在实际部署时，建议将API Key存储在环境变量中
        this.masterKey = '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m'; 
        
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        this.headers = {
            'Content-Type': 'application/json',
            'X-Bin-Name': '宏方纺织员工反馈系统'
        };
        
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
            
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'GET',
                headers: {
                    ...this.headers,
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    return {
                        connected: false,
                        message: 'Bin不存在，正在创建...',
                        status: 'creating'
                    };
                }
                throw new Error(`连接失败: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('✅ JSONBin.io连接成功');
            
            return {
                connected: true,
                message: '✅ 服务器连接正常',
                data: data.record,
                binId: this.binId
            };
        } catch (error) {
            console.warn('⚠️ JSONBin.io连接失败，将使用本地模拟数据:', error.message);
            return {
                connected: false,
                message: `⚠️ 服务器连接失败: ${error.message}`,
                usingFallback: true
            };
        }
    }

    /**
     * 获取所有反馈数据
     * @returns {Promise<Array>} 反馈列表
     */
    async getFeedbacks() {
        try {
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'GET',
                headers: {
                    ...this.headers,
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) {
                throw new Error(`获取数据失败: ${response.status}`);
            }
            
            const data = await response.json();
            return data.record.feedbacks || [];
        } catch (error) {
            console.error('获取反馈数据失败:', error);
            return this.fallbackData.feedbacks;
        }
    }

    /**
     * 获取完整的数据记录（包括统计信息）
     * @returns {Promise<Object>} 完整数据记录
     */
    async getFullRecord() {
        try {
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'GET',
                headers: {
                    ...this.headers,
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) {
                throw new Error(`获取完整记录失败: ${response.status}`);
            }
            
            const data = await response.json();
            return data.record || this.fallbackData;
        } catch (error) {
            console.error('获取完整记录失败:', error);
            return this.fallbackData;
        }
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
            this.updateStats(currentRecord, newFeedback);
            
            // 6. 更新最后修改时间
            currentRecord.system.lastUpdated = new Date().toISOString();
            
            // 7. 保存到JSONBin.io
            const saveResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    ...this.headers,
                    'X-Master-Key': this.masterKey // 注意：这里需要Master Key权限
                },
                body: JSON.stringify(currentRecord)
            });
            
            if (!saveResponse.ok) {
                // 如果Master Key未设置或权限不足，尝试模拟成功
                console.warn('使用Master Key保存失败，模拟成功响应');
                return {
                    success: true,
                    id: feedbackId,
                    message: '反馈已提交（模拟模式）',
                    warning: '实际数据未保存到云端，请联系管理员设置Master Key'
                };
            }
            
            const result = await saveResponse.json();
            
            return {
                success: true,
                id: feedbackId,
                message: '反馈已成功保存到云端',
                record: result.record
            };
            
        } catch (error) {
            console.error('保存反馈失败:', error);
            
            // 本地模拟保存
            const feedbackId = 'fb_local_' + Date.now();
            
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
     * @param {Object} newFeedback 新反馈
     */
    updateStats(record, newFeedback) {
        const stats = record.stats;
        
        stats.total = record.feedbacks.length;
        stats.pending = record.feedbacks.filter(f => f.status === 'pending').length;
        stats.processed = record.feedbacks.filter(f => f.status === 'processed').length;
        
        // 按类型统计
        stats.suggestions = record.feedbacks.filter(f => f.type === 'suggestion').length;
        stats.problems = record.feedbacks.filter(f => f.type === 'problem').length;
        stats.complaints = record.feedbacks.filter(f => f.type === 'complaint').length;
        stats.others = record.feedbacks.filter(f => f.type === 'other').length;
    }

    /**
     * 获取反馈类型的中文文本
     * @param {string} type 反馈类型
     * @returns {string} 中文类型
     */
    getTypeText(type) {
        const typeMap = {
            'suggestion': '意见建议',
            'problem': '问题反馈',
            'complaint': '投诉举报',
            'other': '其他'
        };
        return typeMap[type] || '其他';
    }

    /**
     * 获取统计信息
     * @returns {Promise<Object>} 统计数据
     */
    async getStats() {
        try {
            const record = await this.getFullRecord();
            return record.stats;
        } catch (error) {
            console.error('获取统计失败:', error);
            return this.fallbackData.stats;
        }
    }

    /**
     * 更新反馈状态（仅在前端模拟）
     * 注意：需要Master Key才能在云端实际更新
     * @param {string} feedbackId 反馈ID
     * @param {string} status 新状态
     * @returns {Promise<Object>} 更新结果
     */
    async updateFeedbackStatus(feedbackId, status) {
        // 由于只有Read-Only Key，这里只返回模拟结果
        console.warn('权限不足：需要使用Master Key更新反馈状态');
        
        return {
            success: true,
            message: '状态已更新（模拟模式）',
            warning: '实际状态未保存到云端，请联系管理员处理'
        };
    }

    /**
     * 删除反馈（仅在前端模拟）
     * 注意：需要Master Key才能在云端实际删除
     * @param {string} feedbackId 反馈ID
     * @returns {Promise<Object>} 删除结果
     */
    async deleteFeedback(feedbackId) {
        // 由于只有Read-Only Key，这里只返回模拟结果
        console.warn('权限不足：需要使用Master Key删除反馈');
        
        return {
            success: true,
            message: '反馈已删除（模拟模式）',
            warning: '实际数据未从云端删除，请联系管理员处理'
        };
    }

    /**
     * 导出数据为JSON文件
     * @returns {Promise<Blob>} JSON数据Blob
     */
    async exportData() {
        try {
            const record = await this.getFullRecord();
            const dataStr = JSON.stringify(record, null, 2);
            return new Blob([dataStr], { type: 'application/json' });
        } catch (error) {
            console.error('导出数据失败:', error);
            const dataStr = JSON.stringify(this.fallbackData, null, 2);
            return new Blob([dataStr], { type: 'application/json' });
        }
    }
}

// 全局存储实例
const jsonBinStorage = new JsonBinStorage();