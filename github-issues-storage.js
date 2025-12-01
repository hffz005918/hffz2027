// github-issues-storage.js - GitHub Issues 存储解决方案
class GitHubIssuesStorage {
    constructor() {
        this.config = CONFIG.GITHUB;
        this.initialized = false;
        this.init();
    }

    init() {
        if (validateConfig()) {
            this.initialized = true;
            console.log('✅ GitHub Issues 存储已初始化');
        } else {
            console.error('❌ GitHub Issues 存储初始化失败');
        }
    }

    async saveFeedback(feedbackData) {
        if (!this.initialized) {
            return {
                success: false,
                error: '存储系统未正确初始化，请检查配置'
            };
        }

        try {
            console.log('📤 正在提交反馈到 GitHub Issues...', feedbackData);

            // 生成 Issue 标题和内容
            const issueTitle = this.generateIssueTitle(feedbackData);
            const issueBody = this.generateIssueBody(feedbackData);
            const labels = this.generateLabels(feedbackData);

            const response = await fetch(`https://api.github.com/repos/${this.config.REPO}/issues`, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.config.TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: issueTitle,
                    body: issueBody,
                    labels: labels
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`GitHub API 错误 (${response.status}): ${errorData.message || response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ 反馈提交成功! Issue #', result.number);

            return {
                success: true,
                id: result.number.toString(),
                issueNumber: result.number,
                issueUrl: result.html_url,
                message: `反馈已提交成功！Issue #${result.number}`
            };

        } catch (error) {
            console.error('❌ 提交反馈失败:', error);
            return {
                success: false,
                error: this.formatErrorMessage(error)
            };
        }
    }

    generateIssueTitle(feedback) {
        const typeEmoji = {
            'suggestion': '💡',
            'problem': '🐛',
            'complaint': '⚠️',
            'other': '📄'
        }[feedback.type] || '📄';

        const typeText = this.getTypeText(feedback.type);
        const preview = feedback.content.length > 50 
            ? feedback.content.substring(0, 50) + '...' 
            : feedback.content;

        return `${typeEmoji} 【${typeText}】${preview}`;
    }

    generateIssueBody(feedback) {
        const imagesInfo = feedback.images && feedback.images.length > 0 
            ? `📷 **图片附件**: ${feedback.images.length} 张` 
            => '📷 **图片附件**: 无';

        return `
## 📋 员工反馈信息

**反馈类型**: ${this.getTypeText(feedback.type)}
**提交人**: ${feedback.employeeName || '匿名同事'}
**提交时间**: ${new Date().toLocaleString('zh-CN')}
**反馈状态**: 🟡 待处理

## 📝 反馈内容
${feedback.content}

## 📊 系统信息
- ${imagesInfo}
- 提交方式: 员工反馈系统
- 反馈ID: ${'fb_' + Date.now()}

---

*此反馈由宏方纺织员工反馈系统自动创建*
*提交时间: ${new Date().toISOString()}*
        `.trim();
    }

    generateLabels(feedback) {
        const baseLabels = [
            this.config.LABEL,
            'pending', // 待处理状态
            feedback.type
        ];
        
        // 添加类型标签
        const typeLabels = {
            'suggestion': 'enhancement',
            'problem': 'bug',
            'complaint': 'warning'
        };
        
        if (typeLabels[feedback.type]) {
            baseLabels.push(typeLabels[feedback.type]);
        }
        
        return baseLabels;
    }

    getTypeText(type) {
        const typeMap = {
            'suggestion': '意见建议',
            'problem': '问题反馈',
            'complaint': '投诉举报',
            'other': '其他反馈'
        };
        return typeMap[type] || '其他反馈';
    }

    formatErrorMessage(error) {
        if (error.message.includes('401')) {
            return 'GitHub 认证失败，请检查 Token 配置';
        } else if (error.message.includes('404')) {
            return '仓库不存在或没有访问权限';
        } else if (error.message.includes('403')) {
            return 'API 请求频率超限，请稍后重试';
        } else {
            return `提交失败: ${error.message}`;
        }
    }

    async testConnection() {
        if (!this.initialized) {
            return {
                success: false,
                error: '存储系统未初始化'
            };
        }

        try {
            const response = await fetch(`https://api.github.com/repos/${this.config.REPO}`, {
                headers: {
                    'Authorization': `token ${this.config.TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const repoInfo = await response.json();
                return {
                    success: true,
                    message: `✅ 连接成功 - ${repoInfo.full_name}`,
                    repo: repoInfo
                };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            return {
                success: false,
                error: `连接测试失败: ${error.message}`
            };
        }
    }

    // 获取反馈列表（从 GitHub Issues）
    async getFeedbacks() {
        if (!this.initialized) {
            return [];
        }

        try {
            const response = await fetch(
                `https://api.github.com/repos/${this.config.REPO}/issues?labels=${this.config.LABEL}&state=all&sort=created&direction=desc`,
                {
                    headers: {
                        'Authorization': `token ${this.config.TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!response.ok) throw new Error('获取 Issues 失败');

            const issues = await response.json();
            
            // 转换为系统格式
            return issues.map(issue => this.issueToFeedback(issue));
            
        } catch (error) {
            console.error('获取反馈列表失败:', error);
            return [];
        }
    }

    issueToFeedback(issue) {
        const body = issue.body || '';
        
        return {
            id: issue.number.toString(),
            employeeName: this.extractFromBody(body, '提交人') || '匿名同事',
            type: this.extractTypeFromLabels(issue.labels),
            content: this.extractContent(body),
            timestamp: issue.created_at,
            status: issue.state === 'open' ? 'pending' : 'processed',
            issueUrl: issue.html_url,
            title: issue.title,
            labels: issue.labels.map(label => label.name)
        };
    }

    extractFromBody(body, field) {
        const regex = new RegExp(`\\*\\*${field}\\*\\*: (.+)`);
        const match = body.match(regex);
        return match ? match[1].trim() : null;
    }

    extractTypeFromLabels(labels) {
        const typeLabels = ['suggestion', 'problem', 'complaint', 'other'];
        for (let label of labels) {
            if (typeLabels.includes(label.name)) {
                return label.name;
            }
        }
        return 'other';
    }

    extractContent(body) {
        const contentMatch = body.match(/## 📝 反馈内容\n([\s\S]*?)\n## 📊/);
        if (contentMatch) return contentMatch[1].trim();
        
        // 备用解析方法
        const lines = body.split('\n');
        let inContent = false;
        let content = [];
        
        for (let line of lines) {
            if (line.includes('## 📝 反馈内容')) {
                inContent = true;
                continue;
            }
            if (inContent && line.includes('## 📊')) {
                break;
            }
            if (inContent && line.trim()) {
                content.push(line);
            }
        }
        
        return content.join('\n').trim() || '内容解析失败';
    }
}