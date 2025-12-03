// jsonbin-storage-fixed.js - 固定Bin ID的服务器端版本
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class JsonBinStorage {
    constructor() {
        // 固定Bin ID - 一旦生成就不再改变
        this.binId = null;
        
        // API Keys - 从环境变量读取
        this.readOnlyKey = process.env.JSONBIN_READ_KEY || '$2a$10$AOxCSd1PIW2XUkxQvRpVVeimltcnLXIoOlqvBvFJwlxCihUD2wope';
        this.masterKey = process.env.JSONBIN_MASTER_KEY || '$2a$10$AOxCSd1PIW2XUkxQvRpVVeimltcnLXIoOlqvBvFJwlxCihUD2wope';
        
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        this.apiBaseUrl = 'https://api.jsonbin.io/v3';
        
        this.initialized = false;
        this.binCreated = false; // 标记Bin是否已创建
        
        console.log('🔄 固定Bin ID JSONBin存储系统初始化');
    }
    
    /**
     * 初始化存储系统
     * 如果已有Bin ID，直接使用；否则创建新Bin并固定使用
     */
    async initialize() {
        if (this.initialized && this.binId) {
            console.log('✅ 存储系统已初始化，使用固定Bin:', this.binId);
            return {
                success: true,
                message: `存储系统已初始化，使用固定Bin: ${this.binId}`,
                binId: this.binId,
                binCreated: this.binCreated
            };
        }
        
        console.log('🔄 初始化JSONBin存储系统...');
        
        // 检查是否已有Bin ID（从第一次创建时保存）
        const existingBinId = await this.loadFixedBinId();
        
        if (existingBinId) {
            // 使用已有的固定Bin ID
            this.binId = existingBinId;
            this.binCreated = true;
            
            // 测试连接
            const testResult = await this.testConnection();
            if (testResult.connected) {
                this.initialized = true;
                console.log(`✅ 使用固定Bin ID: ${this.binId}`);
                
                return {
                    success: true,
                    message: `✅ 使用固定Bin: ${this.binId}`,
                    binId: this.binId,
                    binCreated: true,
                    existing: true
                };
            } else {
                console.warn(`固定Bin ID ${existingBinId} 无效:`, testResult.message);
                // 如果固定Bin无效，尝试重新创建
                return await this.createAndFixNewBin();
            }
        } else {
            // 首次使用，创建新Bin并固定
            return await this.createAndFixNewBin();
        }
    }
    
    /**
     * 创建新Bin并固定使用
     */
    async createAndFixNewBin() {
        console.log('🔄 正在创建新的JSONBin存储并固定使用...');
        
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
                        version: '1.0',
                        fixed: true, // 标记为固定Bin
                        fixedAt: new Date().toISOString()
                    },
                    meta: {
                        description: '员工反馈管理系统 - 固定Bin版本',
                        version: '1.0',
                        fixed: true,
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
            
            // 2. 固定Bin ID（保存到文件，不再更改）
            await this.saveFixedBinId(newBinId);
            this.binId = newBinId;
            this.binCreated = true;
            
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
                message: '✅ 新Bin创建并固定成功!',
                binId: newBinId,
                binCreated: true,
                existing: false,
                record: verifyData.record
            };
            
        } catch (error) {
            console.error('❌ 创建固定Bin失败:', error);
            return {
                success: false,
                message: `创建失败: ${error.message}`,
                binId: null
            };
        }
    }
    
    /**
     * 保存固定Bin ID到文件
     */
    async saveFixedBinId(binId) {
        try {
            const configDir = path.join(process.cwd(), 'config');
            const configFile = path.join(configDir, 'fixed-bin.json');
            
            // 确保目录存在
            await fs.mkdir(configDir, { recursive: true });
            
            const configData = {
                binId: binId,
                fixed: true,
                createdAt: new Date().toISOString(),
                lastAccessed: new Date().toISOString(),
                note: '此Bin ID已固定，不再更改'
            };
            
            await fs.writeFile(
                configFile,
                JSON.stringify(configData, null, 2),
                'utf8'
            );
            
            console.log(`✅ 固定Bin ID已保存: ${binId}`);
            return true;
            
        } catch (error) {
            console.error('❌ 保存固定Bin ID失败:', error);
            return false;
        }
    }
    
    /**
     * 从文件加载固定Bin ID
     */
    async loadFixedBinId() {
        try {
            const configFile = path.join(process.cwd(), 'config', 'fixed-bin.json');
            
            // 检查文件是否存在
            try {
                await fs.access(configFile);
            } catch {
                return null; // 文件不存在
            }
            
            const data = await fs.readFile(configFile, 'utf8');
            const config = JSON.parse(data);
            
            if (config.binId && config.fixed) {
                // 更新最后访问时间
                config.lastAccessed = new Date().toISOString();
                await fs.writeFile(configFile, JSON.stringify(config, null, 2), 'utf8');
                
                console.log(`📂 加载固定Bin ID: ${config.binId}`);
                return config.binId;
            }
            
            return null;
            
        } catch (error) {
            console.warn('无法加载固定Bin ID:', error.message);
            return null;
        }
    }
    
    /**
     * 强制使用指定Bin ID（仅在无固定Bin时可用）
     */
    async useSpecificBinId(binId) {
        // 检查是否已有固定Bin
        const existingBinId = await this.loadFixedBinId();
        
        if (existingBinId) {
            console.warn(`已有固定Bin ID: ${existingBinId}，无法更改`);
            return {
                success: false,
                message: `已有固定Bin ID: ${existingBinId}，无法更改为其他Bin`
            };
        }
        
        // 验证Bin ID有效性
        this.binId = binId;
        const testResult = await this.testConnection();
        
        if (testResult.connected) {
            // 保存为固定Bin
            await this.saveFixedBinId(binId);
            this.initialized = true;
            this.binCreated = false; // 不是新创建的
            
            console.log(`✅ 使用指定Bin ID并固定: ${binId}`);
            
            return {
                success: true,
                message: `✅ 使用指定Bin ID并固定: ${binId}`,
                binId: binId,
                binCreated: false,
                fixed: true
            };
        } else {
            this.binId = null;
            return {
                success: false,
                message: `指定Bin ID无效: ${testResult.message}`
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
            
            // 2. 创建新反馈
            const feedbackId = 'fb_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
            const newFeedback = {
                id: feedbackId,
                employeeName: feedbackData.employeeName || '匿名员工',
                type: feedbackData.type || 'other',
                content: feedbackData.content || '',
                images: feedbackData.images || [],
                status: 'pending',
                timestamp: new Date().toISOString(),
                source: 'fixed-bin-server'
            };
            
            // 3. 添加到数组
            if (!record.feedbacks) record.feedbacks = [];
            record.feedbacks.push(newFeedback);
            
            // 4. 更新统计
            this.updateStats(record);
            
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
            
            console.log(`✅ 反馈保存到固定Bin: ${newFeedback.id}`);
            
            return {
                success: true,
                id: newFeedback.id,
                message: `反馈已保存到固定Bin: ${this.binId}`,
                binId: this.binId,
                binFixed: true,
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
    updateStats(record) {
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
                binId: this.binId,
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
     * 获取存储状态信息
     */
    async getStorageInfo() {
        const connectionStatus = await this.testConnection();
        const stats = await this.getStats();
        
        return {
            binId: this.binId,
            fixed: true, // 始终固定
            initialized: this.initialized,
            binCreated: this.binCreated,
            connectionStatus,
            stats,
            configFile: path.join(process.cwd(), 'config', 'fixed-bin.json')
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
                    fixedBin: true,
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
            
            console.log(`✅ 数据已从固定Bin导出到: ${filePath}`);
            
            return {
                success: true,
                filePath,
                count: feedbacks.length,
                binId: this.binId
            };
            
        } catch (error) {
            console.error('导出失败:', error);
            return {
                success: false,
                message: '导出失败: ' + error.message
            };
        }
    }
    
    /**
     * 清除固定Bin配置（危险操作，仅用于特殊情况）
     */
    async clearFixedBin() {
        try {
            const configFile = path.join(process.cwd(), 'config', 'fixed-bin.json');
            
            // 检查文件是否存在
            try {
                await fs.access(configFile);
            } catch {
                return {
                    success: false,
                    message: '固定Bin配置文件不存在'
                };
            }
            
            // 备份原配置
            const backupFile = path.join(process.cwd(), 'config', `fixed-bin-backup-${Date.now()}.json`);
            const configData = await fs.readFile(configFile, 'utf8');
            await fs.writeFile(backupFile, configData, 'utf8');
            
            // 删除配置文件
            await fs.unlink(configFile);
            
            // 重置状态
            this.binId = null;
            this.initialized = false;
            this.binCreated = false;
            
            console.log('⚠️ 固定Bin配置已清除，下次将创建新Bin');
            
            return {
                success: true,
                message: '固定Bin配置已清除',
                backupFile: backupFile
            };
            
        } catch (error) {
            console.error('清除固定Bin失败:', error);
            return {
                success: false,
                message: '清除失败: ' + error.message
            };
        }
    }
}

// Express.js 路由集成
function setupFixedJsonBinRoutes(app) {
    const storage = new JsonBinStorage();
    
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
                fixedBin: true,
                binId: storage.binId,
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
                fixedBin: true,
                binId: storage.binId,
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
    
    // 使用指定Bin ID（仅在无固定Bin时可用）
    app.post('/api/jsonbin/use-bin', async (req, res) => {
        try {
            const { binId } = req.body;
            
            if (!binId) {
                return res.status(400).json({
                    success: false,
                    message: 'Bin ID不能为空'
                });
            }
            
            const result = await storage.useSpecificBinId(binId);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '设置Bin ID失败: ' + error.message
            });
        }
    });
    
    // 清除固定Bin配置（危险操作）
    app.delete('/api/jsonbin/clear-fixed', async (req, res) => {
        try {
            const result = await storage.clearFixedBin();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '清除失败: ' + error.message
            });
        }
    });
    
    return storage;
}

// 独立运行示例
if (require.main === module) {
    // 直接运行此文件时的测试代码
    async function testFixedJsonBinStorage() {
        console.log('🧪 测试固定Bin ID JSONBin存储...');
        
        const storage = new JsonBinStorage();
        
        // 1. 初始化（将创建或使用固定Bin）
        console.log('\n1. 初始化存储...');
        const initResult = await storage.initialize();
        console.log('初始化结果:', {
            success: initResult.success,
            message: initResult.message,
            binId: initResult.binId,
            binCreated: initResult.binCreated
        });
        
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
            employeeName: '固定Bin测试员工',
            type: 'suggestion',
            content: '这是一个来自固定Bin系统的测试反馈',
            images: []
        };
        
        const saveResult = await storage.saveFeedback(testFeedback);
        console.log('保存结果:', saveResult.success ? '✅ 成功' : '❌ 失败');
        
        // 6. 再次初始化（应该使用固定Bin，不会创建新Bin）
        console.log('\n6. 再次初始化测试...');
        const reinitResult = await storage.initialize();
        console.log('再次初始化结果:', reinitResult.message);
        
        // 7. 获取存储信息
        console.log('\n7. 获取完整存储信息...');
        const info = await storage.getStorageInfo();
        console.log('存储信息:', {
            binId: info.binId,
            fixed: info.fixed,
            initialized: info.initialized
        });
        
        console.log('\n✅ 固定Bin测试完成!');
        console.log(`📦 固定Bin ID: ${storage.binId}`);
        console.log('🔒 此Bin ID已固定，服务器重启后仍会使用同一个Bin');
    }
    
    // 运行测试
    testFixedJsonBinStorage().catch(console.error);
}

module.exports = {
    JsonBinStorage,
    setupFixedJsonBinRoutes
};