
// 精简版核心功能
class LiteApp {
  constructor() {
    this.initCoreFunctions();
  }

  // 仅初始化必要功能
  initCoreFunctions() {
    console.log('[Lite] Core functions initialized');
    
    // 基础点击处理
    document.querySelectorAll('.nav-card').forEach(card => {
      card.addEventListener('click', () => {
        window.location.href = card.dataset.href;
      });
    });
  }
}

// 初始化精简版
document.addEventListener('DOMContentLoaded', () => {
  new LiteApp();
});

// 导出模块
export default LiteApp;
