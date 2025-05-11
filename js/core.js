
// 移动端核心逻辑
class MobileCore {
  constructor() {
    this.initPerformance();
    this.initTouch();
    this.optimizeRender();
  }

  initPerformance() {
    // 禁用非必要API
    window.ontouchmove = null;
    window.onscroll = null;
    
    // 内存优化
    if(window.performance && window.performance.memory) {
      setInterval(() => {
        if(performance.memory.usedJSHeapSize > 50e6) {
          try { window.gc(); } catch(e) {}
        }
      }, 10000);
    }
  }

  initTouch() {
    // 触摸优化
    document.documentElement.style.touchAction = 'manipulation';
    let lastTap = 0;
    
    document.addEventListener('touchend', e => {
      const now = Date.now();
      if(now - lastTap < 300) e.preventDefault();
      lastTap = now;
    }, {passive: true});
  }

  optimizeRender() {
    // 渲染层优化
    const containers = document.querySelectorAll('.app-shell, .nav-card');
    containers.forEach(el => {
      el.style.willChange = 'transform';
      el.style.transform = 'translateZ(0)';
    });
  }
}

// 即时初始化
new MobileCore();

// 动态加载补充
const loadEnhance = () => {
  if(navigator.connection?.effectiveType === '4g') {
    import('/js/enhance.js');
  }
};

if('requestIdleCallback' in window) {
  requestIdleCallback(loadEnhance, {timeout: 2000});
} else {
  setTimeout(loadEnhance, 3000);
}
