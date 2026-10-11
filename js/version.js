/**
 * 17Tools 全局版本管理系统
 * 统一管理所有页面的版本号显示
 * 
 * @author 17Tools Team
 * @version 2.19.1
 */

const DEFAULT_VERSION = '2.19.1';

class GlobalVersionManager {
    constructor() {
        this.version = null;
        this.init();
    }

    async init() {
        try {
            // 尝试获取版本号
            await this.fetchVersion();
            this.updateVersionDisplays();
        } catch (error) {
            console.warn('版本获取失败，使用默认版本', error);
            this.version = DEFAULT_VERSION;
            this.updateVersionDisplays();
        }
    }

    // 从 History.html 获取最新版本号
    async fetchVersion() {
        if (window.location.pathname.includes('History.html')) {
            this.extractVersionFromCurrentPage();
            return;
        }
        let cacheHost = window;
        try { if (window.parent && window.parent.location.origin === window.location.origin) cacheHost = window.parent; } catch (error) { /* independent page */ }
        const cached = cacheHost.__17toolsVersionCache;
        if (cached && cached.fallback === DEFAULT_VERSION && cached.expires > Date.now()) {
            this.version = cached.version;
            return;
        }
        await new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = window.location.pathname.includes('/items/') ? 'History.html' : 'items/History.html';
            let settled = false;
            let timer;
            const finish = (error, version) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                iframe.onload = null;
                iframe.onerror = null;
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                if (error) { reject(error); return; }
                this.version = version;
                cacheHost.__17toolsVersionCache = { version: version, fallback: DEFAULT_VERSION, expires: Date.now() + 60000 };
                resolve();
            };
            iframe.onload = () => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    const first = doc.querySelectorAll('.version-number')[0];
                    const match = first && first.textContent.match(/(\d+\.\d+\.\d+)/);
                    if (!match) throw new Error('History.html 缺少有效版本号');
                    finish(null, match[1]);
                } catch (error) { finish(error); }
            };
            iframe.onerror = () => finish(new Error('无法加载 History.html'));
            timer = setTimeout(() => finish(new Error('版本查询超时')), 8000);
            document.body.appendChild(iframe);
        });
    }

    // 从当前页面提取版本号（当前页面就是 History.html 时使用）
    extractVersionFromCurrentPage() {
        const versionElements = document.querySelectorAll('.version-number');
        if (versionElements.length > 0) {
            const versionText = versionElements[0].textContent;
            const versionMatch = versionText.match(/(\d+\.\d+\.\d+)/);
            this.version = versionMatch ? versionMatch[1] : DEFAULT_VERSION;
        } else {
            this.version = DEFAULT_VERSION;
        }
    }

    // 更新页面中的所有版本显示
    updateVersionDisplays() {
        if (!this.version) return;

        // 更新所有带有版本显示的元素
        const versionElements = [
            '.version',
            '[data-version]',
            '.app-version'
        ];

        versionElements.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element.dataset.version !== undefined) {
                    element.dataset.version = this.version;
                }

                // 根据元素内容格式更新
                const currentText = element.textContent.trim();
                if (currentText.startsWith('v')) {
                    element.textContent = `v${this.version}`;
                } else if (currentText.includes('版本')) {
                    element.textContent = `版本 ${this.version}`;
                } else if (currentText.match(/^\d+\.\d+\.\d+$/)) {
                    element.textContent = this.version;
                } else if (currentText === '') {
                    element.textContent = `v${this.version}`;
                }
            });
        });

        // 暴露版本信息到全局
        window.APP_VERSION = this.version;
        window.getAppVersion = () => this.version;

        // 发送版本更新事件
        window.dispatchEvent(new CustomEvent('versionUpdated', {
            detail: { version: this.version }
        }));

        console.log(`17Tools 版本已同步: ${this.version}`);
    }

    // 获取当前版本
    getVersion() {
        return this.version;
    }
}

// 自动初始化版本管理（当页面加载完成后）
if (typeof window !== 'undefined') {
    let versionManager = null;

    const initVersion = () => {
        if (!versionManager) {
            versionManager = new GlobalVersionManager();
        }
    };

    // 如果 DOM 已经加载完成，直接初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVersion);
    } else {
        initVersion();
    }

    // 暴露版本管理器到全局
    window.VersionManager = GlobalVersionManager;
}
