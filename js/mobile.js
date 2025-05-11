// 移动端极简核心
class MobileCore {
  constructor() {
    this.initPerformance();
    this.initTouch();
  }

  initPerformance() {
    // 禁用非必要API
    window.ontouchstart = null;
    window.onscroll = null;
    
    // 强制GC
    try {
      if(window.gc) {
        window.gc();
        window.gc();
      }
    } catch(e) {}
  }

  initTouch() {
    // 触摸延迟优化
    document.documentElement.style.touchAction = 'manipulation';
    FastClick.attach(document.body);
  }
}

// 50ms快速启动
setTimeout(() => new MobileCore(), 50);

// 按需加载补充功能
const loadEnhancements = () => {
  if(navigator.connection?.effectiveType === '4g') {
    import('/js/app.js');
  }
};

// 空闲时加载
if('requestIdleCallback' in window) {
  requestIdleCallback(loadEnhancements, {timeout: 2000});
} else {
  setTimeout(loadEnhancements, 3000);
}
