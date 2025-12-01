// config.js - 系统配置文件
// 注意：在实际部署时，这些信息需要根据实际情况修改

const CONFIG = {
    // GitHub 配置 - 必须修改！
    GITHUB: {
        // 你的 GitHub 用户名/仓库名，例如: "username/repo-name"
        REPO: "your-username/your-repo-name",
        
        // GitHub Personal Access Token
        // 重要：这个 token 需要保密，不要提交到公开仓库！
        TOKEN: "ghp_your_github_token_here",
        
        // Issues 标签
        LABEL: "employee-feedback"
    },
    
    // 系统配置
    SYSTEM: {
        MAX_IMAGES: 3,
        MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
        AUTO_REFRESH_TIME: 5 // 成功提交后自动刷新时间（秒）
    }
};

// 验证配置
function validateConfig() {
    const errors = [];
    
    if (!CONFIG.GITHUB.TOKEN || CONFIG.GITHUB.TOKEN === "ghp_your_github_token_here") {
        errors.push("❌ 请配置 GitHub Token");
    }
    
    if (!CONFIG.GITHUB.REPO || CONFIG.GITHUB.REPO === "your-username/your-repo-name") {
        errors.push("❌ 请配置 GitHub 仓库路径");
    }
    
    if (errors.length > 0) {
        console.error("配置错误:", errors.join("\n"));
        return false;
    }
    
    console.log("✅ 配置验证通过");
    return true;
}