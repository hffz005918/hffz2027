// jsonbin-storage-base64.js - 使用Base64存储图片到JSONBin
class JsonBinStorage {
    constructor() {
        this.binId = '69304a8bd0ea881f401049f7'; // ← 替换为您的Bin ID
        
        // API Keys
        this.readOnlyKey = '$2a$10$AOxCSd1PIW2XUkxQvRpVVeimltcnLXIoOlqvBvFJwlxCihUD2wope';
        this.masterKey = '$2a$10$AOxCSd1PIW2XUkxQvRpVVeimltcnLXIoOlqvBvFJwlxCihUD2wope';
        
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        
        console.log('🔄 JSONBin存储初始化，Bin ID:', this.binId);
        
        // 图片大小限制（字节）
        this.maxImageSize = 5 * 1024 * 1024; // 5MB
        this.maxImagesPerFeedback = 2;
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
            
            // 检查是否有base64图片
            let base64ImageCount = 0;
            if (data.record?.feedbacks) {
                data.record.feedbacks.forEach(feedback => {
                    if (feedback.images) {
                        feedback.images.forEach(image => {
                            if (image.isBase64) base64ImageCount++;
                        });
                    }
                });
            }
            
            return {
                connected: true,
                message: `✅ 连接成功 (${count}条反馈，${base64ImageCount}张Base64图片)`,
                binId: this.binId,
                feedbackCount: count,
                base64ImageCount: base64ImageCount
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
     * 创建缩略图
     */
    createThumbnail(base64Image, maxWidth, maxHeight) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // 计算缩放比例
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = base64Image;
        });
    }
    
    /**
     * 优化Base64图片大小
     */
    async optimizeBase64Image(base64Data, maxSize = 500 * 1024) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = async function() {
                let canvas = document.createElement('canvas');
                let ctx = canvas.getContext('2d');
                
                // 获取原始尺寸
                let width = img.width;
                let height = img.height;
                
                // 如果图片太大，先缩小尺寸
                const maxDimension = 1200; // 最大尺寸
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height * maxDimension) / width;
                        width = maxDimension;
                    } else {
                        width = (width * maxDimension) / height;
                        height = maxDimension;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                // 尝试不同的质量设置
                let quality = 0.8;
                let optimizedBase64 = canvas.toDataURL('image/jpeg', quality);
                
                // 如果仍然太大，继续降低质量
                while (this.getBase64Size(optimizedBase64) > maxSize && quality > 0.3) {
                    quality -= 0.1;
                    optimizedBase64 = canvas.toDataURL('image/jpeg', quality);
                }
                
                resolve(optimizedBase64);
            }.bind(this);
            img.src = base64Data;
        });
    }
    
    /**
     * 获取Base64字符串的大小（字节）
     */
    getBase64Size(base64String) {
        // Base64编码后大小会增加约33%
        // 计算实际字节大小
        const stringLength = base64String.length;
        const sizeInBytes = (stringLength * 3) / 4;
        return sizeInBytes;
    }
    
    /**
     * 上传图片为Base64
     */
   async uploadImageAsBase64(file) {
    try {
        console.log('📤 上传图片为Base64:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        // 检查文件大小 - 显示详细错误信息
        if (file.size > this.maxImageSize) {
            throw new Error(`图片太大（${(file.size / 1024 / 1024).toFixed(2)}MB），最大支持5MB`);
        }
        
        // 转换为Base64
        const originalBase64 = await this.fileToBase64(file);
        
        // 优化图片（压缩大小）
        const optimizedBase64 = await this.optimizeBase64Image(originalBase64, 500 * 1024); // 压缩到500KB以内
        
        // 创建缩略图
        const thumbnail = await this.createThumbnail(optimizedBase64, 200, 200);
        
        // 计算大小
        const originalSize = file.size;
        const optimizedSize = this.getBase64Size(optimizedBase64);
        
        console.log(`📊 图片优化: ${(originalSize / 1024).toFixed(1)}KB -> ${(optimizedSize / 1024).toFixed(1)}KB (${((1 - optimizedSize / originalSize) * 100).toFixed(0)}% 压缩)`);
        
        return {
            success: true,
            url: optimizedBase64,
            thumbnail: thumbnail,
            originalName: file.name,
            originalSize: originalSize,
            optimizedSize: Math.round(optimizedSize),
            isBase64: true,
            mimeType: file.type,
            uploadTime: new Date().toISOString()
        };
    } catch (error) {
        console.error('Base64上传失败:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// 更新 uploadImagesAsBase64 函数
async uploadImagesAsBase64(files) {
    if (!files || files.length === 0) {
        return [];
    }
    
    // 限制图片数量为2张
    const filesToUpload = files.slice(0, this.maxImagesPerFeedback);
    if (files.length > this.maxImagesPerFeedback) {
        console.warn(`最多上传${this.maxImagesPerFeedback}张图片，已限制数量`);
        // 可以在这里添加用户提示
    }
    
    const uploadResults = [];
    const uploadPromises = [];
    
    // 为每个文件创建上传Promise
    for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        
        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            console.warn('❌ 跳过非图片文件:', file.name);
            continue;
        }
        
        uploadPromises.push(
            this.uploadImageAsBase64(file).then(result => {
                if (result.success) {
                    uploadResults.push(result);
                    console.log(`✅ 图片 ${file.name} 上传成功 (${(result.originalSize / 1024).toFixed(0)}KB -> ${(result.optimizedSize / 1024).toFixed(0)}KB)`);
                    
                    // 更新进度
                    if (window.updateImageUploadProgress) {
                        const progress = Math.round(((i + 1) / filesToUpload.length) * 100);
                        window.updateImageUploadProgress(progress, `正在上传第 ${i + 1}/${filesToUpload.length} 张图片`);
                    }
                } else {
                    console.warn(`❌ 图片 ${file.name} 上传失败:`, result.message);
                }
            })
        );
    }
    
    // 等待所有图片上传完成
    await Promise.all(uploadPromises);
    
    console.log(`✅ Base64图片上传完成，成功: ${uploadResults.length} 张`);
    return uploadResults;
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
            const feedbacks = data.record?.feedbacks || [];
            
            // 确保每个反馈都有必要的数组
            feedbacks.forEach(feedback => {
                if (!feedback.comments) {
                    feedback.comments = [];
                }
                if (!feedback.likes) {
                    feedback.likes = {
                        count: 0,
                        users: []
                    };
                }
                if (!feedback.images) {
                    feedback.images = [];
                }
                
                // 确保每个评论都有点赞数据
                if (feedback.comments) {
                    feedback.comments.forEach(comment => {
                        if (!comment.likes) {
                            comment.likes = {
                                count: 0,
                                users: []
                            };
                        }
                    });
                }
            });
            
            return feedbacks;
            
        } catch (error) {
            console.error('获取反馈失败:', error);
            return [];
        }
    }
    
    /**
     * 获取单个Bin记录
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
     * 更新Bin记录
     */
    async updateRecord(record) {
        try {
            const response = await fetch(`${this.baseUrl}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify(record)
            });
            
            if (!response.ok) {
                throw new Error(`更新失败: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ 记录更新成功');
            return data;
        } catch (error) {
            console.error('更新记录失败:', error);
            throw error;
        }
    }
    
    /**
     * 保存反馈（包含Base64图片上传）
     */
    async saveFeedback(feedbackData) {
        try {
            console.log('💾 开始保存反馈数据...');
            
            // 显示上传进度
            if (window.updateUploadProgress) {
                window.updateUploadProgress(10, '正在准备上传...');
            }
            
            let uploadedImages = [];
            if (feedbackData.imageFiles && feedbackData.imageFiles.length > 0) {
                console.log('📤 开始上传图片为Base64...');
                if (window.updateUploadProgress) {
                    window.updateUploadProgress(30, '正在转换图片为Base64...');
                }
                
                uploadedImages = await this.uploadImagesAsBase64(feedbackData.imageFiles);
                console.log('✅ Base64图片上传完成，成功:', uploadedImages.length);
                
                if (window.updateUploadProgress) {
                    window.updateUploadProgress(70, '图片转换完成，正在保存数据...');
                }
            }
            
            // 获取当前记录
            const record = await this.getRecord();
            
            // 创建新反馈
            const newFeedback = {
                id: 'fb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                employeeName: feedbackData.employeeName || '匿名员工',
                type: feedbackData.type,
                content: feedbackData.content,
                images: uploadedImages,
                status: 'pending',
                comments: [],
                likes: {
                    count: 0,
                    users: []
                },
                timestamp: new Date().toISOString()
            };
            
            // 添加到数组
            if (!record.feedbacks) record.feedbacks = [];
            record.feedbacks.push(newFeedback);
            
            // 更新统计信息
            record.stats = {
                total: record.feedbacks.length,
                pending: record.feedbacks.filter(f => f.status === 'pending').length,
                processed: record.feedbacks.filter(f => f.status === 'processed').length,
                suggestions: record.feedbacks.filter(f => f.type === 'suggestion').length,
                problems: record.feedbacks.filter(f => f.type === 'problem').length,
                complaints: record.feedbacks.filter(f => f.type === 'complaint').length,
                others: record.feedbacks.filter(f => f.type === 'other').length,
                totalImages: record.feedbacks.reduce((sum, f) => sum + (f.images ? f.images.length : 0), 0),
                base64Images: record.feedbacks.reduce((sum, f) => sum + (f.images ? f.images.filter(img => img.isBase64).length : 0), 0)
            };
            
            record.system = {
                lastUpdated: new Date().toISOString(),
                version: '2.0',
                storage: 'jsonbin-base64'
            };
            
            // 保存回JSONBin
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
                images: uploadedImages,
                stats: record.stats
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
     * 添加评论到反馈
     */
    async addComment(feedbackId, commentData) {
        try {
            console.log(`🔄 正在添加评论到反馈 ${feedbackId}`);
            
            // 获取当前记录
            const record = await this.getRecord();
            
            const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
            
            if (feedbackIndex === -1) {
                throw new Error('未找到对应的反馈');
            }
            
            if (!record.feedbacks[feedbackIndex].comments) {
                record.feedbacks[feedbackIndex].comments = [];
            }
            
            const newComment = {
                id: 'cm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                author: commentData.author || '匿名同事',
                content: commentData.content,
                timestamp: new Date().toISOString(),
                likes: {
                    count: 0,
                    users: []
                }
            };
            
            record.feedbacks[feedbackIndex].comments.push(newComment);
            
            // 更新系统时间
            record.system.lastUpdated = new Date().toISOString();
            
            // 保存更新
            await this.updateRecord(record);
            
            console.log('✅ 评论添加成功:', newComment.id);
            
            return {
                success: true,
                message: '评论已成功添加',
                binId: this.binId,
                updatedFeedback: record.feedbacks[feedbackIndex],
                newComment: newComment
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
     * 删除评论
     */
    async deleteComment(feedbackId, commentId) {
        try {
            console.log(`🔄 正在删除评论: 反馈 ${feedbackId}, 评论 ${commentId}`);
            
            // 获取当前记录
            const record = await this.getRecord();
            
            const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
            
            if (feedbackIndex === -1) {
                throw new Error('未找到对应的反馈');
            }
            
            const feedback = record.feedbacks[feedbackIndex];
            
            if (!feedback.comments) {
                throw new Error('该反馈没有评论');
            }
            
            const commentIndex = feedback.comments.findIndex(c => c.id === commentId);
            
            if (commentIndex === -1) {
                throw new Error('未找到要删除的评论');
            }
            
            feedback.comments.splice(commentIndex, 1);
            
            // 更新系统时间
            record.system.lastUpdated = new Date().toISOString();
            
            // 保存更新
            await this.updateRecord(record);
            
            console.log('✅ 评论删除成功:', commentId);
            
            return {
                success: true,
                message: '评论已成功删除',
                binId: this.binId,
                updatedFeedback: feedback
            };
            
        } catch (error) {
            console.error('删除评论失败:', error);
            return {
                success: false,
                message: '删除评论失败: ' + error.message
            };
        }
    }
    
    /**
     * 点赞/取消点赞反馈
     */
    async toggleLike(feedbackId, userId = 'anonymous') {
        try {
            console.log(`🔄 处理点赞: 反馈 ${feedbackId}, 用户 ${userId}`);
            
            // 获取当前记录
            const record = await this.getRecord();
            
            const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
            
            if (feedbackIndex === -1) {
                throw new Error('未找到对应的反馈');
            }
            
            const feedback = record.feedbacks[feedbackIndex];
            if (!feedback.likes) {
                feedback.likes = {
                    count: 0,
                    users: []
                };
            }
            
            const userIndex = feedback.likes.users.indexOf(userId);
            let action = '';
            
            if (userIndex === -1) {
                feedback.likes.users.push(userId);
                feedback.likes.count++;
                action = 'liked';
            } else {
                feedback.likes.users.splice(userIndex, 1);
                feedback.likes.count--;
                action = 'unliked';
            }
            
            // 更新系统时间
            record.system.lastUpdated = new Date().toISOString();
            
            // 保存更新
            await this.updateRecord(record);
            
            console.log(`✅ 点赞操作成功: ${action}, 当前点赞数: ${feedback.likes.count}`);
            
            return {
                success: true,
                message: `已${action === 'liked' ? '点赞' : '取消点赞'}`,
                action: action,
                likesCount: feedback.likes.count,
                isLiked: action === 'liked',
                binId: this.binId
            };
            
        } catch (error) {
            console.error('点赞操作失败:', error);
            return {
                success: false,
                message: '点赞操作失败: ' + error.message
            };
        }
    }
    
    /**
     * 点赞/取消点赞评论
     */
    async toggleCommentLike(feedbackId, commentId, userId = 'anonymous') {
        try {
            console.log(`🔄 处理评论点赞: 反馈 ${feedbackId}, 评论 ${commentId}, 用户 ${userId}`);
            
            // 获取当前记录
            const record = await this.getRecord();
            
            const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
            
            if (feedbackIndex === -1) {
                throw new Error('未找到对应的反馈');
            }
            
            const feedback = record.feedbacks[feedbackIndex];
            
            const commentIndex = feedback.comments.findIndex(c => c.id === commentId);
            
            if (commentIndex === -1) {
                throw new Error('未找到对应的评论');
            }
            
            const comment = feedback.comments[commentIndex];
            
            if (!comment.likes) {
                comment.likes = {
                    count: 0,
                    users: []
                };
            }
            
            const userIndex = comment.likes.users.indexOf(userId);
            let action = '';
            
            if (userIndex === -1) {
                comment.likes.users.push(userId);
                comment.likes.count++;
                action = 'liked';
            } else {
                comment.likes.users.splice(userIndex, 1);
                comment.likes.count--;
                action = 'unliked';
            }
            
            // 更新系统时间
            record.system.lastUpdated = new Date().toISOString();
            
            // 保存更新
            await this.updateRecord(record);
            
            console.log(`✅ 评论点赞操作成功: ${action}, 当前点赞数: ${comment.likes.count}`);
            
            return {
                success: true,
                message: `已${action === 'liked' ? '点赞' : '取消点赞'}`,
                action: action,
                likesCount: comment.likes.count,
                isLiked: action === 'liked',
                binId: this.binId
            };
            
        } catch (error) {
            console.error('评论点赞操作失败:', error);
            return {
                success: false,
                message: '评论点赞操作失败: ' + error.message
            };
        }
    }
    
    /**
     * 获取用户是否点赞了某个反馈
     */
    async getUserLikeStatus(feedbackId, userId = 'anonymous') {
        try {
            const feedbacks = await this.getFeedbacks();
            const feedback = feedbacks.find(f => f.id === feedbackId);
            
            if (!feedback || !feedback.likes) {
                return {
                    isLiked: false,
                    likesCount: 0
                };
            }
            
            return {
                isLiked: feedback.likes.users.includes(userId),
                likesCount: feedback.likes.count || 0
            };
        } catch (error) {
            console.error('获取点赞状态失败:', error);
            return {
                isLiked: false,
                likesCount: 0
            };
        }
    }
    
    /**
     * 删除反馈
     */
    async deleteFeedback(feedbackId) {
        try {
            // 获取当前记录
            const record = await this.getRecord();
            
            const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
            
            if (feedbackIndex === -1) {
                throw new Error('未找到要删除的反馈');
            }
            
            record.feedbacks.splice(feedbackIndex, 1);
            
            // 更新统计
            record.stats.total = record.feedbacks.length;
            record.stats.pending = record.feedbacks.filter(f => f.status === 'pending').length;
            record.stats.processed = record.feedbacks.filter(f => f.status === 'processed').length;
            record.system.lastUpdated = new Date().toISOString();
            
            // 保存更新
            await this.updateRecord(record);
            
            console.log('✅ 反馈删除成功:', feedbackId);
            
            return {
                success: true,
                message: '反馈已成功删除',
                binId: this.binId
            };
            
        } catch (error) {
            console.error('删除失败:', error);
            return {
                success: false,
                message: '删除失败: ' + error.message
            };
        }
    }
    
    /**
     * 更新反馈状态
     */
    async updateFeedbackStatus(feedbackId, newStatus) {
        try {
            // 获取当前记录
            const record = await this.getRecord();
            
            const feedbackIndex = record.feedbacks.findIndex(f => f.id === feedbackId);
            
            if (feedbackIndex === -1) {
                throw new Error('未找到要更新的反馈');
            }
            
            record.feedbacks[feedbackIndex].status = newStatus;
            record.feedbacks[feedbackIndex].processedAt = new Date().toISOString();
            
            // 更新统计
            record.stats.pending = record.feedbacks.filter(f => f.status === 'pending').length;
            record.stats.processed = record.feedbacks.filter(f => f.status === 'processed').length;
            record.system.lastUpdated = new Date().toISOString();
            
            // 保存更新
            await this.updateRecord(record);
            
            console.log('✅ 反馈状态更新成功:', feedbackId, '->', newStatus);
            
            return {
                success: true,
                message: '反馈状态已更新',
                binId: this.binId
            };
            
        } catch (error) {
            console.error('更新状态失败:', error);
            return {
                success: false,
                message: '更新状态失败: ' + error.message
            };
        }
    }
    
    /**
     * 获取统计
     */
    async getStats() {
        const feedbacks = await this.getFeedbacks();
        
        const totalImages = feedbacks.reduce((sum, f) => sum + (f.images ? f.images.length : 0), 0);
        const base64Images = feedbacks.reduce((sum, f) => sum + (f.images ? f.images.filter(img => img.isBase64).length : 0), 0);
        
        return {
            total: feedbacks.length,
            pending: feedbacks.filter(f => f.status === 'pending').length,
            processed: feedbacks.filter(f => f.status === 'processed').length,
            suggestions: feedbacks.filter(f => f.type === 'suggestion').length,
            problems: feedbacks.filter(f => f.type === 'problem').length,
            complaints: feedbacks.filter(f => f.type === 'complaint').length,
            others: feedbacks.filter(f => f.type === 'other').length,
            totalImages: totalImages,
            base64Images: base64Images
        };
    }
    
    /**
     * 获取单个反馈（用于测试）
     */
    async getFeedbackById(feedbackId) {
        try {
            const feedbacks = await this.getFeedbacks();
            return feedbacks.find(f => f.id === feedbackId);
        } catch (error) {
            console.error('获取单个反馈失败:', error);
            return null;
        }
    }
    
    /**
     * 清理旧的Base64图片（可选功能）
     */
    async cleanupOldImages(daysToKeep = 30) {
        try {
            console.log(`🧹 清理${daysToKeep}天前的Base64图片...`);
            
            const record = await this.getRecord();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            let removedCount = 0;
            let keptCount = 0;
            
            // 遍历所有反馈
            record.feedbacks.forEach(feedback => {
                if (feedback.images && feedback.images.length > 0) {
                    // 检查反馈时间
                    const feedbackDate = new Date(feedback.timestamp);
                    
                    if (feedbackDate < cutoffDate) {
                        // 移除Base64图片数据，只保留元数据
                        feedback.images.forEach(image => {
                            if (image.isBase64) {
                                // 只保留必要的元数据，移除大的base64字符串
                                image.url = '[已清理]';
                                image.thumbnail = '[已清理]';
                                image.cleaned = true;
                                removedCount++;
                            } else {
                                keptCount++;
                            }
                        });
                    } else {
                        keptCount += feedback.images.filter(img => img.isBase64).length;
                    }
                }
            });
            
            // 更新记录
            record.system.lastUpdated = new Date().toISOString();
            record.system.lastCleanup = new Date().toISOString();
            
            await this.updateRecord(record);
            
            console.log(`✅ 图片清理完成: 移除了${removedCount}张Base64图片，保留了${keptCount}张`);
            
            return {
                success: true,
                removed: removedCount,
                kept: keptCount
            };
        } catch (error) {
            console.error('清理图片失败:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
}

// 全局实例
const jsonBinStorage = new JsonBinStorage();