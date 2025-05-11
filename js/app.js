// 增强型功能模块
class App {
  constructor() {
    this.initAnalytics();
    this.initLazyLoad();
    this.addEnhancements();
  }

  // 初始化数据分析
  initAnalytics() {
    console.log('[App] Analytics initialized');
    // 实际项目中接入Google Analytics等
  }

  // 图片懒加载
  initLazyLoad() {
    const lazyImages = [].slice.call(document.querySelectorAll('img[loading="lazy"]'));
    
    if ('IntersectionObserver' in window) {
      const lazyImageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const lazyImage = entry.target;
            lazyImage.src = lazyImage.dataset.src;
            lazyImageObserver.unobserve(lazyImage);
          }
        });
      });

      lazyImages.forEach(lazyImage => {
        lazyImageObserver.observe(lazyImage);
      });
    }
  }

  // 附加功能增强
  addEnhancements() {
    // 卡片点击动画
    document.querySelectorAll('.nav-card').forEach(card => {
      card.addEventListener('mousedown', () => {
        card.style.transform = 'scale(0.98)';
      });
      card.addEventListener('mouseup', () => {
        card.style.transform = '';
      });
    });

    console.log('[App] Enhanced interactions loaded');
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  new App();
});

// 导出模块供动态导入使用
export default App;
