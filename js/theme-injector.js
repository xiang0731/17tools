/**
 * 超强力主题注入器
 * 强制覆盖所有硬编码样式，确保完美的深色模式支持
 */

(function () {
    'use strict';

    // 检查是否已经有主题支持
    if (document.querySelector('link[href*="theme.css"]') || document.querySelector('[data-theme-injected]')) {
        return;
    }

    // 添加标记避免重复注入
    document.documentElement.setAttribute('data-theme-injected', 'true');

    // 注入主题CSS
    function injectThemeCSS() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '../css/theme.css';
        document.head.appendChild(link);

        // 注入Font Awesome
        const faLink = document.createElement('link');
        faLink.rel = 'stylesheet';
        faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        document.head.appendChild(faLink);
    }

    // 注入超强力主题样式
    function injectSuperStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* 超强力主题变量 */
            :root {
                --primary-color: #6366f1;
                --primary-hover: #5b5ce6;
                --text-primary: #1f2937;
                --text-secondary: #6b7280;
                --text-tertiary: #9ca3af;
                --text-inverse: #ffffff;
                --background-primary: #ffffff;
                --background-secondary: #f8fafc;
                --background-tertiary: #f1f5f9;
                --background-hover: #e2e8f0;
                --border-color: #e5e7eb;
                --border-light: #f3f4f6;
                --border-focus: #6366f1;
                --primary-light: rgba(99, 102, 241, 0.1);
                --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
                --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                --radius-sm: 4px;
                --radius-md: 8px;
                --radius-lg: 12px;
                --spacing-xs: 4px;
                --spacing-sm: 8px;
                --spacing-md: 16px;
                --spacing-lg: 24px;
                --spacing-xl: 32px;
                --transition-fast: 0.15s ease;
                --font-family: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                --font-mono: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            }

            [data-theme="dark"] {
                --primary-color: #818cf8;
                --primary-hover: #6366f1;
                --text-primary: #f9fafb;
                --text-secondary: #d1d5db;
                --text-tertiary: #9ca3af;
                --text-inverse: #111827;
                --background-primary: #111827;
                --background-secondary: #1f2937;
                --background-tertiary: #374151;
                --background-hover: #4b5563;
                --border-color: #374151;
                --border-light: #4b5563;
                --border-focus: #818cf8;
                --primary-light: rgba(129, 140, 248, 0.1);
                --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2);
                --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
            }

            /* 超级强制全局样式重置 */
            * {
                box-sizing: border-box !important;
                transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease !important;
            }

            html, body {
                margin: 0 !important;
                padding: 0 !important;
                min-height: 100vh !important;
                background-color: var(--background-primary) !important;
                color: var(--text-primary) !important;
                font-family: var(--font-family) !important;
            }

            /* 超强制页面布局修复 */
            body {
                overflow-x: hidden !important;
                overflow-y: auto !important;
                padding: var(--spacing-lg) !important;
                max-width: 100vw !important;
                background: var(--background-primary) !important;
            }

            /* 超强制容器样式 */
            .container, .calculator, .main-container, div[class*="container"] {
                background-color: var(--background-primary) !important;
                background: var(--background-primary) !important;
                color: var(--text-primary) !important;
                min-height: auto !important;
                height: auto !important;
                overflow: visible !important;
                width: 100% !important;
                max-width: 1200px !important;
                margin: 0 auto !important;
                padding: var(--spacing-lg) !important;
                box-sizing: border-box !important;
            }

            /* About.html 特殊样式修复 */
            body:has(.rectangle),
            body .container:has(.rectangle) {
                margin: 0 !important;
                padding: 0 !important;
                height: 100vh !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                max-width: none !important;
                width: 100% !important;
                overflow: hidden !important;
            }

            .rectangle {
                border: none !important;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1) !important;
            }

            [data-theme="dark"] .rectangle {
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3) !important;
            }

            /* 超强制白色背景覆盖 */
            *[style*="background-color: white"],
            *[style*="background: white"],
            *[style*="background-color: #ffffff"],
            *[style*="background: #ffffff"],
            *[style*="background-color:#ffffff"],
            *[style*="background:#ffffff"],
            *[style*="background-color: #fff"],
            *[style*="background: #fff"],
            *[style*="background-color:#fff"],
            *[style*="background:#fff"],
            .clock,
            .code-output,
            .output-table,
            .result-section,
            .code-header,
            .language-selector,
            .editor-wrapper,
            .line-numbers,
            textarea,
            pre,
            code {
                background-color: var(--background-secondary) !important;
                background: var(--background-secondary) !important;
            }

            /* 超强制浅灰色背景覆盖 */
            *[style*="background-color: #f5f5f5"],
            *[style*="background: #f5f5f5"],
            *[style*="background-color: #f8f9fa"],
            *[style*="background: #f8f9fa"],
            *[style*="background-color: #f5f5f7"],
            *[style*="background: #f5f5f7"],
            *[style*="background-color: #f9f9f9"],
            *[style*="background: #f9f9f9"],
            *[style*="background-color: #f8fafc"],
            *[style*="background: #f8fafc"],
            *[style*="background-color: #f0f0f0"],
            *[style*="background: #f0f0f0"],
            .function-button,
            .input-group,
            .dual-input,
            .line-numbers,
            .rectangle {
                background-color: var(--background-tertiary) !important;
                background: var(--background-tertiary) !important;
            }

            /* 超强制文字颜色覆盖 */
            *[style*="color: #333"],
            *[style*="color:#333"],
            *[style*="color: #2c3e50"],
            *[style*="color:#2c3e50"],
            *[style*="color: black"],
            *[style*="color: #000"],
            *[style*="color:#000"],
            *[style*="color: #1d1d1f"],
            *[style*="color:#1d1d1f"],
            *[style*="color: #2d3748"],
            *[style*="color:#2d3748"],
            *[style*="color: #666"],
            *[style*="color:#666"],
            *[style*="color: #888"],
            *[style*="color:#888"],
            h1, h2, h3, h4, h5, h6,
            .result-content,
            .digital-time,
            .code-header,
            .language-selector,
            .title,
            .subtitle,
            label,
            span,
            div,
            p {
                color: var(--text-primary) !important;
            }

            /* 超强制输入框和表单元素 */
            input, textarea, select {
                background-color: var(--background-primary) !important;
                background: var(--background-primary) !important;
                color: var(--text-primary) !important;
                border: 1px solid var(--border-color) !important;
                border-radius: var(--radius-md) !important;
                font-family: inherit !important;
            }

            input::placeholder, textarea::placeholder {
                color: var(--text-tertiary) !important;
            }

            input:focus, textarea:focus, select:focus {
                outline: none !important;
                border-color: var(--border-focus) !important;
                box-shadow: 0 0 0 3px var(--primary-light) !important;
            }

            /* 超强制按钮样式 */
            button, .function-button, .action-button {
                background-color: var(--background-secondary) !important;
                background: var(--background-secondary) !important;
                color: var(--text-primary) !important;
                border: 1px solid var(--border-color) !important;
                border-radius: var(--radius-md) !important;
                font-family: inherit !important;
                cursor: pointer !important;
            }

            button:hover, .function-button:hover, .action-button:hover {
                background-color: var(--background-hover) !important;
                background: var(--background-hover) !important;
                transform: translateY(-1px) !important;
            }

            /* 超强制主要按钮样式 */
            .function-button.active,
            #submitBtn, #calculateBtn, #copyBtn,
            button[style*="background-color: #2196F3"],
            button[style*="background-color: #4299e1"],
            button[style*="background-color: #48bb78"] {
                background-color: var(--primary-color) !important;
                background: var(--primary-color) !important;
                color: var(--text-inverse) !important;
                border-color: var(--primary-color) !important;
            }

            .function-button.active:hover,
            #submitBtn:hover, #calculateBtn:hover, #copyBtn:hover,
            button[style*="background-color: #2196F3"]:hover,
            button[style*="background-color: #4299e1"]:hover,
            button[style*="background-color: #48bb78"]:hover {
                background-color: var(--primary-hover) !important;
                background: var(--primary-hover) !important;
            }

            /* 超强制代码相关元素 */
            .code-area, .editor-container, .editor-wrapper {
                background-color: var(--background-secondary) !important;
                background: var(--background-secondary) !important;
                border-color: var(--border-color) !important;
            }

            .line-numbers {
                background-color: var(--background-tertiary) !important;
                background: var(--background-tertiary) !important;
                border-color: var(--border-color) !important;
                color: var(--text-tertiary) !important;
            }

            .line-numbers span {
                color: var(--text-tertiary) !important;
            }

            /* 超强制highlight.js样式覆盖 */
            .hljs {
                background-color: var(--background-secondary) !important;
                background: var(--background-secondary) !important;
                color: var(--text-primary) !important;
            }

            .hljs-comment, .hljs-quote {
                color: var(--text-tertiary) !important;
            }

            .hljs-keyword, .hljs-selector-tag, .hljs-tag {
                color: var(--primary-color) !important;
            }

            .hljs-string, .hljs-attr {
                color: var(--text-secondary) !important;
            }

            /* 超强制时钟样式 */
            .clock-container, .clock {
                background-color: var(--background-secondary) !important;
                background: var(--background-secondary) !important;
                border-color: var(--border-color) !important;
                box-shadow: var(--shadow-sm) !important;
            }

            .hour-line, .minute-marker, .hour-hand, .minute-hand {
                background-color: var(--text-primary) !important;
                background: var(--text-primary) !important;
            }

            .digital-time, .timezone-info {
                color: var(--text-primary) !important;
                background-color: var(--background-secondary) !important;
                background: var(--background-secondary) !important;
            }

            /* 超强制日期计算器特殊样式 */
            .result-section {
                background-color: var(--background-secondary) !important;
                background: var(--background-secondary) !important;
                border-color: var(--border-color) !important;
                color: var(--text-primary) !important;
            }

            .result-highlight {
                color: var(--primary-color) !important;
            }

            .input-group label {
                color: var(--text-secondary) !important;
            }

            /* 超强制Tailwind CSS覆盖 */
            .bg-white {
                background-color: var(--background-primary) !important;
            }

            .bg-gray-50, .bg-gray-100 {
                background-color: var(--background-secondary) !important;
            }

            .text-gray-900, .text-black {
                color: var(--text-primary) !important;
            }

            .text-gray-600, .text-gray-700 {
                color: var(--text-secondary) !important;
            }

            .border-gray-200, .border-gray-300 {
                border-color: var(--border-color) !important;
            }

            /* 超强制表格样式 */
            table, tr, td, th {
                background-color: var(--background-primary) !important;
                background: var(--background-primary) !important;
                color: var(--text-primary) !important;
                border-color: var(--border-color) !important;
            }

            .output-table, .output-table td, .output-table th {
                background-color: var(--background-secondary) !important;
                background: var(--background-secondary) !important;
            }

            /* 超强制边框样式 */
            *[style*="border: 1px solid #e2e8f0"],
            *[style*="border-color: #e2e8f0"],
            *[style*="border: 1px solid #e6e6e6"],
            *[style*="border-color: #e6e6e6"],
            *[style*="border-right: 1px solid #e2e8f0"],
            *[style*="border-bottom: 1px solid #e6e6e6"] {
                border-color: var(--border-color) !important;
            }

            /* 超强制版本和历史页面样式 */
            .timeline, .version-entry, .version-header {
                background-color: var(--background-primary) !important;
                background: var(--background-primary) !important;
                color: var(--text-primary) !important;
            }

            .version-dot {
                background-color: var(--primary-color) !important;
                background: var(--primary-color) !important;
            }

            /* 超强制滚动条 */
            ::-webkit-scrollbar {
                width: 8px !important;
                height: 8px !important;
            }

            ::-webkit-scrollbar-track {
                background: var(--background-secondary) !important;
                border-radius: var(--radius-sm) !important;
            }

            ::-webkit-scrollbar-thumb {
                background: var(--border-color) !important;
                border-radius: var(--radius-sm) !important;
            }

            ::-webkit-scrollbar-thumb:hover {
                background: var(--text-tertiary) !important;
            }

            /* 强制移除所有阴影效果在深色模式下 */
            [data-theme="dark"] * {
                box-shadow: none !important;
                text-shadow: none !important;
            }

            [data-theme="dark"] .container,
            [data-theme="dark"] .clock {
                box-shadow: var(--shadow-sm) !important;
            }

            /* 响应式修复 */
            @media (max-width: 768px) {
                body {
                    padding: var(--spacing-md) !important;
                }

                .container, .calculator, .main-container {
                    padding: var(--spacing-md) !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 超强力动态修复元素样式
    function superFixElementStyles() {
        // 修复所有具有内联样式的元素
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            const style = element.getAttribute('style');
            if (style) {
                // 修复白色背景
                if (style.includes('background-color: white') ||
                    style.includes('background: white') ||
                    style.includes('background-color: #ffffff') ||
                    style.includes('background: #ffffff') ||
                    style.includes('background-color: #fff') ||
                    style.includes('background: #fff')) {
                    element.style.setProperty('background-color', 'var(--background-secondary)', 'important');
                }

                // 修复浅色背景
                if (style.includes('background-color: #f5f5f5') ||
                    style.includes('background: #f5f5f5') ||
                    style.includes('background-color: #f8f9fa') ||
                    style.includes('background: #f8f9fa') ||
                    style.includes('background-color: #f8fafc') ||
                    style.includes('background: #f8fafc') ||
                    style.includes('background-color: #f0f0f0') ||
                    style.includes('background: #f0f0f0')) {
                    element.style.setProperty('background-color', 'var(--background-tertiary)', 'important');
                }

                // 修复文字颜色
                if (style.includes('color: #333') ||
                    style.includes('color: black') ||
                    style.includes('color: #000') ||
                    style.includes('color: #2c3e50') ||
                    style.includes('color: #1d1d1f') ||
                    style.includes('color: #2d3748') ||
                    style.includes('color: #666') ||
                    style.includes('color: #888')) {
                    element.style.setProperty('color', 'var(--text-primary)', 'important');
                }

                // 修复边框
                if (style.includes('border-color: #e2e8f0') ||
                    style.includes('border: 1px solid #e2e8f0') ||
                    style.includes('border-color: #e6e6e6') ||
                    style.includes('border: 1px solid #e6e6e6')) {
                    element.style.setProperty('border-color', 'var(--border-color)', 'important');
                }
            }

            // 特殊类名处理
            if (element.classList.contains('bg-white')) {
                element.style.setProperty('background-color', 'var(--background-primary)', 'important');
            }
            if (element.classList.contains('bg-gray-50') || element.classList.contains('bg-gray-100')) {
                element.style.setProperty('background-color', 'var(--background-secondary)', 'important');
            }
            if (element.classList.contains('text-gray-900') || element.classList.contains('text-black')) {
                element.style.setProperty('color', 'var(--text-primary)', 'important');
            }
        });

        // 强制修复特定元素
        const specificElements = [
            '.clock', '.code-output', '.line-numbers', '.result-section',
            '.function-button', '.input-group', '.code-header', '.language-selector'
        ];

        specificElements.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                el.style.setProperty('background-color', 'var(--background-secondary)', 'important');
                el.style.setProperty('color', 'var(--text-primary)', 'important');
                el.style.setProperty('border-color', 'var(--border-color)', 'important');
            });
        });

        // 特殊处理About.html页面
        const rectangle = document.querySelector('.rectangle');
        if (rectangle) {
            // 重置body和container的样式
            document.body.style.setProperty('margin', '0', 'important');
            document.body.style.setProperty('padding', '0', 'important');
            document.body.style.setProperty('height', '100vh', 'important');
            document.body.style.setProperty('display', 'flex', 'important');
            document.body.style.setProperty('justify-content', 'center', 'important');
            document.body.style.setProperty('align-items', 'center', 'important');
            document.body.style.setProperty('overflow', 'hidden', 'important');

            // 确保rectangle没有边框
            rectangle.style.setProperty('border', 'none', 'important');

            // 修复container如果存在的话
            const container = document.querySelector('.container');
            if (container) {
                container.style.setProperty('margin', '0', 'important');
                container.style.setProperty('padding', '0', 'important');
                container.style.setProperty('max-width', 'none', 'important');
                container.style.setProperty('width', '100%', 'important');
            }
        }
    }

    // 初始化主题管理器
    function initThemeManager() {
        const script = document.createElement('script');
        script.src = '../js/theme.js';
        script.onload = function () {
            if (window.initializeTheme) {
                window.themeManager = window.initializeTheme({
                    enableTransitions: true,
                    followSystemTheme: false
                });

                // 监听主题变化
                if (window.themeManager && window.themeManager.onThemeChange) {
                    window.themeManager.onThemeChange(() => {
                        setTimeout(superFixElementStyles, 50);
                    });
                }
            }
        };
        document.head.appendChild(script);
    }

    // 强制修复Highlight.js主题
    function fixHighlightJS() {
        // 替换浅色主题为深色主题
        const lightThemeLink = document.querySelector('link[href*="github.min.css"]');
        if (lightThemeLink && document.documentElement.getAttribute('data-theme') === 'dark') {
            lightThemeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github-dark.min.css';
        }
    }

    // 主要初始化函数
    function init() {
        injectThemeCSS();
        injectSuperStyles();
        initThemeManager();

        // 多次执行修复，确保所有元素都被覆盖
        setTimeout(superFixElementStyles, 100);
        setTimeout(superFixElementStyles, 500);
        setTimeout(superFixElementStyles, 1000);
        setTimeout(fixHighlightJS, 100);

        // 监听DOM变化
        const observer = new MutationObserver(function (mutations) {
            let shouldFix = false;
            mutations.forEach(function (mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldFix = true;
                }
                if (mutation.type === 'attributes' &&
                    (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                    shouldFix = true;
                }
            });
            if (shouldFix) {
                setTimeout(superFixElementStyles, 50);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });

        // 监听主题变化
        const themeObserver = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    setTimeout(fixHighlightJS, 100);
                    setTimeout(superFixElementStyles, 100);
                }
            });
        });

        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }

    // 检查DOM状态
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(); 