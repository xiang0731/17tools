(function () {
    'use strict';

    const WORKER_URL = '../js/pretty-format-worker.js';

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    function showStatus(message, type, duration) {
        const statusEl = document.getElementById('status-message');
        statusEl.className = 'status-message status-' + (type || 'info');
        const iconMap = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle'
        };
        const icon = document.createElement('i');
        icon.className = iconMap[type] || iconMap.info;
        statusEl.replaceChildren(icon, document.createTextNode(' ' + String(message)));
        statusEl.classList.add('show');
        setTimeout(function () {
            statusEl.classList.remove('show');
        }, duration || 3000);
    }

    const languageMap = {
        generic: '通用语言（文本 / 请求 Body）',
        babel: 'JavaScript',
        typescript: 'TypeScript',
        html: 'HTML',
        css: 'CSS',
        json: 'JSON',
        yaml: 'YAML',
        markdown: 'Markdown',
        graphql: 'GraphQL',
        'php-highlight': 'PHP',
        'python-highlight': 'Python',
        'java-highlight': 'Java',
        'ruby-highlight': 'Ruby',
        'go-highlight': 'Go',
        'swift-highlight': 'Swift',
        'csharp-highlight': 'C#',
        'cpp-highlight': 'C/C++',
        'rust-highlight': 'Rust',
        'shell-highlight': 'Shell/Bash',
        'sql-highlight': 'SQL',
        auto: '自动检测'
    };

    const highlightLangMap = {
        generic: 'plaintext',
        babel: 'javascript',
        typescript: 'typescript',
        html: 'xml',
        css: 'css',
        json: 'json',
        yaml: 'yaml',
        markdown: 'markdown',
        graphql: 'graphql',
        'php-highlight': 'php',
        'python-highlight': 'python',
        'java-highlight': 'java',
        'ruby-highlight': 'ruby',
        'go-highlight': 'go',
        'swift-highlight': 'swift',
        'csharp-highlight': 'csharp',
        'cpp-highlight': 'cpp',
        'rust-highlight': 'rust',
        'shell-highlight': 'shell',
        'sql-highlight': 'sql'
    };

    const fileExtMap = {
        generic: 'txt',
        babel: 'js',
        typescript: 'ts',
        html: 'html',
        css: 'css',
        json: 'json',
        yaml: 'yaml',
        markdown: 'md',
        graphql: 'graphql',
        'php-highlight': 'php',
        'python-highlight': 'py',
        'java-highlight': 'java',
        'ruby-highlight': 'rb',
        'go-highlight': 'go',
        'swift-highlight': 'swift',
        'csharp-highlight': 'cs',
        'cpp-highlight': 'cpp',
        'rust-highlight': 'rs',
        'shell-highlight': 'sh',
        'sql-highlight': 'sql'
    };

    let lastDetectedLanguage = '';
    let lastOutput = '';
    let lastDisplayLanguage = '';
    let pendingPasteRaw = null;
    let inputLineCount = 1;
    let outputLineCount = 1;
    let latestRequestId = 0;
    let worker = null;
    let workerBusy = false;
    let workerLoaded = {};
    let formatInFlight = false;
    let displayVersion = 0;
    let resultSnapshot = null;
    const taskController = EditorTaskCore.createController();
    const loader = LazyScriptCore.createResourceLoader({ document: document });
    let formatState = {
        input: '',
        lastValid: null,
        displayed: '',
        status: 'empty',
        error: ''
    };

    function currentRawInput() {
        const recovered = PrettyFormatCore.recoverRawInput(
            document.getElementById('input-code').value,
            pendingPasteRaw
        );
        if (pendingPasteRaw != null && recovered !== pendingPasteRaw) {
            pendingPasteRaw = null;
        }
        return recovered;
    }

    function currentFormatLanguage() {
        const selectedLanguage = document.getElementById('language').value;
        return selectedLanguage === 'auto' ? lastDetectedLanguage || 'babel' : selectedLanguage;
    }

    function setHint(message, kind) {
        const hint = document.getElementById('compute-hint');
        if (!hint) {
            return;
        }
        if (!message) {
            hint.hidden = true;
            hint.textContent = '';
            hint.className = 'result-status';
            return;
        }
        hint.hidden = false;
        hint.className = 'result-status' + (kind ? ' is-' + kind : '');
        hint.textContent = message;
    }

    function applyLinePlan(container, prevCount, nextCount) {
        const plan = EditorRuntimeCore.planLineNumbers(prevCount, nextCount);
        if (plan.type === 'noop') {
            return plan.count;
        }
        if (plan.type === 'append') {
            const fragment = document.createDocumentFragment();
            for (let i = plan.from; i <= plan.to; i += 1) {
                const span = document.createElement('span');
                span.textContent = String(i);
                fragment.appendChild(span);
            }
            container.appendChild(fragment);
            return plan.count;
        }
        if (plan.type === 'remove') {
            while (container.childElementCount > plan.count) {
                container.removeChild(container.lastElementChild);
            }
            return plan.count;
        }
        const fragment = document.createDocumentFragment();
        for (let i = 1; i <= plan.count; i += 1) {
            const span = document.createElement('span');
            span.textContent = String(i);
            fragment.appendChild(span);
        }
        container.replaceChildren(fragment);
        return plan.count;
    }

    function updateInputLineNumbers() {
        const next = EditorRuntimeCore.lineCount(document.getElementById('input-code').value);
        inputLineCount = applyLinePlan(document.getElementById('input-line-numbers'), inputLineCount, next);
    }

    function syncInputScroll() {
        document.getElementById('input-line-numbers').scrollTop = document.getElementById('input-code').scrollTop;
    }

    function syncOutputScroll() {
        const outputCode = document.getElementById('output-code');
        document.getElementById('output-line-numbers').scrollTop = outputCode.parentElement.scrollTop;
    }

    function prettierOptions(language) {
        const shared = { plugins: typeof prettierPlugins !== 'undefined' ? prettierPlugins : [], tabWidth: 2 };
        switch (language) {
            case 'babel':
                return Object.assign({ parser: 'babel', singleQuote: true, trailingComma: 'es5', semi: true }, shared);
            case 'typescript':
                return Object.assign({ parser: 'typescript', singleQuote: true, trailingComma: 'es5', semi: true }, shared);
            case 'html':
                return Object.assign({ parser: 'html', htmlWhitespaceSensitivity: 'css' }, shared);
            case 'css':
                return Object.assign({ parser: 'css' }, shared);
            case 'yaml':
                return Object.assign({ parser: 'yaml' }, shared);
            case 'markdown':
                return Object.assign({ parser: 'markdown', proseWrap: 'preserve' }, shared);
            case 'graphql':
                return Object.assign({ parser: 'graphql' }, shared);
            default:
                throw new Error('不支持的格式化语言: ' + language);
        }
    }

    function restoreFormatButton() {
        formatInFlight = false;
        const formatBtn = document.getElementById('format-btn');
        if (!formatBtn) {
            return;
        }
        formatBtn.disabled = false;
        const icon = document.createElement('i');
        icon.className = 'fas fa-magic';
        formatBtn.replaceChildren(icon, document.createTextNode(' 格式化代码'));
    }

    function showCancelButton() {
        formatInFlight = true;
        const formatBtn = document.getElementById('format-btn');
        formatBtn.disabled = false;
        const loading = document.createElement('span');
        loading.className = 'loading';
        formatBtn.replaceChildren(loading, document.createTextNode(' 取消'));
    }

    function disposeWorker(reason) {
        taskController.dispose(null, reason || 'cancelled');
        taskController.dispose(worker, reason || 'cancelled');
        worker = null;
        workerBusy = false;
        workerLoaded = {};
    }

    function abandonInFlight() {
        latestRequestId = EditorRuntimeCore.nextRequestId(latestRequestId);
        if (formatInFlight) {
            disposeWorker();
            restoreFormatButton();
        }
    }

    function cancelFormat() {
        if (!formatInFlight) {
            return;
        }
        abandonInFlight();
        showStatus('已取消', 'info');
    }

    function persistLanguage(language) {
        try {
            localStorage.setItem(
                PrettyFormatCore.STORAGE_KEY,
                PrettyFormatCore.serializePreference({ language: language })
            );
        } catch (error) { /* 存储不可用时忽略偏好 */ }
    }

    function restoreLanguage(selectEl) {
        try {
            const pref = PrettyFormatCore.parsePreference(localStorage.getItem(PrettyFormatCore.STORAGE_KEY));
            if (pref.language && PrettyFormatCore.isKnownLanguage(pref.language)) {
                selectEl.value = pref.language;
            }
        } catch (error) { /* 读取失败保持自动检测 */ }
    }

    function ensureWorker() {
        if (worker) {
            return worker;
        }
        try {
            worker = new Worker(WORKER_URL);
            return worker;
        } catch (error) {
            return null;
        }
    }

    function postToWorker(target, message) {
        return taskController.wait(target, message).catch(function (error) {
            if (error.reason === 'timeout' || /Worker/.test(error.message)) disposeWorker(error.reason);
            throw error;
        });
    }

    async function ensureHighlight() {
        const assets = PrettyFormatCore.highlightAssets();
        await loader.loadStyle({ url: assets.style, integrity: assets.styleIntegrity });
        await loader.loadScript({ url: assets.script, integrity: assets.scriptIntegrity });
    }

    async function ensurePrettierMain(language) {
        const resources = PrettyFormatCore.prettierResourcesForLanguage(language);
        if (!resources.length) {
            return;
        }
        await loader.loadSequential(resources);
    }

    async function formatOnMain(raw, language) {
        if (language === 'json') {
            const outcome = PrettyFormatCore.processCode(raw, language);
            if (!outcome.ok) {
                throw new Error(outcome.error || '格式化失败，请检查代码语法');
            }
            return outcome.output;
        }
        await ensurePrettierMain(language);
        const options = prettierOptions(language);
        return prettier.format(raw, options);
    }

    async function formatOnWorker(raw, language, requestId) {
        if (workerBusy || taskController.pendingCount()) {
            disposeWorker();
        }
        const target = ensureWorker();
        if (!target) {
            throw EditorTaskCore.taskError('unavailable');
        }
        if (language === 'json') {
            workerBusy = true;
            try {
                const result = await postToWorker(target, {
                    type: 'json',
                    requestId: requestId,
                    code: raw
                });
                return result && result.output;
            } finally {
                workerBusy = false;
            }
        }
        const urls = PrettyFormatCore.prettierUrlsForLanguage(language).filter(function (url) {
            return !workerLoaded[url];
        });
        if (urls.length) {
            await postToWorker(target, { type: 'load', requestId: requestId, urls: urls });
            urls.forEach(function (url) { workerLoaded[url] = true; });
        }
        if (!EditorRuntimeCore.isCurrentRequest(latestRequestId, requestId)) {
            return null;
        }
        workerBusy = true;
        try {
            const options = prettierOptions(language);
            const result = await postToWorker(target, {
                type: 'format',
                requestId: requestId,
                code: raw,
                parser: options.parser,
                singleQuote: options.singleQuote,
                trailingComma: options.trailingComma,
                tabWidth: options.tabWidth,
                semi: options.semi,
                htmlWhitespaceSensitivity: options.htmlWhitespaceSensitivity,
                proseWrap: options.proseWrap
            });
            return result && result.output;
        } finally {
            workerBusy = false;
        }
    }

    function renderFormatStatus() {
        const statusEl = document.getElementById('result-status');
        statusEl.className = 'result-status';
        if (formatState.status === 'stale') {
            statusEl.hidden = false;
            statusEl.classList.add('is-stale');
            statusEl.textContent = formatState.displayed ? '结果已过期，仍显示上次有效结果' : '结果已过期';
            return;
        }
        if (formatState.status === 'failed') {
            statusEl.hidden = false;
            statusEl.classList.add('is-failed');
            statusEl.textContent = formatState.displayed
                ? '格式化失败，仍显示上次有效结果：' + formatState.error
                : (formatState.error || '格式化失败，请检查代码语法');
            return;
        }
        statusEl.hidden = true;
        statusEl.textContent = '';
    }

    function showEmptyResult(title, detail) {
        const emptyState = document.getElementById('empty-state');
        const outputLineNumbers = document.getElementById('output-line-numbers');
        const outputCode = document.getElementById('output-code');
        emptyState.style.display = 'flex';
        outputLineNumbers.style.display = 'flex';
        outputLineCount = applyLinePlan(outputLineNumbers, outputLineCount, 1);
        outputCode.parentElement.scrollTop = 0;
        outputCode.parentElement.scrollLeft = 0;
        outputLineNumbers.scrollTop = 0;
        outputCode.style.display = 'none';
        const heading = emptyState.querySelector('h3');
        const paragraph = emptyState.querySelector('p');
        if (heading) heading.textContent = title;
        if (paragraph) paragraph.textContent = detail;
    }

    async function updateOutputDisplay(formattedCode, language) {
        const emptyState = document.getElementById('empty-state');
        const outputLineNumbers = document.getElementById('output-line-numbers');
        const outputCode = document.getElementById('output-code');
        const codeElement = outputCode.querySelector('code');
        const plan = EditorRuntimeCore.planTextDisplay(formattedCode);
        const viewVersion = ++displayVersion;

        emptyState.style.display = 'none';
        outputLineNumbers.style.display = 'flex';
        outputCode.style.display = 'block';

        const shownLines = EditorRuntimeCore.lineCount(plan.shown);
        outputLineCount = applyLinePlan(outputLineNumbers, outputLineCount, shownLines);

        codeElement.removeAttribute('data-highlighted');
        codeElement.textContent = plan.shown;
        codeElement.className = 'language-' + (highlightLangMap[language] || 'plaintext');

        if (plan.truncated) {
            setHint(EditorRuntimeCore.displayTruncatedMessage(), 'stale');
        }

        const tHigh0 = performance.now();
        if (EditorRuntimeCore.shouldHighlight(plan.shown.length)) {
            try {
                await taskController.waitPromise(ensureHighlight());
                if (viewVersion !== displayVersion) return;
                if (typeof hljs !== 'undefined' && typeof hljs.highlightElement === 'function') {
                    hljs.highlightElement(codeElement);
                }
            } catch (error) {
                if (error.reason === 'cancelled') return;
                if (viewVersion !== displayVersion) return;
                showStatus(EditorRuntimeCore.dependencyFailedMessage(), 'error');
            }
        } else if (!plan.truncated) {
            setHint(EditorRuntimeCore.skippedHighlightMessage(), 'stale');
        }
        window.__EDITOR_PERF__ = window.__EDITOR_PERF__ || { marks: [] };
        window.__EDITOR_PERF__.marks.push({
            name: 'highlight',
            ms: performance.now() - tHigh0,
            nodeCount: outputCode.querySelectorAll('*').length,
            lineNodes: outputLineNumbers.childElementCount,
            truncated: plan.truncated
        });
        syncOutputScroll();
    }

    function renderFormatView() {
        displayVersion += 1;
        renderFormatStatus();
        const stale = formatState.status !== 'valid';
        const copyBtn = document.getElementById('copy-btn');
        const downloadBtn = document.getElementById('download-btn');
        copyBtn.textContent = stale && resultSnapshot ? '复制上次有效结果' : '复制结果';
        downloadBtn.textContent = stale && resultSnapshot ? '下载上次有效结果' : '下载结果';
        copyBtn.disabled = downloadBtn.disabled = !resultSnapshot || formatState.status === 'empty';
        if (formatState.status === 'empty' || formatState.displayed === '') {
            if (formatState.status === 'failed') {
                showEmptyResult('格式化失败', formatState.error || '请检查代码语法');
                return Promise.resolve();
            }
            showEmptyResult('等待格式化', '输入代码后点击"格式化代码"按钮');
            return Promise.resolve();
        }
        return updateOutputDisplay(formatState.displayed, lastDisplayLanguage || currentFormatLanguage());
    }

    function refreshHeavyHint() {
        const chars = EditorRuntimeCore.inputChars(currentRawInput());
        if (!EditorRuntimeCore.shouldAutoCompute(chars)) {
            setHint(EditorRuntimeCore.heavyInputMessage(), 'stale');
        } else if (document.getElementById('compute-hint') && document.getElementById('compute-hint').textContent === EditorRuntimeCore.heavyInputMessage()) {
            setHint('');
        }
    }

    async function formatCode() {
        if (formatInFlight) abandonInFlight();
        const requestId = EditorRuntimeCore.nextRequestId(latestRequestId);
        latestRequestId = requestId;
        const rawCode = currentRawInput();
        const language = currentFormatLanguage();
        const budget = EditorTaskCore.checkBudget(rawCode);
        if (!budget.ok) { showStatus(budget.message, 'error'); restoreFormatButton(); return; }
        formatState = Object.assign({}, formatState, { input: rawCode });

        showCancelButton();

        const t0 = performance.now();
        try {
            const mode = PrettyFormatCore.classifyLanguage(language);
            let outcome;
            if (PrettyFormatCore.isEmptyInput(rawCode, mode)) {
                outcome = PrettyFormatCore.processCode(rawCode, language);
            } else if (mode === 'format') {
                const chars = EditorRuntimeCore.inputChars(rawCode);
                let formatted;
                if (EditorRuntimeCore.shouldUseWorker(chars)) {
                    try {
                        formatted = await formatOnWorker(rawCode, language, requestId);
                    } catch (error) {
                        // Large tasks must stay off the UI thread, including Worker failures.
                        throw error;
                    }
                } else {
                    formatted = await taskController.waitPromise(formatOnMain(rawCode, language));
                }
                if (!EditorRuntimeCore.isCurrentRequest(latestRequestId, requestId)) {
                    return;
                }
                if (formatted == null) {
                    return;
                }
                outcome = {
                    ok: true,
                    mode: mode,
                    status: 'valid',
                    output: String(formatted ?? ''),
                    error: ''
                };
            } else if (EditorRuntimeCore.shouldUseWorker(rawCode.length)) {
                const target = ensureWorker();
                if (!target) throw EditorTaskCore.taskError('unavailable');
                const result = await postToWorker(target, { type: 'process', requestId: requestId, code: rawCode, language: language });
                outcome = result.outcome;
            } else {
                outcome = PrettyFormatCore.processCode(rawCode, language);
            }
            if (!EditorRuntimeCore.isCurrentRequest(latestRequestId, requestId)) {
                return;
            }
            formatState = PrettyFormatCore.applyProcessOutcome(formatState, outcome);
            lastOutput = formatState.displayed || '';
            if (outcome.ok) {
                lastDisplayLanguage = language;
                resultSnapshot = Object.freeze({ input: rawCode, language: language, extension: fileExtMap[language] || 'txt', output: lastOutput, requestId: requestId });
            }
            await renderFormatView();
            if (!EditorRuntimeCore.isCurrentRequest(latestRequestId, requestId)) return;
            if (outcome.ok) {
                const successText = mode === 'highlight'
                    ? '已按原文高亮'
                    : mode === 'generic'
                        ? '文本整理完成'
                        : '代码格式化完成！';
                showStatus(successText, 'success');
            } else {
                showStatus(outcome.error || '格式化失败，请检查代码语法', 'error');
            }
        } catch (error) {
            if (!EditorRuntimeCore.isCurrentRequest(latestRequestId, requestId)) {
                return;
            }
            const depFailed = /加载失败|尚未加载|NO_WORKER/.test(String(error && error.message));
            formatState = PrettyFormatCore.applyProcessOutcome(formatState, {
                ok: false,
                status: 'failed',
                error: depFailed ? EditorRuntimeCore.dependencyFailedMessage() : (error.message || '格式化失败，请检查代码语法')
            });
            lastOutput = formatState.displayed || '';
            await renderFormatView();
            if (!EditorRuntimeCore.isCurrentRequest(latestRequestId, requestId)) return;
            showStatus(formatState.error || '格式化失败，请检查代码语法', 'error');
        } finally {
            if (EditorRuntimeCore.isCurrentRequest(latestRequestId, requestId)) {
                restoreFormatButton();
            }
            window.__EDITOR_PERF__ = window.__EDITOR_PERF__ || { marks: [] };
            window.__EDITOR_PERF__.marks.push({ name: 'formatCode', ms: performance.now() - t0, requestId: requestId });
        }
    }

    function detectLanguage() {
        const inputCode = document.getElementById('input-code');
        const languageSelect = document.getElementById('language');
        const code = inputCode.value.trim();
        if (!code || languageSelect.value !== 'auto') return;

        let detectedLanguage = 'babel';
        if (PrettyFormatCore.looksLikeJson(code)) {
            if (EditorRuntimeCore.shouldUseWorker(code.length)) {
                detectedLanguage = 'json';
            } else {
                try {
                    JSON.parse(code);
                    detectedLanguage = 'json';
                } catch (e) { /* not json */ }
            }
        } else if (code.includes('<!DOCTYPE html>') || code.match(/<html.*>/i)) {
            detectedLanguage = 'html';
        } else if (code.match(/[\w-]+\s*:\s*[^;]+;/) && code.includes('{') && !code.includes('function')) {
            detectedLanguage = 'css';
        } else if (code.includes(':') && (code.includes('interface ') || code.includes('type ') || code.match(/:\s*(string|number|boolean|any)\b/))) {
            detectedLanguage = 'typescript';
        } else if (code.includes('def ') && code.includes('print(')) {
            detectedLanguage = 'python-highlight';
        } else if (code.includes('<?php')) {
            detectedLanguage = 'php-highlight';
        }

        if (detectedLanguage !== lastDetectedLanguage) {
            lastDetectedLanguage = detectedLanguage;
            const detectedLanguageEl = document.getElementById('detected-language');
            const languageNameEl = document.getElementById('language-name');
            languageNameEl.textContent = languageMap[detectedLanguage];
            detectedLanguageEl.classList.add('show');
            if (EditorRuntimeCore.shouldAutoCompute(EditorRuntimeCore.inputChars(currentRawInput()))) {
                const detectedRequest = latestRequestId;
                setTimeout(function () {
                    if (languageSelect.value === 'auto' && detectedRequest === latestRequestId) {
                        formatCode();
                    }
                }, 100);
            }
        }
    }

    function handleInputChange() {
        updateInputLineNumbers();
        const raw = currentRawInput();
        if (formatInFlight && raw !== formatState.input) {
            abandonInFlight();
        }
        const language = document.getElementById('language').value === 'auto' ? lastDetectedLanguage || 'auto' : document.getElementById('language').value;
        formatState = PrettyFormatCore.nextInputState(formatState, raw, language);
        if (formatState.status === 'empty') resultSnapshot = null;
        lastOutput = formatState.displayed || '';
        renderFormatView();
        refreshHeavyHint();
        if (document.getElementById('language').value === 'auto' && currentRawInput().trim()) {
            detectLanguage();
        }
    }

    function copyCode() {
        if (formatState.status === 'empty' || lastOutput === '') {
            showStatus('没有可复制的格式化结果', 'error');
            return;
        }
        const snapshot = resultSnapshot;
        const stale = formatState.status !== 'valid' || snapshot.input !== currentRawInput() || snapshot.language !== currentFormatLanguage();
        ToolsClipboard.copyText(snapshot.output, { element: document.querySelector('#output-code code') }).then(function (result) {
            const nowStale = stale || snapshot.input !== currentRawInput() || snapshot.language !== currentFormatLanguage();
            showStatus(result.ok ? (nowStale ? '已复制上次有效结果（' + languageMap[snapshot.language] + '）' : '格式化结果已复制到剪贴板') : result.message, result.ok ? 'success' : 'error');
        });
    }

    function copyInputCode() {
        const inputCode = document.getElementById('input-code').value;
        if (!inputCode.trim()) {
            showStatus('输入框为空', 'error');
            return;
        }
        navigator.clipboard.writeText(inputCode).then(function () {
            showStatus('输入代码已复制到剪贴板', 'success');
        }).catch(function () {
            showStatus('复制失败，请手动选择复制', 'error');
        });
    }

    function downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus('文件 ' + filename + ' 下载成功', 'success');
    }

    function downloadCode() {
        if (formatState.status === 'empty' || lastOutput === '') {
            showStatus('没有可下载的格式化结果', 'error');
            return;
        }
        const snapshot = resultSnapshot;
        const stale = formatState.status !== 'valid' || snapshot.input !== currentRawInput() || snapshot.language !== currentFormatLanguage();
        downloadFile(lastOutput, 'formatted-code.' + snapshot.extension);
        if (stale) showStatus('已下载上次有效结果（' + languageMap[snapshot.language] + '），文件后缀沿用该结果语言', 'info');
    }

    function downloadInputCode() {
        const inputCode = document.getElementById('input-code').value;
        if (!inputCode.trim()) {
            showStatus('输入框为空', 'error');
            return;
        }
        const language = document.getElementById('language').value === 'auto' ? lastDetectedLanguage : document.getElementById('language').value;
        downloadFile(inputCode, 'input-code.' + (fileExtMap[language] || 'txt'));
    }

    function clearCode() {
        abandonInFlight();
        document.getElementById('input-code').value = '';
        inputLineCount = applyLinePlan(document.getElementById('input-line-numbers'), inputLineCount, 1);
        document.getElementById('detected-language').classList.remove('show');
        lastDetectedLanguage = '';
        lastOutput = '';
        lastDisplayLanguage = '';
        resultSnapshot = null;
        pendingPasteRaw = null;
        setHint('');
        formatState = PrettyFormatCore.nextInputState(formatState, '', 'generic');
        renderFormatView();
        showStatus('已清空所有内容', 'info');
        document.getElementById('input-code').focus();
    }

    document.addEventListener('DOMContentLoaded', function () {
        const inputCode = document.getElementById('input-code');
        const languageSelect = document.getElementById('language');
        document.getElementById('format-btn').addEventListener('click', function () {
            if (formatInFlight) {
                cancelFormat();
                return;
            }
            formatCode();
        });
        document.getElementById('copy-btn').addEventListener('click', copyCode);
        document.getElementById('copy-input-btn').addEventListener('click', copyInputCode);
        document.getElementById('download-btn').addEventListener('click', downloadCode);
        document.getElementById('download-input-btn').addEventListener('click', downloadInputCode);
        document.getElementById('clear-btn').addEventListener('click', clearCode);

        inputCode.addEventListener('paste', function (event) {
            const clipboard = event.clipboardData || window.clipboardData;
            pendingPasteRaw = clipboard ? clipboard.getData('text') : null;
            handleInputChange();
        });
        inputCode.addEventListener('input', handleInputChange);
        inputCode.addEventListener('scroll', syncInputScroll);
        inputCode.addEventListener('input', updateInputLineNumbers);
        document.getElementById('output-code').parentElement.addEventListener('scroll', syncOutputScroll);

        restoreLanguage(languageSelect);

        languageSelect.addEventListener('change', function () {
            persistLanguage(languageSelect.value);
            abandonInFlight();
            const language = languageSelect.value === 'auto' ? lastDetectedLanguage || 'auto' : languageSelect.value;
            formatState = PrettyFormatCore.nextInputState(formatState, currentRawInput(), language);
            lastOutput = formatState.displayed || '';
            renderFormatView();
            const modeLanguage = language === 'auto' ? 'babel' : language;
            if (!PrettyFormatCore.isEmptyInput(currentRawInput(), PrettyFormatCore.classifyLanguage(modeLanguage))) {
                if (EditorRuntimeCore.shouldAutoCompute(EditorRuntimeCore.inputChars(currentRawInput()))) {
                    formatCode();
                } else {
                    setHint(EditorRuntimeCore.heavyInputMessage(), 'stale');
                }
            }
            if (languageSelect.value !== 'auto') {
                document.getElementById('detected-language').classList.remove('show');
            }
        });

        updateInputLineNumbers();
        renderFormatView();
        inputCode.focus();
        window.__EDITOR_PERF__ = window.__EDITOR_PERF__ || { marks: [] };
        window.__EDITOR_PERF__.marks.push({ name: 'editable', at: performance.now(), ready: true });
    });

    window.addEventListener('pagehide', function () { abandonInFlight(); disposeWorker(); });
    window.formatCode = formatCode;
})();
