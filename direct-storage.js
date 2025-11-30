// direct-storage.js - 直接文件操作的存储管理器
class DirectStorage {
    constructor() {
        // 尝试不同的服务器文件
        this.serverFiles = [
            'server-simple.php',
            'server-get.php', 
            'server.php'
        ];
        this.currentServerFile = null;
    }

    // 测试哪个服务器文件可用
    async findWorkingServer() {
        for (const file of this.serverFiles) {
            try {
                console.log(`测试服务器文件: ${file}`);
                const response = await fetch(`${file}?action=test`);
                const text = await response.text();
                
                // 检查是否是有效的JSON
                try {
                    const data = JSON.parse(text);
                    if (data.success) {
                        this.currentServerFile = file;
                        console.log(`✅ 找到可用的服务器文件: ${file}`);
                        return true;
                    }
                } catch (e) {
                    console.log(`❌ ${file} 返回无效JSON:`, text.substring(0, 100));
                }
            } catch (error) {
                console.log(`❌ ${file} 请求失败:`, error.message);
            }
        }
        
        console.error('❌ 没有找到可用的服务器文件');
        return false;
    }

    async request(params = {}) {
        // 如果没有找到可用的服务器文件，先寻找
        if (!this.currentServerFile) {
            const found = await this.findWorkingServer();
            if (!found) {
                throw new Error('没有可用的服务器');
            }
        }

        const urlParams = new URLSearchParams(params);
        const url = `${this.currentServerFile}?${urlParams.toString()}`;
        
        console.log('发送请求:', url);

        try {
            const response = await fetch(url);
            const text = await response.text();
            
            console.log('服务器响应:', text);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // 解析JSON
            const data = JSON.parse(text);
            
            if (!data.success) {
                throw new Error(data.error || '操作失败');
            }

            return data;
        } catch (error) {
            console.error('请求失败:', error);
            throw error;
        }
    }

    async getFeedbacks() {
        const result = await this.request({ action: 'get_all' });
        return result.data || [];
    }

    async saveFeedback(feedbackData) {
        const encodedData = encodeURIComponent(JSON.stringify(feedbackData));
        const result = await this.request({
            action: 'save_feedback',
            data: encodedData
        });
        
        return {
            success: true,
            id: result.id,
            message: result.message
        };
    }

    async updateFeedbackStatus(feedbackId, status) {
        await this.request({
            action: 'update_status',
            id: feedbackId,
            status: status
        });
        return { success: true };
    }

    async deleteFeedback(feedbackId) {
        await this.request({
            action: 'delete_feedback',
            id: feedbackId
        });
        return { success: true };
    }

    async testConnection() {
        await this.request({ action: 'test' });
        return { 
            success: true, 
            message: '服务器连接正常',
            serverFile: this.currentServerFile
        };
    }
}