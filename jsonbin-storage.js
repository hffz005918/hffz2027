// jsonbin-storage-10kb.js - 单张图片压缩到10KB以内
class JsonBinStorage {
    constructor() {
        this.binId = '69304a8bd0ea881f401049f7';
        this.readOnlyKey = '$2a$10$AOxCSd1PIW2XUkxQvRpVVeimltcnLXIoOlqvBvFJwlxCihUD2wope';
        this.masterKey = '$2a$10$AOxCSd1PIW2XUkxQvRpVVeimltcnLXIoOlqvBvFJwlxCihUD2wope';
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        
        console.log('🔄 JSONBin存储（10KB压缩版）初始化');
        
        // 极端压缩配置 - 确保单张图片Base64后<10KB
        this.compressionConfig = {
            maxImageSize: 8 * 1024,      // 单张图片最大8KB（Base64前）
            targetImageSize: 6 * 1024,   // 目标6KB
            maxWidth: 600,               // 最大宽度600px
            maxHeight: 600,              // 最大高度600px
            quality: 0.4,                // 起始质量0.4（已经很低了）
            minQuality: 0.1,             // 最低质量0.1
            ultraLowQuality: 0.05,       // 极端情况质量
            maxIterations: 15            // 更多迭代次数
        };
    }
    
    /**
     * 测试连接
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const count = data.record?.feedbacks?.length || 0;
            const recordSize = JSON.stringify(data.record).length;
            
            return {
                connected: true,
                message: `✅ 连接成功 (${count}条反馈，${(recordSize/1024).toFixed(1)}KB)`,
                binId: this.binId,
                feedbackCount: count,
                recordSize: recordSize
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
     * 极端压缩图片到10KB以内
     */
    async compressTo10KB(file) {
        try {
            console.log(`📊 开始极端压缩: ${file.name} (${(file.size/1024).toFixed(1)}KB)`);
            
            const originalBase64 = await this.fileToBase64(file);
            const img = new Image();
            
            return new Promise((resolve, reject) => {
                img.onload = () => {
                    try {
                        let canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        // 初始尺寸
                        let width = img.width;
                        let height = img.height;
                        
                        console.log(`  原始尺寸: ${width} x ${height}`);
                        
                        // 第一步：立即大幅缩小尺寸
                        const maxDimension = Math.max(width, height);
                        let scale = 1;
                        
                        if (maxDimension > 1000) {
                            scale = 400 / maxDimension; // 大幅缩小
                        } else if (maxDimension > 600) {
                            scale = this.compressionConfig.maxWidth / maxDimension;
                        }
                        
                        width = Math.round(width * scale);
                        height = Math.round(height * scale);
                        
                        // 确保最小尺寸
                        width = Math.max(width, 100);
                        height = Math.max(height, 100);
                        
                        console.log(`  初始缩小: ${width} x ${height} (缩放: ${scale.toFixed(3)})`);
                        
                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // 极端压缩循环
                        let quality = this.compressionConfig.quality;
                        let compressedData = canvas.toDataURL('image/jpeg', quality);
                        let currentSize = this.getBase64Size(compressedData);
                        let iteration = 0;
                        
                        console.log(`  初始压缩: ${(currentSize/1024).toFixed(2)}KB (质量: ${quality})`);
                        
                        // 循环压缩直到满足要求
                        while (currentSize > this.compressionConfig.maxImageSize && 
                               iteration < this.compressionConfig.maxIterations) {
                            iteration++;
                            
                            // 第一步：快速降低质量
                            if (currentSize > 20 * 1024) {
                                quality = Math.max(0.1, quality * 0.7);
                            } else if (currentSize > 15 * 1024) {
                                quality = Math.max(0.08, quality * 0.8);
                            } else {
                                quality = Math.max(this.compressionConfig.minQuality, quality * 0.9);
                            }
                            
                            compressedData = canvas.toDataURL('image/jpeg', quality);
                            currentSize = this.getBase64Size(compressedData);
                            
                            console.log(`  迭代 ${iteration}: ${(currentSize/1024).toFixed(2)}KB (质量: ${quality.toFixed(3)})`);
                            
                            // 第二步：如果质量已经很低但仍然太大，进一步缩小尺寸
                            if (quality <= this.compressionConfig.minQuality && 
                                currentSize > this.compressionConfig.maxImageSize &&
                                width > 150 && height > 150) {
                                
                                width = Math.round(width * 0.7);
                                height = Math.round(height * 0.7);
                                canvas.width = width;
                                canvas.height = height;
                                ctx.drawImage(img, 0, 0, width, height);
                                quality = 0.3; // 重置质量
                                
                                console.log(`  再次缩小尺寸: ${width} x ${height}`);
                            }
                            
                            // 最终手段：极端低质量
                            if (iteration >= 10 && currentSize > this.compressionConfig.maxImageSize) {
                                compressedData = canvas.toDataURL('image/jpeg', this.compressionConfig.ultraLowQuality);
                                currentSize = this.getBase64Size(compressedData);
                                console.log(`  极端压缩: ${(currentSize/1024).toFixed(2)}KB (质量: ${this.compressionConfig.ultraLowQuality})`);
                                break;
                            }
                            
                            if (currentSize <= this.compressionConfig.targetImageSize) {
                                break;
                            }
                        }
                        
                        // 创建非常小的缩略图（50x50以内）
                        const thumbnailCanvas = document.createElement('canvas');
                        const thumbnailCtx = thumbnailCanvas.getContext('2d');
                        
                        let thumbWidth = 50;
                        let thumbHeight = Math.round((50 / width) * height);
                        if (thumbHeight > 50) {
                            thumbHeight = 50;
                            thumbWidth = Math.round((50 / height) * width);
                        }
                        
                        thumbnailCanvas.width = thumbWidth;
                        thumbnailCanvas.height = thumbHeight;
                        thumbnailCtx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
                        const thumbnail = thumbnailCanvas.toDataURL('image/jpeg', 0.5);
                        
                        console.log(`✅ 极端压缩完成: ${(currentSize/1024).toFixed(2)}KB (${width}x${height}, 质量: ${quality.toFixed(3)})`);
                        
                        resolve({
                            url: compressedData,
                            thumbnail: thumbnail,
                            originalSize: file.size,
                            compressedSize: currentSize,
                            quality: quality,
                            dimensions: { width, height },
                            thumbDimensions: { width: thumbWidth, height: thumbHeight },
                            iterations: iteration,
                            compressionRatio: ((1 - currentSize / file.size) * 100).toFixed(1)
                        });
                        
                    } catch (error) {
                        reject(error);
                    }
                };
                
                img.onerror = reject;
                img.src = originalBase64;
            });
            
        } catch (error) {
            console.error('极端压缩失败:', error);
            throw error;
        }
    }
    
    /**
     * 文件转Base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
    
    /**
     * 获取Base64字符串的大小
     */
    getBase64Size(base64String) {
        if (!base64String) return 0;
        const base64Data = base64String.split(',')[1] || base64String;
        const stringLength = base64Data.length;
        const sizeInBytes = (stringLength * 3) / 4;
        const paddingCount = (base64Data.endsWith('==') ? 2 : (base64Data.endsWith('=') ? 1 : 0));
        return sizeInBytes - paddingCount;
    }
    
    /**
     * 上传图片（强制压缩到10KB以内）
     */
    async uploadImage(file) {
        try {
            console.log(`📤 上传图片: ${file.name}`);
            
            const compressed = await this.compressTo10KB(file);
            
            // 验证大小
            if (compressed.compressedSize > 10 * 1024) {
                console.warn(`⚠️ 警告：图片压缩后 ${(compressed.compressedSize/1024).toFixed(2)}KB 仍大于10KB`);
            }
            
            return {
                success: true,
                url: compressed.url,
                thumbnail: compressed.thumbnail,
                originalName: file.name,
                originalSize: file.size,
                compressedSize: Math.round(compressed.compressedSize),
                isBase64: true,
                mimeType: file.type,
                uploadTime: new Date().toISOString(),
                quality: compressed.quality,
                dimensions: compressed.dimensions,
                compressionRatio: compressed.compressionRatio + '%',
                iterations: compressed.iterations
            };
            
        } catch (error) {
            console.error('图片上传失败:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * 批量上传图片
     */
    async uploadImages(files) {
        if (!files || files.length === 0) {
            return [];
        }
        
        // 限制图片数量
        const filesToUpload = files.slice(0, 5);
        if (files.length > 5) {
            console.warn('最多上传5张图片，已限制数量');
        }
        
        const uploadResults = [];
        
        console.log(`开始上传 ${filesToUpload.length} 张图片（10KB压缩）...`);
        
        for (let i = 0; i < filesToUpload.length; i++) {
            const file = filesToUpload[i];
            
            if (!file.type.startsWith('image/')) {
                console.warn('❌ 跳过非图片文件:', file.name);
                continue;
            }
            
            try {
                if (window.updateImageUploadProgress) {
                    const progress = Math.round((i / filesToUpload.length) * 100);
                    window.updateImageUploadProgress(progress, `正在极端压缩第 ${i + 1}/${filesToUpload.length} 张图片`);
                }
                
                const result = await this.uploadImage(file);
                
                if (result.success) {
                    uploadResults.push(result);
                    console.log(`✅ 图片 ${file.name} 压缩成功: ${(result.originalSize/1024).toFixed(0)}KB -> ${(result.compressedSize/1024).toFixed(2)}KB`);
                } else {
                    console.warn(`❌ 图片 ${file.name} 上传失败:`, result.message);
                }
                
            } catch (error) {
                console.error(`图片 ${file.name} 处理异常:`, error);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`✅ 图片极端压缩完成，成功: ${uploadResults.length} 张`);
        
        // 计算总大小
        const totalImageSize = uploadResults.reduce((sum, img) => sum + img.compressedSize, 0);
        console.log(`📊 图片总大小: ${(totalImageSize/1024).toFixed(2)}KB`);
        
        return uploadResults;
    }
    
    /**
     * 计算JSON数据大小（精确）
     */
    calculateDataSize(data) {
        // 估算JSON.stringify后的大小
        const jsonString = JSON.stringify(data);
        const size = new Blob([jsonString]).size;
        return size;
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
            return [];
        }
        
        const data = await response.json();
        const feedbacks = data.record?.feedbacks || [];
        
        // 确保用户ID存在
        if (!window.currentUserId) {
            window.currentUserId = 'anonymous';
        }
        
        // 处理每个反馈
        feedbacks.forEach(feedback => {
            if (!feedback.id) feedback.id = 'fb_' + Date.now().toString(36);
            
            // 使用简化的字段名
            if (!feedback.cm) feedback.cm = feedback.comments || [];
            if (!feedback.l) feedback.l = { c: 0, u: [] };
            if (!feedback.i) feedback.i = feedback.images || [];
            
            // 确保点赞数据结构正确
            if (!feedback.l.u) feedback.l.u = [];
            if (typeof feedback.l.c !== 'number') feedback.l.c = 0;
            
            // 检查用户是否点赞了该反馈
            feedback.userLiked = Array.isArray(feedback.l.u) && feedback.l.u.includes(window.currentUserId);
            
            // 处理评论
            if (feedback.cm && feedback.cm.length > 0) {
                feedback.cm.forEach(comment => {
                    if (!comment.id) comment.id = 'cm_' + Date.now().toString(36);
                    if (!comment.l) comment.l = { c: 0, u: [] };
                    
                    // 确保评论点赞数据结构正确
                    if (!comment.l.u) comment.l.u = [];
                    if (typeof comment.l.c !== 'number') comment.l.c = 0;
                    
                    // 检查用户是否点赞了该评论
                    comment.userLiked = Array.isArray(comment.l.u) && comment.l.u.includes(window.currentUserId);
                    comment.likesCount = comment.l.c; // 确保有 likesCount 字段
                });
            }
        });
        
        return feedbacks;
        
    } catch (error) {
        return [];
    }
}
    
    /**
     * 获取记录
     */
    async getRecord() {
        try {
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': this.readOnlyKey
                }
            });
            
            if (!response.ok) {
                throw new Error(`获取记录失败: ${response.status}`);
            }
            
            const data = await response.json();
            return data.record || { feedbacks: [] };
        } catch (error) {
            console.error('获取记录失败:', error);
            return { feedbacks: [] };
        }
    }
    
    /**
     * 更新记录（严格检查）
     */
    async updateRecord(record) {
        try {
            // 精确计算大小
            const recordSize = this.calculateDataSize(record);
            console.log(`📦 更新记录，大小: ${(recordSize / 1024).toFixed(2)}KB`);
            
            if (recordSize > 100 * 1024) {
                throw new Error(`记录大小 ${(recordSize/1024).toFixed(2)}KB 超过100KB限制`);
            }
            
            if (recordSize > 95 * 1024) {
                console.warn(`⚠️ 警告：记录大小 ${(recordSize/1024).toFixed(2)}KB 接近100KB限制`);
            }
            
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            console.log('✅ 记录更新成功');
            return data;
            
        } catch (error) {
            console.error('❌ 更新记录失败:', error);
            throw error;
        }
    }
    
    /**
     * 保存反馈（智能清理）
     */
    async saveFeedback(feedbackData) {
        try {
            console.log('💾 开始保存反馈数据（10KB压缩版）...');
            
            if (window.updateUploadProgress) {
                window.updateUploadProgress(10, '正在准备上传...');
            }
            
            let uploadedImages = [];
            if (feedbackData.imageFiles && feedbackData.imageFiles.length > 0) {
                console.log('📤 开始极端压缩图片...');
                if (window.updateUploadProgress) {
                    window.updateUploadProgress(30, '正在极端压缩图片...');
                }
                
                uploadedImages = await this.uploadImages(feedbackData.imageFiles);
                console.log('✅ 图片极端压缩完成');
                
                if (window.updateUploadProgress) {
                    window.updateUploadProgress(70, '图片压缩完成，正在处理数据...');
                }
            }
            
            // 获取当前记录
            const record = await this.getRecord();
            
            // 创建新反馈（优化数据结构，减少字段）
            const newFeedback = {
                id: 'fb_' + Date.now().toString(36),
                n: feedbackData.employeeName?.substring(0, 20) || '匿名', // 缩短字段名
                t: feedbackData.type, // 类型
                c: feedbackData.content.substring(0, 500), // 内容限制500字
                i: uploadedImages.map(img => ({
                    u: img.url,
                    t: img.thumbnail,
                    n: img.originalName?.substring(0, 20)
                })),
                s: 'pending',
                cm: [], // 评论
                l: { c: 0, u: [] }, // 点赞
                ts: Date.now() // 时间戳
            };
            
            // 添加到数组开头
            if (!record.feedbacks) record.feedbacks = [];
            record.feedbacks.unshift(newFeedback);
            
            // 自动清理保持数据量合理
            const maxFeedbacks = 20; // 最多保留20条反馈
            if (record.feedbacks.length > maxFeedbacks) {
                console.log(`🧹 清理旧数据，保留最新的${maxFeedbacks}条`);
                record.feedbacks = record.feedbacks.slice(0, maxFeedbacks);
            }
            
            // 简化统计信息
            record.stats = {
                t: record.feedbacks.length,
                p: record.feedbacks.filter(f => f.s === 'pending').length,
                d: record.feedbacks.filter(f => f.s === 'processed').length
            };
            
            record.sys = {
                lu: Date.now(),
                v: '4.0'
            };
            
            // 计算总大小
            const recordSize = this.calculateDataSize(record);
            console.log(`📊 最终记录大小: ${(recordSize / 1024).toFixed(2)}KB`);
            
            // 如果仍然太大，强制清理图片数据
            if (recordSize > 90 * 1024) {
                console.log('⚠️ 记录仍然较大，清理图片数据...');
                this.cleanupExcessImages(record);
                const newSize = this.calculateDataSize(record);
                console.log(`清理后大小: ${(newSize/1024).toFixed(2)}KB`);
            }
            
            // 保存
            if (window.updateUploadProgress) {
                window.updateUploadProgress(90, '正在保存到云端...');
            }
            
            await this.updateRecord(record);
            
            console.log('✅ 反馈保存成功:', newFeedback.id);
            
            if (window.updateUploadProgress) {
                window.updateUploadProgress(100, '反馈保存成功！');
            }
            
            return {
                success: true,
                id: newFeedback.id,
                message: '反馈已成功保存到云端',
                binId: this.binId,
                imagesCount: uploadedImages.length,
                recordSize: recordSize,
                totalFeedbacks: record.feedbacks.length
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
     * 清理多余图片数据
     */
    cleanupExcessImages(record) {
        if (!record.feedbacks) return;
        
        // 保留最新5条完整反馈，其他的只保留缩略图
        record.feedbacks.forEach((feedback, index) => {
            if (index >= 5 && feedback.i && feedback.i.length > 0) {
                feedback.i = feedback.i.map(img => ({
                    t: img.t, // 只保留缩略图
                    n: img.n  // 保留文件名
                    // 移除完整的url以节省空间
                }));
            }
        });
    }
    
    /**
 * 添加评论到反馈
 */
async addComment(feedbackId, commentData) {
    try {
        console.log(`🔄 正在添加评论到反馈 ${feedbackId}`);
        
        const record = await this.getRecord();
        const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
        
        if (feedbackIndex === -1) {
            throw new Error('未找到对应的反馈');
        }
        
        if (!record.feedbacks[feedbackIndex].cm) {
            record.feedbacks[feedbackIndex].cm = [];
        }
        
        // 创建新评论对象
        const newComment = {
            id: 'cm_' + Date.now().toString(36),
            a: commentData.author?.substring(0, 20) || '匿名',
            c: commentData.content.substring(0, 200),
            ts: Date.now(),
            l: { c: 0, u: [] }
        };
        
        // 将新评论添加到开头
        record.feedbacks[feedbackIndex].cm.unshift(newComment);
        
        // 更新系统信息
        record.sys = { lu: Date.now(), v: '4.0' };
        
        await this.updateRecord(record);
        
        console.log('✅ 评论添加成功，更新记录');
        
        // 返回完整的评论数据（重要：包含所有需要的字段）
        return {
            success: true,
            message: '评论已成功添加',
            binId: this.binId,
            comment: {
                id: newComment.id,
                author: newComment.a,
                content: newComment.c,
                timestamp: newComment.ts,
                likes: { count: 0, users: [] }
            },
            commentsCount: record.feedbacks[feedbackIndex].cm.length
        };
        
    } catch (error) {
        console.error('添加评论失败:', error);
        return {
            success: false,
            message: '添加评论失败: ' + error.message
        };
    }
}
 /**
 * 点赞/取消点赞反馈
 */
async toggleLike(feedbackId, userId = 'anonymous') {
    try {
        console.log('🔄 开始点赞操作...');
        console.log('反馈ID:', feedbackId);
        console.log('用户ID:', userId);
        
        // 先获取当前记录
        const record = await this.getRecord();
        console.log('获取到的完整记录:', JSON.stringify(record, null, 2));
        
        // 确保有feedbacks数组
        if (!record.feedbacks) {
            record.feedbacks = [];
            console.log('创建空的feedbacks数组');
        }
        
        const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
        console.log('反馈索引:', feedbackIndex);
        
        if (feedbackIndex === -1) {
            throw new Error('未找到对应的反馈');
        }
        
        const feedback = record.feedbacks[feedbackIndex];
        console.log('找到的反馈数据:', JSON.stringify(feedback, null, 2));
        
        // 确保点赞数据结构存在 - 使用简化的字段名 'l'
        if (!feedback.l) {
            feedback.l = { c: 0, u: [] };
            console.log('创建新的点赞数据结构');
        } else {
            console.log('已有点赞数据:', feedback.l);
        }
        
        // 确保数组存在
        if (!Array.isArray(feedback.l.u)) {
            feedback.l.u = [];
        }
        
        // 确保数字存在
        if (typeof feedback.l.c !== 'number') {
            feedback.l.c = 0;
        }
        
        console.log('处理前的点赞数据:', {
            count: feedback.l.c,
            users: feedback.l.u,
            userIndex: feedback.l.u.indexOf(userId)
        });
        
        const userIndex = feedback.l.u.indexOf(userId);
        let action = '';
        
        if (userIndex === -1) {
            // 点赞
            feedback.l.u.push(userId);
            feedback.l.c = feedback.l.c + 1;
            action = 'liked';
            console.log('执行点赞，新点赞数:', feedback.l.c);
        } else {
            // 取消点赞
            feedback.l.u.splice(userIndex, 1);
            feedback.l.c = Math.max(0, feedback.l.c - 1);
            action = 'unliked';
            console.log('执行取消点赞，新点赞数:', feedback.l.c);
        }
        
        console.log('处理后的点赞数据:', {
            count: feedback.l.c,
            users: feedback.l.u,
            action: action
        });
        
        // 更新系统信息
        record.sys = {
            lu: Date.now(),
            v: '4.0'
        };
        
        // 保存到云端
        console.log('正在保存到云端...');
        console.log('保存的数据:', JSON.stringify(record, null, 2));
        
        const saveResult = await this.updateRecord(record);
        console.log('云端保存成功:', saveResult);
        
        return {
            success: true,
            message: '操作成功',
            action: action,
            likesCount: feedback.l.c,
            isLiked: action === 'liked',
            binId: this.binId
        };
        
    } catch (error) {
        console.error('❌ 点赞操作失败:', error);
        return {
            success: false,
            message: '操作失败: ' + error.message
        };
    }
}
 /**
 * 点赞/取消点赞评论
 */
async toggleCommentLike(feedbackId, commentId, userId = 'anonymous') {
    try {
        // 先获取当前记录
        const record = await this.getRecord();
        const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
        
        if (feedbackIndex === -1) {
            throw new Error('未找到对应的反馈');
        }
        
        const feedback = record.feedbacks[feedbackIndex];
        
        // 获取评论列表
        const comments = feedback.cm || [];
        const commentIndex = comments.findIndex(c => c.id === commentId);
        
        if (commentIndex === -1) {
            throw new Error('未找到对应的评论');
        }
        
        const comment = comments[commentIndex];
        
        // 确保点赞数据结构存在
        if (!comment.l) {
            comment.l = { c: 0, u: [] };
        }
        
        if (!Array.isArray(comment.l.u)) {
            comment.l.u = [];
        }
        
        if (typeof comment.l.c !== 'number') {
            comment.l.c = 0;
        }
        
        const userIndex = comment.l.u.indexOf(userId);
        let action = '';
        
        if (userIndex === -1) {
            // 点赞
            comment.l.u.push(userId);
            comment.l.c = comment.l.c + 1;
            action = 'liked';
        } else {
            // 取消点赞
            comment.l.u.splice(userIndex, 1);
            comment.l.c = Math.max(0, comment.l.c - 1);
            action = 'unliked';
        }
        
        // 更新系统信息
        record.sys = {
            lu: Date.now(),
            v: '4.0'
        };
        
        // 保存到云端
        await this.updateRecord(record);
        
        return {
            success: true,
            message: '操作成功',
            action: action,
            likesCount: comment.l.c,
            isLiked: action === 'liked',
            binId: this.binId
        };
        
    } catch (error) {
        return {
            success: false,
            message: '操作失败: ' + error.message
        };
    }
}
    
    /**
     * 获取统计
     */
    async getStats() {
        try {
            const feedbacks = await this.getFeedbacks();
            
            return {
                total: feedbacks.length,
                pending: feedbacks.filter(f => f.s === 'pending').length,
                processed: feedbacks.filter(f => f.s === 'processed').length
            };
        } catch (error) {
            console.error('获取统计失败:', error);
            return {
                total: 0,
                pending: 0,
                processed: 0
            };
        }
    }
}

// 全局实例
const jsonBinStorage = new JsonBinStorage();