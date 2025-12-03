class JsonBinStorage {
    constructor() {
        // ⚠️ 重要修改：硬编码固定Bin ID，禁止自动创建
        // 使用你提供的Bin ID: 692fb6c4d0ea881f400f2b52
        this.binId = '692fb6c4d0ea881f400f2b52'; // ← 固定使用这个
        
        // 保存到localStorage确保一致性
        localStorage.setItem('feedbackBinId', this.binId);
        console.log('📌 强制使用固定Bin ID:', this.binId);
        
        // API Keys保持不变
        this.readOnlyKey = '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m';
        this.masterKey = '$2a$10$SFoy1TAiSmFV8QC9HMK.v.vDSWo753EnwshUaK7880MIslM/elP0m';
        
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        
        // 删除模拟数据或简化它
        this.fallbackData = {
            feedbacks: [],
            stats: { total: 0, pending: 0, processed: 0, suggestions: 0, problems: 0, complaints: 0, others: 0 },
            system: { created: new Date().toISOString(), lastUpdated: new Date().toISOString(), version: '1.0.0' }
        };
    }