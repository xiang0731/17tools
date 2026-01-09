/**
 * 17Tools 全局版本管理系统
 * 统一管理所有页面的版本号显示
 * 
 * @author 17Tools Team
 * @version 2.11.0
 */

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
            this.version = '2.11.0'; // 默认版本
            this.updateVersionDisplays();
        }
    }

    // 从 History.html 获取最新版本号
    async fetchVersion() {
        return new Promise((resolve, reject) => {
            // 如果当前就在 History 页面，直接从页面获取
            if (window.location.pathname.includes('History.html')) {
                this.extractVersionFromCurrentPage();
                resolve();
                return;
            }

            // 创建隐藏的 iframe 加载 History.html
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            // 修正路径：History.html 在 items/ 目录下
            const currentPath = window.location.pathname;
            if (currentPath.includes('/items/')) {
                iframe.src = 'History.html';
            } else {
                iframe.src = 'items/History.html';
            }

            iframe.onload = () => {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const versionElements = iframeDoc.querySelectorAll('.version-number');

                    if (versionElements.length > 0) {
                        const versionText = versionElements[0].textContent;
                        const versionMatch = versionText.match(/(\d+\.\d+\.\d+)/);
                        this.version = versionMatch ? versionMatch[1] : '2.11.0';
                    } else {
                        this.version = '2.11.0';
                    }

                    document.body.removeChild(iframe);
                    resolve();
                } catch (error) {
                    document.body.removeChild(iframe);
                    reject(error);
                }
            };

            iframe.onerror = () => {
                document.body.removeChild(iframe);
                reject(new Error('无法加载 History.html'));
            };

            document.body.appendChild(iframe);
        });
    }

    // 从当前页面提取版本号（当前页面就是 History.html 时使用）
    extractVersionFromCurrentPage() {
        const versionElements = document.querySelectorAll('.version-number');
        if (versionElements.length > 0) {
            const versionText = versionElements[0].textContent;
            const versionMatch = versionText.match(/(\d+\.\d+\.\d+)/);
            this.version = versionMatch ? versionMatch[1] : '2.11.0';
        } else {
            this.version = '2.11.0';
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
