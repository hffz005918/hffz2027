// jsonbin-storage-server.js - 服务器端版本
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class JsonBinStorage {
    constructor(configPath = './jsonbin-config.json') {
        this.configPath = configPath;
        this.config = null;
        
        // API Keys - 从配置文件或环境变量读取
        this.readOnlyKey = process.env.JSONBIN_READ_KEY || '$2a$10$AOxCSd1PIW2XUkxQvRpVVeimltcnLXIoOlqvBvFJwlxCihUD2wope';
        this.masterKey = process.env.JSONBIN_MASTER_KEY || '$2a$10$AOxCSd1PIW2XUkxQvRpVVeimltcnLXIoOlqvBvFJwlxCihUD2wope';
        
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        this.apiBaseUrl = 'https://api.jsonbin.io/v3';
        
        this.initialized = false;
        
        console.log('🔄 JSONBin存储服务器端初始化');
    }
    
    /**
     * 加载配置文件
     */
    async loadConfig() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(data);
            
            if (this.config.binId) {
                this.binId = this.config.binId;
                console.log('✅ 从配置文件加载Bin ID:', this.binId);
                return true;
            }
        } catch (error) {
            // 如果配置文件不存在，创建默认配置
            if (error.code === 'ENOENT') {
                console.log('📄 配置文件不存在，将创建默认配置');
                this.config = {
                    binId: null,
                    storage: {
                        created: new Date().toISOString(),
                        version: '1.0'
                    }
                };
                await this.saveConfig();
            } else {
                console.warn('无法读取配置文件:', error.message);
            }
        }
        return false;
    }
    
    /**
     * 保存配置文件
     */
    async saveConfig() {
        try {
            // 确保目录存在
            const dir = path.dirname(this.configPath);
            await fs.mkdir(dir, { recursive: true });
            
            await fs.writeFile(
                this.configPath, 
                JSON.stringify(this.config, null, 2), 
                'utf8'
            );
            console.log('✅ 配置文件已保存:', this.configPath);
            return true;
        } catch (error) {
            console.error('❌ 保存配置文件失败:', error);
            return false;
        }
    }
    
    /**
     * 从配置加载Bin ID
     */
    async loadBinIdFromConfig() {
        if (!this.config) {
            await this.loadConfig();
        }
        return this.config?.binId || null;
    }
    
    /**
     * 保存Bin ID到配置
     */
    async saveBinIdToConfig(binId) {
        if (!this.config) {
            this.config = {
                binId: null,
                storage: {
                    created: new Date().toISOString(),
                    version: '1.0'
                }
            };
        }
        
        this.config.binId = binId;
        this.config.storage.lastUpdated = new Date().toISOString();
        this.binId = binId;
        
        return await this.saveConfig();
    }
    
    /**
     * 检查是否需要创建新的Bin
     */
    async checkAndCreateBinIfNeeded() {
        // 从配置加载Bin ID
        const existingBinId = await this.loadBinIdFromConfig();
        
        // 如果已经有Bin ID，验证它是否有效
        if (existingBinId) {
            this.binId = existingBinId;
            const testResult = await this.testConnection();
            
            if (testResult.connected) {
                console.log('✅ 使用现有Bin ID:', this.binId);
                this.initialized = true;
                return {
                    success: true,
                    message: `使用现有Bin: ${this.binId}`,
                    binId: this.binId,
                    existing: true
                };
            }
            
            console.warn('现有Bin ID无效，将创建新Bin');
        }
        
        // 创建新Bin
        return await this.createAndSetupNewBin();
    }
    
    /**
     * 自动创建和配置新的Bin
     */
    async createAndSetupNewBin() {
        console.log('🔄 正在创建新的JSONBin存储...');
        
        try {
            // 1. 创建新的Bin
            const createResponse = await fetch(`${this.apiBaseUrl}/b`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey,
                    'X-Bin-Private': 'false'
                },
                body: JSON.stringify({
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
                        version: '1.0'
                    },
                    meta: {
                        description: '员工反馈管理系统 - 服务器端',
                        version: '1.0',
                        autoGenerated: true,
                        generatedAt: new Date().toISOString()
                    }
                })
            });
            
            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                throw new Error(`创建失败: HTTP ${createResponse.status} - ${errorText}`);
            }
            
            const createData = await createResponse.json();
            const newBinId = createData.metadata.id;
            
            console.log('✅ 成功创建新Bin:', newBinId);
            
            // 2. 更新Bin ID到配置
            await this.saveBinIdToConfig(newBinId);
            
            // 3. 验证创建
            const verifyResponse = await fetch(`${this.baseUrl}/${newBinId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!verifyResponse.ok) {
                throw new Error('验证Bin创建失败');
            }
            
            const verifyData = await verifyResponse.json();
            console.log('✅ Bin验证成功:', verifyData.record?.meta?.description || '新Bin');
            
            this.initialized = true;
            
            return {
                success: true,
                message: '✅ 新Bin创建并配置成功!',
                binId: newBinId,
                existing: false,
                record: verifyData.record
            };
            
        } catch (error) {
            console.error('❌ 创建Bin失败:', error);
            return {
                success: false,
                message: `创建失败: ${error.message}`,
                binId: null
            };
        }
    }
    
    /**
     * 测试连接
     */
    async testConnection() {
        if (!this.binId) {
            return {
                connected: false,
                message: '❌ Bin ID未配置'
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
                    message: `❌ Bin ${this.binId} 不存在`
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
                feedbackCount: count,
                record: data.record
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
     * 初始化存储系统（自动检测或创建Bin）
     */
    async initialize() {
        if (this.initialized) {
            return {
                success: true,
                message: '存储系统已初始化',
                binId: this.binId
            };
        }
        
        console.log('🔄 初始化JSONBin存储系统...');
        return await this.checkAndCreateBinIfNeeded();
    }
    
    /**
     * 获取所有反馈
     */
    async getFeedbacks() {
        if (!this.initialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                console.warn('初始化失败，返回空数组');
                return [];
            }
        }
        
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
        if (!this.initialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return {
                    success: false,
                    message: '存储系统未初始化'
                };
            }
        }
        
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
            
            // 2. 创建新反馈（使用更安全的ID生成）
            const feedbackId = 'fb_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
            const newFeedback = {
                id: feedbackId,
                employeeName: feedbackData.employeeName || '匿名员工',
                type: feedbackData.type || 'other',
                content: feedbackData.content || '',
                images: feedbackData.images || [],
                status: 'pending',
                timestamp: new Date().toISOString(),
                source: 'server'
            };
            
            // 3. 添加到数组
            if (!record.feedbacks) record.feedbacks = [];
            record.feedbacks.push(newFeedback);
            
            // 4. 更新统计
            this.updateStats(record, newFeedback);
            
            // 5. 更新系统信息
            if (!record.system) record.system = {};
            record.system.lastUpdated = new Date().toISOString();
            
            // 6. 保存回云端
            const saveResponse = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!saveResponse.ok) {
                const errorText = await saveResponse.text();
                throw new Error(`保存失败: ${saveResponse.status} - ${errorText}`);
            }
            
            console.log('✅ 反馈保存成功:', newFeedback.id);
            
            return {
                success: true,
                id: newFeedback.id,
                message: '反馈已成功保存到云端',
                binId: this.binId,
                feedback: newFeedback
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
     * 更新统计信息
     */
    updateStats(record, newFeedback) {
        if (!record.stats) {
            record.stats = {
                total: 0,
                pending: 0,
                processed: 0,
                suggestions: 0,
                problems: 0,
                complaints: 0,
                others: 0
            };
        }
        
        // 重新计算统计
        record.stats.total = record.feedbacks.length;
        record.stats.pending = record.feedbacks.filter(f => f.status === 'pending').length;
        record.stats.processed = record.feedbacks.filter(f => f.status === 'processed').length;
        
        // 重置类型统计
        record.stats.suggestions = record.feedbacks.filter(f => f.type === 'suggestion').length;
        record.stats.problems = record.feedbacks.filter(f => f.type === 'problem').length;
        record.stats.complaints = record.feedbacks.filter(f => f.type === 'complaint').length;
        record.stats.others = record.feedbacks.filter(f => f.type === 'other').length;
    }
    
    /**
     * 获取统计
     */
    async getStats() {
        if (!this.initialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return this.getDefaultStats();
            }
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) {
                return this.getDefaultStats();
            }
            
            const data = await response.json();
            return data.record?.stats || this.getDefaultStats();
            
        } catch (error) {
            console.error('获取统计失败:', error);
            return this.getDefaultStats();
        }
    }
    
    /**
     * 获取默认统计
     */
    getDefaultStats() {
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
    
    /**
     * 更新反馈状态
     */
    async updateFeedbackStatus(feedbackId, newStatus) {
        if (!this.initialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return {
                    success: false,
                    message: '存储系统未初始化'
                };
            }
        }
        
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
            
            // 2. 查找并更新反馈
            if (!record.feedbacks || record.feedbacks.length === 0) {
                throw new Error('没有找到反馈数据');
            }
            
            const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
            if (feedbackIndex === -1) {
                throw new Error(`反馈ID ${feedbackId} 不存在`);
            }
            
            record.feedbacks[feedbackIndex].status = newStatus;
            record.feedbacks[feedbackIndex].processedAt = new Date().toISOString();
            
            // 3. 更新统计
            this.updateStats(record);
            
            // 4. 更新系统信息
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
                const errorText = await saveResponse.text();
                throw new Error(`保存失败: ${saveResponse.status} - ${errorText}`);
            }
            
            console.log(`✅ 反馈状态更新成功: ${feedbackId} -> ${newStatus}`);
            
            return {
                success: true,
                message: `反馈状态已更新为 ${newStatus}`,
                feedback: record.feedbacks[feedbackIndex]
            };
            
        } catch (error) {
            console.error('更新反馈状态失败:', error);
            return {
                success: false,
                message: '更新失败: ' + error.message
            };
        }
    }
    
    /**
     * 重置存储（创建新的Bin）
     */
    async resetStorage() {
        console.log('🔄 重置存储，创建新Bin...');
        
        // 重置配置
        this.config.binId = null;
        this.initialized = false;
        this.binId = null;
        
        // 保存空配置
        await this.saveConfig();
        
        // 创建新Bin
        return await this.createAndSetupNewBin();
    }
    
    /**
     * 获取存储状态信息
     */
    async getStorageInfo() {
        const connectionStatus = await this.testConnection();
        const stats = await this.getStats();
        
        return {
            binId: this.binId,
            initialized: this.initialized,
            configPath: this.configPath,
            connectionStatus,
            stats,
            configExists: this.config !== null
        };
    }
    
    /**
     * 导出数据到本地文件
     */
    async exportToFile(filePath = './feedback-backup.json') {
        try {
            const feedbacks = await this.getFeedbacks();
            const stats = await this.getStats();
            const info = await this.getStorageInfo();
            
            const exportData = {
                exportInfo: {
                    exportedAt: new Date().toISOString(),
                    binId: this.binId,
                    totalFeedbacks: feedbacks.length
                },
                stats,
                feedbacks,
                systemInfo: info
            };
            
            // 确保目录存在
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            
            await fs.writeFile(
                filePath,
                JSON.stringify(exportData, null, 2),
                'utf8'
            );
            
            console.log(`✅ 数据已导出到: ${filePath}`);
            
            return {
                success: true,
                filePath,
                count: feedbacks.length
            };
            
        } catch (error) {
            console.error('导出失败:', error);
            return {
                success: false,
                message: '导出失败: ' + error.message
            };
        }
    }
}

// Express.js 路由集成示例
function setupJsonBinRoutes(app, configPath) {
    const storage = new JsonBinStorage(configPath);
    
    // 初始化存储
    app.get('/api/jsonbin/init', async (req, res) => {
        try {
            const result = await storage.initialize();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '初始化失败: ' + error.message
            });
        }
    });
    
    // 获取存储状态
    app.get('/api/jsonbin/status', async (req, res) => {
        try {
            const info = await storage.getStorageInfo();
            res.json(info);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '获取状态失败: ' + error.message
            });
        }
    });
    
    // 获取所有反馈
    app.get('/api/jsonbin/feedbacks', async (req, res) => {
        try {
            const feedbacks = await storage.getFeedbacks();
            res.json({
                success: true,
                count: feedbacks.length,
                feedbacks
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '获取反馈失败: ' + error.message
            });
        }
    });
    
    // 提交新反馈
    app.post('/api/jsonbin/feedback', async (req, res) => {
        try {
            const result = await storage.saveFeedback(req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '保存反馈失败: ' + error.message
            });
        }
    });
    
    // 获取统计信息
    app.get('/api/jsonbin/stats', async (req, res) => {
        try {
            const stats = await storage.getStats();
            res.json({
                success: true,
                stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '获取统计失败: ' + error.message
            });
        }
    });
    
    // 更新反馈状态
    app.put('/api/jsonbin/feedback/:id/status', async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            
            if (!status) {
                return res.status(400).json({
                    success: false,
                    message: '状态不能为空'
                });
            }
            
            const result = await storage.updateFeedbackStatus(id, status);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '更新状态失败: ' + error.message
            });
        }
    });
    
    // 重置存储
    app.post('/api/jsonbin/reset', async (req, res) => {
        try {
            const result = await storage.resetStorage();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '重置失败: ' + error.message
            });
        }
    });
    
    // 导出数据
    app.get('/api/jsonbin/export', async (req, res) => {
        try {
            const result = await storage.exportToFile();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '导出失败: ' + error.message
            });
        }
    });
    
    return storage;
}

// 独立运行示例
if (require.main === module) {
    // 直接运行此文件时的测试代码
    async function testJsonBinStorage() {
        console.log('🧪 测试JSONBin存储服务器端...');
        
        const storage = new JsonBinStorage();
        
        // 1. 初始化
        console.log('\n1. 初始化存储...');
        const initResult = await storage.initialize();
        console.log('初始化结果:', initResult);
        
        if (!initResult.success) {
            console.error('❌ 初始化失败，停止测试');
            return;
        }
        
        // 2. 测试连接
        console.log('\n2. 测试连接...');
        const connection = await storage.testConnection();
        console.log('连接状态:', connection.message);
        
        // 3. 获取当前统计
        console.log('\n3. 获取统计信息...');
        const stats = await storage.getStats();
        console.log('当前统计:', stats);
        
        // 4. 获取所有反馈
        console.log('\n4. 获取所有反馈...');
        const feedbacks = await storage.getFeedbacks();
        console.log(`当前反馈数量: ${feedbacks.length}`);
        
        // 5. 提交测试反馈
        console.log('\n5. 提交测试反馈...');
        const testFeedback = {
            employeeName: '测试员工',
            type: 'suggestion',
            content: '这是一个来自服务器端的测试反馈',
            images: []
        };
        
        const saveResult = await storage.saveFeedback(testFeedback);
        console.log('保存结果:', saveResult.success ? '✅ 成功' : '❌ 失败');
        
        // 6. 获取更新后的统计
        console.log('\n6. 获取更新后的统计...');
        const newStats = await storage.getStats();
        console.log('更新后统计:', newStats);
        
        // 7. 获取存储信息
        console.log('\n7. 获取完整存储信息...');
        const info = await storage.getStorageInfo();
        console.log('存储信息:', {
            binId: info.binId,
            initialized: info.initialized,
            connectionStatus: info.connectionStatus.message
        });
        
        console.log('\n✅ 测试完成!');
    }
    
    // 运行测试
    testJsonBinStorage().catch(console.error);
}

module.exports = {
    JsonBinStorage,
    setupJsonBinRoutes
};