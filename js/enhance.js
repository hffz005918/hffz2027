// 桌面增强功能
class DesktopEnhance {
  constructor() {
    this.initHover();
    this.loadAnimations();
  }

  initHover() {
    // 悬停效果
    document.querySelectorAll('.nav-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  loadAnimations() {
    // 动态加载动画库
    import('https://cdn.example.com/animate.min.js').then(() => {
      document.querySelectorAll('.nav-card').forEach(card => {
        card.classList.add('animate__animated');
      });
    });
  }
}

// 延迟初始化
setTimeout(() => new DesktopEnhance(), 500);
