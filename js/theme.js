/**
 * 17Tools 通用主题管理器
 * 用于在iframe中的子页面与主页面保持主题同步
 */

class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.observers = [];
        this.init();
    }

    /**
     * 初始化主题管理器
     */
    init() {
        this.detectParentTheme();
        this.watchParentThemeChanges();
        this.setupLocalThemeSync();
    }

    /**
     * 检测并应用父窗口的主题
     */
    detectParentTheme() {
        try {
            // 尝试从父窗口获取主题
            if (parent && parent.document && parent.window !== window) {
                const parentTheme = parent.document.documentElement.getAttribute('data-theme');
                if (parentTheme) {
                    this.applyTheme(parentTheme);
                    return;
                }
            }
        } catch (e) {
            console.log('无法访问父窗口主题，使用本地主题设置');
        }

        // 如果无法访问父窗口，使用本地存储的主题
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.applyTheme(savedTheme);
    }

    /**
     * 监听父窗口主题变化
     */
    watchParentThemeChanges() {
        try {
            if (parent && parent.document && parent.window !== window) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                            const parentTheme = parent.document.documentElement.getAttribute('data-theme');
                            if (parentTheme !== this.currentTheme) {
                                this.applyTheme(parentTheme);
                            }
                        }
                    });
                });

                observer.observe(parent.document.documentElement, {
                    attributes: true,
                    attributeFilter: ['data-theme']
                });

                this.observers.push(observer);
            }
        } catch (e) {
            console.log('无法监听父窗口主题变化，使用本地主题管理');
        }
    }

    /**
     * 设置本地主题同步
     */
    setupLocalThemeSync() {
        // 监听本地存储变化
        window.addEventListener('storage', (e) => {
            if (e.key === 'theme' && e.newValue !== this.currentTheme) {
                this.applyTheme(e.newValue);
            }
        });

        // 监听自定义主题变化事件
        window.addEventListener('themeChange', (e) => {
            if (e.detail.theme !== this.currentTheme) {
                this.applyTheme(e.detail.theme);
            }
        });
    }

    /**
     * 应用主题
     * @param {string} theme - 主题名称 ('light' 或 'dark')
     */
    applyTheme(theme) {
        if (!theme || (theme !== 'light' && theme !== 'dark')) {
            theme = 'light';
        }

        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);

        // 保存到本地存储
        localStorage.setItem('theme', theme);

        // 触发自定义事件
        this.dispatchThemeChange(theme);

        // 更新页面中的主题相关元素
        this.updateThemeElements(theme);
    }

    /**
     * 切换主题
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        return newTheme;
    }

    /**
     * 获取当前主题
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * 触发主题变化事件
     * @param {string} theme - 新主题
     */
    dispatchThemeChange(theme) {
        const event = new CustomEvent('themeChange', {
            detail: { theme, timestamp: Date.now() }
        });
        window.dispatchEvent(event);
    }

    /**
     * 更新页面中的主题相关元素
     * @param {string} theme - 当前主题
     */
    updateThemeElements(theme) {
        // 更新主题切换按钮
        const themeToggleButtons = document.querySelectorAll('.theme-toggle, [data-theme-toggle]');
        themeToggleButtons.forEach(button => {
            const icon = button.querySelector('i');
            const text = button.querySelector('span, .theme-text');

            if (icon) {
                icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }

            if (text) {
                text.textContent = theme === 'dark' ? '浅色模式' : '深色模式';
            }

            // 更新按钮的aria-label
            button.setAttribute('aria-label', `切换到${theme === 'dark' ? '浅色' : '深色'}模式`);
        });

        // 更新主题指示器
        const themeIndicators = document.querySelectorAll('[data-theme-indicator]');
        themeIndicators.forEach(indicator => {
            indicator.textContent = theme === 'dark' ? '深色模式' : '浅色模式';
            indicator.className = `theme-indicator ${theme}-mode`;
        });

        // 更新代码高亮主题（如果存在）
        this.updateCodeHighlightTheme(theme);
    }

    /**
     * 更新代码高亮主题
     * @param {string} theme - 当前主题
     */
    updateCodeHighlightTheme(theme) {
        // 查找highlight.js的样式链接
        const highlightLinks = document.querySelectorAll('link[href*="highlight"]');
        highlightLinks.forEach(link => {
            if (theme === 'dark') {
                link.href = link.href.replace(/github\.min\.css/, 'github-dark.min.css');
            } else {
                link.href = link.href.replace(/github-dark\.min\.css/, 'github.min.css');
            }
        });

        // 重新高亮代码块
        if (window.hljs) {
            document.querySelectorAll('pre code').forEach((block) => {
                window.hljs.highlightElement(block);
            });
        }
    }

    /**
     * 添加主题变化监听器
     * @param {Function} callback - 回调函数
     */
    onThemeChange(callback) {
        if (typeof callback === 'function') {
            window.addEventListener('themeChange', (e) => {
                callback(e.detail.theme);
            });
        }
    }

    /**
     * 移除所有观察者
     */
    cleanup() {
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers = [];
    }

    /**
     * 获取主题相关的CSS变量值
     * @param {string} variableName - CSS变量名
     * @returns {string} CSS变量值
     */
    getCSSVariable(variableName) {
        return getComputedStyle(document.documentElement)
            .getPropertyValue(variableName)
            .trim();
    }

    /**
     * 设置主题相关的CSS变量
     * @param {string} variableName - CSS变量名
     * @param {string} value - CSS变量值
     */
    setCSSVariable(variableName, value) {
        document.documentElement.style.setProperty(variableName, value);
    }

    /**
     * 预加载主题样式
     */
    preloadThemes() {
        // 预加载深色模式的图片和资源
        if (this.currentTheme === 'light') {
            const preloadLink = document.createElement('link');
            preloadLink.rel = 'prefetch';
            preloadLink.href = 'data:text/css,';
            document.head.appendChild(preloadLink);
        }
    }

    /**
     * 检测系统主题偏好
     * @returns {string} 系统偏好的主题
     */
    getSystemTheme() {
        if (window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    }

    /**
     * 监听系统主题变化
     */
    watchSystemTheme() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener((e) => {
                // 只有在没有用户手动设置主题时才跟随系统
                const userTheme = localStorage.getItem('theme');
                if (!userTheme) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }
}

/**
 * 工具函数：为元素添加主题切换功能
 * @param {Element|string} element - DOM元素或选择器
 * @param {ThemeManager} themeManager - 主题管理器实例
 */
function addThemeToggle(element, themeManager) {
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    if (!el) return;

    el.addEventListener('click', () => {
        themeManager.toggleTheme();
    });
}

/**
 * 工具函数：为页面添加主题过渡效果
 */
function addThemeTransition() {
    // 添加过渡类到需要动画的元素
    const transitionElements = document.querySelectorAll(
        'body, .card, .btn, input, textarea, select, .nav-item'
    );

    transitionElements.forEach(el => {
        el.classList.add('theme-transition');
    });
}

/**
 * 工具函数：初始化页面主题支持
 * @param {Object} options - 配置选项
 * @returns {ThemeManager} 主题管理器实例
 */
function initializeTheme(options = {}) {
    const {
        enableTransitions = true,
        followSystemTheme = false,
        themeToggleSelector = '.theme-toggle, [data-theme-toggle]'
    } = options;

    // 创建主题管理器
    const themeManager = new ThemeManager();

    // 添加过渡效果
    if (enableTransitions) {
        addThemeTransition();
    }

    // 监听系统主题
    if (followSystemTheme) {
        themeManager.watchSystemTheme();
    }

    // 自动绑定主题切换按钮
    document.addEventListener('DOMContentLoaded', () => {
        const toggleButtons = document.querySelectorAll(themeToggleSelector);
        toggleButtons.forEach(button => {
            addThemeToggle(button, themeManager);
        });
    });

    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
        themeManager.cleanup();
    });

    return themeManager;
}

// 导出到全局作用域
window.ThemeManager = ThemeManager;
window.addThemeToggle = addThemeToggle;
window.addThemeTransition = addThemeTransition;
window.initializeTheme = initializeTheme;

// 如果是在iframe中，自动初始化
if (window.parent !== window) {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.themeManager) {
            window.themeManager = initializeTheme();
        }
    });
} 