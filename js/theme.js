/**
 * 17Tools 通用主题管理器
 * 用于在iframe中的子页面与主页面保持主题同步
 */

var ThemeCore = (function () {
    'use strict';

    var KEYS = {
        THEME: '17tools-theme',
        HAS_VISITED: '17tools-has-visited',
        PREFER_DESKTOP: '17tools-prefer-desktop',
        LEGACY_THEME: 'theme',
        LEGACY_HAS_VISITED: 'hasVisited',
        LEGACY_PREFER_DESKTOP: 'preferDesktop'
    };

    function isValidTheme(theme) {
        return theme === 'light' || theme === 'dark';
    }

    function isValidPreference(pref) {
        return pref === 'light' || pref === 'dark' || pref === 'system';
    }

    function isFileNullOrigin(origin) {
        return origin === 'null' || origin === 'file://';
    }

    function isTrustedThemeSource(event, win) {
        if (!event || !win || event.source !== win.parent) {
            return false;
        }
        const origin = event.origin == null ? '' : String(event.origin);
        const loc = win.location || {};
        if (isFileNullOrigin(origin)) {
            return loc.protocol === 'file:' || isFileNullOrigin(loc.origin);
        }
        if (origin && origin === loc.origin) {
            return true;
        }
        try {
            const parentLoc = win.parent && win.parent.location;
            if (parentLoc && origin && origin === parentLoc.origin) {
                return true;
            }
        } catch (e) { /* 无法读取父 origin 时不放行 http 异源 */ }
        return false;
    }

    function readThemeFromMessage(event, win) {
        if (!isTrustedThemeSource(event, win)) {
            return null;
        }
        const data = event.data;
        if (!data || data.type !== '17tools-theme') {
            return null;
        }
        return isValidTheme(data.theme) ? data.theme : null;
    }

    function readSystemTheme(matchMediaFn) {
        try {
            var fn = matchMediaFn;
            if (typeof fn !== 'function' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
                fn = window.matchMedia.bind(window);
            }
            if (typeof fn === 'function') {
                var mq = fn('(prefers-color-scheme: dark)');
                if (mq && mq.matches) {
                    return 'dark';
                }
            }
        } catch (e) { /* matchMedia 不可用时回落浅色 */ }
        return 'light';
    }

    function resolveAppliedTheme(preference, systemTheme) {
        if (isValidTheme(preference)) {
            return preference;
        }
        return systemTheme === 'dark' ? 'dark' : 'light';
    }

    function migrateLegacyPrefs(storage) {
        if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
            return storage;
        }
        function move(fromKey, toKey) {
            if (storage.getItem(toKey) != null) {
                return;
            }
            var value = storage.getItem(fromKey);
            if (value != null) {
                storage.setItem(toKey, value);
            }
        }
        move(KEYS.LEGACY_THEME, KEYS.THEME);
        move(KEYS.LEGACY_HAS_VISITED, KEYS.HAS_VISITED);
        move(KEYS.LEGACY_PREFER_DESKTOP, KEYS.PREFER_DESKTOP);
        return storage;
    }

    function readThemePreference(storage) {
        migrateLegacyPrefs(storage);
        if (!storage || typeof storage.getItem !== 'function') {
            return 'system';
        }
        var pref = storage.getItem(KEYS.THEME);
        return isValidPreference(pref) ? pref : 'system';
    }

    function readAppliedTheme(storage, systemTheme) {
        return resolveAppliedTheme(readThemePreference(storage), systemTheme);
    }

    function markVisited(storage) {
        if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
            return;
        }
        migrateLegacyPrefs(storage);
        if (storage.getItem(KEYS.HAS_VISITED) == null) {
            storage.setItem(KEYS.HAS_VISITED, 'true');
        }
    }

    return {
        KEYS: KEYS,
        isValidTheme: isValidTheme,
        isValidPreference: isValidPreference,
        isFileNullOrigin: isFileNullOrigin,
        isTrustedThemeSource: isTrustedThemeSource,
        readThemeFromMessage: readThemeFromMessage,
        readSystemTheme: readSystemTheme,
        resolveAppliedTheme: resolveAppliedTheme,
        migrateLegacyPrefs: migrateLegacyPrefs,
        readThemePreference: readThemePreference,
        readAppliedTheme: readAppliedTheme,
        markVisited: markVisited
    };
})();

function themePrefs() {
    if (window.SafeStorage) {
        if (!window.SafeStorage.shared) {
            window.SafeStorage.shared = window.SafeStorage.createShared(window);
        }
        return window.SafeStorage.shared;
    }
    const memory = {};
    try {
        return {
            getItem: function (key) { return localStorage.getItem(key); },
            setItem: function (key, value) {
                localStorage.setItem(key, value);
                return { persisted: true, verified: true };
            }
        };
    } catch (error) {
        return {
            getItem: function (key) {
                return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
            },
            setItem: function (key, value) {
                memory[key] = String(value);
                return { persisted: false, verified: false };
            }
        };
    }
}

class ThemeManager {
    constructor() {
        this.preference = 'system';
        this.currentTheme = 'light';
        this.observers = [];
        if (typeof window !== 'undefined' && !window.themeManager) {
            window.themeManager = this;
        }
        this.init();
    }

    /**
     * 初始化主题管理器
     */
    init() {
        if (this._inited) {
            return;
        }
        this._inited = true;
        const prefs = themePrefs();
        ThemeCore.migrateLegacyPrefs(prefs);
        ThemeCore.markVisited(prefs);
        this.preference = ThemeCore.readThemePreference(prefs);
        this.detectParentTheme();
        this.watchParentThemeChanges();
        this.setupOwnAttributeSync();
        this.setupLocalThemeSync();
        this.setupParentMessageSync();
        this.watchSystemTheme();
    }

    /**
     * 检测并应用父窗口的主题
     */
    detectParentTheme() {
        try {
            // 尝试从父窗口获取主题
            const parentRoot = this.getSafeParentDocumentElement();
            if (parentRoot) {
                const parentTheme = parentRoot.getAttribute('data-theme');
                if (ThemeCore.isValidTheme(parentTheme)) {
                    this.applyTheme(parentTheme);
                    return;
                }
            }
        } catch (e) {
            console.log('无法访问父窗口主题，使用本地主题设置');
        }

        // 如果无法访问父窗口，使用本地存储的主题
        const savedTheme = this.getInitialTheme();
        this.applyTheme(savedTheme);
    }

    /**
     * 无已存偏好时跟随系统；显式浅色/深色则用保存值。
     */
    getInitialTheme() {
        const prefs = themePrefs();
        ThemeCore.migrateLegacyPrefs(prefs);
        this.preference = ThemeCore.readThemePreference(prefs);
        return ThemeCore.resolveAppliedTheme(this.preference, this.getSystemTheme());
    }

    /**
     * 监听父窗口主题变化
     */
    watchParentThemeChanges() {
        if (this._parentWatchBound) {
            return;
        }
        this._parentWatchBound = true;
        try {
            const parentRoot = this.getSafeParentDocumentElement();
            if (parentRoot) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                            const parentTheme = parentRoot.getAttribute('data-theme');
                            if (ThemeCore.isValidTheme(parentTheme) && parentTheme !== this.currentTheme) {
                                this.applyTheme(parentTheme);
                            }
                        }
                    });
                });

                observer.observe(parentRoot, {
                    attributes: true,
                    attributeFilter: ['data-theme']
                });

                this.observers.push(observer);
            }
        } catch (e) {
            console.log('无法监听父窗口主题变化，使用本地主题管理');
        }
    }

    getSafeParentDocumentElement() {
        try {
            if (window.parent === window) return null;
            const parentDoc = window.parent && window.parent.document;
            const parentRoot = parentDoc && parentDoc.documentElement;
            return parentRoot instanceof Node ? parentRoot : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * 壳页可能直接改 iframe 的 data-theme，不经过 applyTheme。
     * 监听自身根节点，补发 themeChange，让画布笔色、代码高亮等跟随。
     */
    setupOwnAttributeSync() {
        if (typeof document === 'undefined' || this._ownAttrBound) {
            return;
        }
        this._ownAttrBound = true;
        const root = document.documentElement;
        const observer = new MutationObserver(() => {
            const theme = root.getAttribute('data-theme');
            if (ThemeCore.isValidTheme(theme) && theme !== this.currentTheme) {
                this.applyTheme(theme);
            }
        });
        observer.observe(root, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
        this.observers.push(observer);
    }

    /**
     * 设置本地主题同步
     */
    setupLocalThemeSync() {
        if (typeof window === 'undefined') {
            return;
        }
        if (!window.__17toolsThemeStorageBound) {
            window.__17toolsThemeStorageBound = true;
            window.addEventListener('storage', (e) => {
                const manager = window.themeManager;
                const keys = ThemeCore.KEYS;
                if (!manager || (e.key !== keys.THEME && e.key !== keys.LEGACY_THEME)) {
                    return;
                }
                const prefs = themePrefs();
                ThemeCore.migrateLegacyPrefs(prefs);
                manager.preference = ThemeCore.readThemePreference(prefs);
                const next = ThemeCore.resolveAppliedTheme(manager.preference, manager.getSystemTheme());
                if (next !== manager.currentTheme) {
                    manager.applyTheme(next);
                }
            });
        }
        if (!window.__17toolsThemeChangeBound) {
            window.__17toolsThemeChangeBound = true;
            window.addEventListener('themeChange', (e) => {
                const manager = window.themeManager;
                const next = e && e.detail && e.detail.theme;
                if (!manager || !ThemeCore.isValidTheme(next) || next === manager.currentTheme) {
                    return;
                }
                manager.applyTheme(next);
            });
        }
    }

    /**
     * 接收壳页 17tools-theme 消息（校验 source / origin / light|dark）
     */
    setupParentMessageSync() {
        if (typeof window === 'undefined' || window.__17toolsThemeMessageBound) {
            return;
        }
        window.__17toolsThemeMessageBound = true;
        window.addEventListener('message', (event) => {
            const theme = ThemeCore.readThemeFromMessage(event, window);
            const manager = window.themeManager;
            if (theme && manager) {
                manager.applyTheme(theme);
            }
        });
    }

    /**
     * 应用主题
     * @param {string} theme - 主题名称 ('light' 或 'dark')
     */
    applyTheme(theme) {
        if (!ThemeCore.isValidTheme(theme)) {
            theme = 'light';
        }

        if (theme === this.currentTheme && document.documentElement.getAttribute('data-theme') === theme) {
            return;
        }

        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);

        // 触发自定义事件
        this.dispatchThemeChange(theme);

        // 更新页面中的主题相关元素
        this.updateThemeElements(theme);
    }

    /**
     * 写入主题偏好：system | light | dark
     */
    setPreference(pref) {
        if (!ThemeCore.isValidPreference(pref)) {
            pref = 'system';
        }
        this.preference = pref;
        themePrefs().setItem(ThemeCore.KEYS.THEME, pref);
        this.applyTheme(ThemeCore.resolveAppliedTheme(pref, this.getSystemTheme()));
        return this.currentTheme;
    }

    /**
     * 切换主题（独立页按钮：在浅色/深色间锁定，不再跟随系统）
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setPreference(newTheme);
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
        const highlightLinks = document.querySelectorAll('link[href*="highlight"]');
        highlightLinks.forEach(link => {
            if (link.id === 'hljs-light' || link.id === 'hljs-dark' || link.getAttribute('data-hljs-managed') === 'pair') {
                return;
            }
            if (theme === 'dark') {
                link.href = link.href.replace(/github\.min\.css/, 'github-dark.min.css');
            } else {
                link.href = link.href.replace(/github-dark\.min\.css/, 'github.min.css');
            }
        });

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
        return ThemeCore.readSystemTheme();
    }

    /**
     * 监听系统主题变化（仅 preference 为 system 时应用）
     */
    watchSystemTheme() {
        if (this._systemWatchBound || typeof window === 'undefined' || !window.matchMedia) {
            return;
        }
        this._systemWatchBound = true;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (e) => {
            const manager = window.themeManager || this;
            if (manager.preference !== 'system') {
                return;
            }
            manager.applyTheme(e.matches ? 'dark' : 'light');
        };
        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', onChange);
        } else if (typeof mediaQuery.addListener === 'function') {
            mediaQuery.addListener(onChange);
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

function onDomReady(fn) {
    if (typeof document === 'undefined') {
        return;
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
}

function applyStoredThemeEarly() {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return;
    }
    try {
        const parentRoot = (function () {
            try {
                if (window.parent === window) return null;
                const parentDoc = window.parent && window.parent.document;
                const parentEl = parentDoc && parentDoc.documentElement;
                return parentEl || null;
            } catch (e) {
                return null;
            }
        })();
        const parentTheme = parentRoot && parentRoot.getAttribute('data-theme');
        if (ThemeCore.isValidTheme(parentTheme)) {
            document.documentElement.setAttribute('data-theme', parentTheme);
            return;
        }
        const prefs = themePrefs();
        ThemeCore.migrateLegacyPrefs(prefs);
        const applied = ThemeCore.readAppliedTheme(prefs, ThemeCore.readSystemTheme());
        document.documentElement.setAttribute('data-theme', applied);
    } catch (e) { /* 存储不可用时保持未设置，避免抛错 */ }
}

/**
 * 工具函数：初始化页面主题支持
 * @param {Object} options - 配置选项
 * @returns {ThemeManager} 主题管理器实例
 */
function initializeTheme(options = {}) {
    if (typeof window !== 'undefined' && window.themeManager) {
        return window.themeManager;
    }

    const {
        enableTransitions = true,
        followSystemTheme = true,
        themeToggleSelector = '.theme-toggle, [data-theme-toggle]'
    } = options;

    const themeManager = new ThemeManager();

    if (enableTransitions) {
        addThemeTransition();
    }

    if (followSystemTheme) {
        themeManager.watchSystemTheme();
    }

    onDomReady(() => {
        if (window.__17toolsThemeTogglesBound) {
            return;
        }
        window.__17toolsThemeTogglesBound = true;
        const toggleButtons = document.querySelectorAll(themeToggleSelector);
        toggleButtons.forEach(button => {
            addThemeToggle(button, themeManager);
        });
    });

    if (typeof window !== 'undefined' && !window.__17toolsThemeUnloadBound) {
        window.__17toolsThemeUnloadBound = true;
        window.addEventListener('beforeunload', () => {
            if (window.themeManager) {
                window.themeManager.cleanup();
            }
        });
    }

    return themeManager;
}

if (typeof window !== 'undefined') {
    window.ThemeCore = ThemeCore;
    window.ThemeManager = ThemeManager;
    window.addThemeToggle = addThemeToggle;
    window.addThemeTransition = addThemeTransition;
    window.initializeTheme = initializeTheme;

    applyStoredThemeEarly();
    if (!window.themeManager) {
        window.themeManager = initializeTheme();
    }
    onDomReady(function () {
        if (!window.themeManager) {
            window.themeManager = initializeTheme();
        }
    });
}

if (typeof module === 'object' && module.exports) {
    module.exports = ThemeCore;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
(function loadUnsavedGuard() {
    if (document.documentElement.getAttribute('data-unsaved-guard') === 'off') {
        return;
    }
    const markEarlyInput = () => {
        window.__17toolsEarlyInput = true;
    };
    document.addEventListener('input', markEarlyInput, true);
    document.addEventListener('change', markEarlyInput, true);

    function install() {
        if (window.UnsavedGuard) {
            window.UnsavedGuard.install(window);
        }
    }
    if (window.UnsavedGuard) {
        install();
        return;
    }
    const script = document.createElement('script');
    script.src = '../js/unsaved-guard.js';
    script.onload = install;
    document.head.appendChild(script);
})();
} 
