(function () {
    'use strict';

    const WORKER_URL = '../js/regex-tool-worker.js';
    const DEBOUNCE_MS = 200;
    const TIMEOUT_MS = 1200;
    const PING_TIMEOUT_MS = 2000;

    function core() {
        return window.RegexToolCore;
    }

    function getSelectedFlags(flagInputs) {
        return Array.from(flagInputs)
            .filter(function (input) { return input.checked; })
            .map(function (input) { return input.dataset.flag; })
            .join('');
    }

    function setSelectedFlags(flagInputs, flags) {
        Array.from(flagInputs).forEach(function (input) {
            input.checked = flags.includes(input.dataset.flag);
        });
    }

    function insertAtCursor(input, text) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        input.value = input.value.slice(0, start) + text + input.value.slice(end);
        input.focus();
        input.selectionStart = input.selectionEnd = start + text.length;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function setStatus(statusText, message, kind) {
        statusText.textContent = message;
        statusText.className = 'status-text' + (kind ? ' ' + kind : '');
        statusText.setAttribute('data-regex-status', kind || 'info');
    }

    function setEmptyState(container, message, extraClass) {
        container.textContent = '';
        const div = document.createElement('div');
        div.className = extraClass ? 'empty-state ' + extraClass : 'empty-state';
        div.textContent = message;
        container.appendChild(div);
    }

    function setEmptyPreview(container, message, isError) {
        if (!container) {
            return;
        }
        container.replaceChildren();
        const span = document.createElement('span');
        span.className = 'empty-preview';
        if (isError) {
            span.style.color = 'var(--error-color)';
        }
        span.textContent = message;
        container.appendChild(span);
    }

    function renderHighlightedMatches(container, testText, matches, options) {
        if (!container) {
            return;
        }
        const opts = options && typeof options === 'object' ? options : {};
        const source = String(testText || '');
        if (!source) {
            setEmptyPreview(container, opts.emptyMessage || '输入测试文本后在此展示高亮');
            return;
        }

        const segments = core().buildHighlightSegments(source, matches);
        if (!segments.length || (segments.length === 1 && segments[0].type === 'text')) {
            container.replaceChildren();
            container.appendChild(document.createTextNode(source));
            return;
        }

        const frag = document.createDocumentFragment();
        let colorCounter = 0;
        for (let i = 0; i < segments.length; i += 1) {
            const segment = segments[i];
            if (segment.type === 'text') {
                frag.appendChild(document.createTextNode(segment.value));
                continue;
            }
            if (segment.type === 'zero') {
                const zero = document.createElement('span');
                zero.className = opts.zeroClass || 'match-zerowidth';
                zero.title = '零宽匹配';
                frag.appendChild(zero);
                continue;
            }
            const mark = document.createElement(opts.striped ? 'span' : 'mark');
            if (opts.striped) {
                mark.className = 'match-highlight ' + (colorCounter % 2 === 0 ? 'match-blue' : 'match-green');
                colorCounter += 1;
            }
            mark.textContent = segment.value;
            frag.appendChild(mark);
        }
        container.replaceChildren(frag);
    }

    function renderMatches(container, matches, displayTruncated, displayLimit) {
        if (!matches.length) {
            setEmptyState(container, '暂无匹配结果');
            return;
        }

        const visible = core().sliceMatchesForDisplay(matches, displayLimit);
        container.innerHTML = visible.map(function (match, index) {
            const groups = match.groups.length
                ? '<div class="match-groups">' + match.groups.map(function (group) {
                    return '<span>组 ' + group.index + ': <code>' + core().escapeHtml(group.value ?? '未匹配') + '</code></span>';
                }).join('') + '</div>'
                : '';
            const namedGroups = Object.keys(match.namedGroups).length
                ? '<div class="match-groups">' + Object.entries(match.namedGroups).map(function (entry) {
                    return '<span>' + core().escapeHtml(entry[0]) + ': <code>' + core().escapeHtml(entry[1] ?? '未匹配') + '</code></span>';
                }).join('') + '</div>'
                : '';

            return (
                '<div class="match-item">' +
                    '<div class="match-item-head">' +
                        '<strong>#' + (index + 1) + '</strong>' +
                        '<span>index ' + match.index + ' - ' + match.endIndex + '</span>' +
                    '</div>' +
                    '<code>' + core().escapeHtml(match.text || '零宽匹配') + '</code>' +
                    groups +
                    namedGroups +
                '</div>'
            );
        }).join('');

        if (displayTruncated) {
            const note = document.createElement('div');
            note.className = 'empty-state';
            note.textContent = core().formatMsg(core().MESSAGES.truncatedDisplay, displayLimit);
            container.appendChild(note);
        }
    }

    function renderExplanation(container, explanations) {
        if (!explanations.length) {
            setEmptyState(container, '输入正则后会生成中文解释');
            return;
        }

        container.innerHTML = explanations.map(function (item) {
            return (
                '<div class="explain-item">' +
                    '<code>' + core().escapeHtml(item.token) + '</code>' +
                    '<div>' +
                        '<strong>' + core().escapeHtml(item.label) + '</strong>' +
                        '<p>' + core().escapeHtml(item.description) + '</p>' +
                    '</div>' +
                '</div>'
            );
        }).join('');
    }

    function showToast(message, type) {
        const kind = type || 'info';
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + kind;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = 'var(--radius-md)';
        toast.style.color = 'var(--text-inverse)';
        toast.style.zIndex = '1000';
        toast.style.boxShadow = 'var(--shadow-md)';
        toast.style.transition = 'all 0.3s ease';
        toast.style.fontWeight = '500';
        toast.style.fontSize = '14px';

        if (kind === 'error') {
            toast.style.backgroundColor = 'var(--error-color)';
        } else if (kind === 'success') {
            toast.style.backgroundColor = 'var(--success-color)';
        } else {
            toast.style.backgroundColor = 'var(--primary-color)';
        }

        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, 20px)';
            setTimeout(function () {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    async function writeClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                textarea.remove();
            }
            showToast('已成功复制到剪贴板！', 'success');
        } catch (err) {
            showToast('复制失败，请手动选择复制。', 'error');
        }
    }

    function pingWorker(worker) {
        return new Promise(function (resolve, reject) {
            const timer = setTimeout(function () {
                cleanup();
                reject(new Error('worker ping timeout'));
            }, PING_TIMEOUT_MS);

            function onMessage(event) {
                const data = event.data || {};
                if (data.type === 'ready') {
                    cleanup();
                    resolve(worker);
                }
            }

            function onError(error) {
                cleanup();
                reject(error);
            }

            function cleanup() {
                clearTimeout(timer);
                worker.removeEventListener('message', onMessage);
                worker.removeEventListener('error', onError);
            }

            worker.addEventListener('message', onMessage);
            worker.addEventListener('error', onError);
            try {
                worker.postMessage({ type: 'ping', requestId: 0 });
            } catch (error) {
                cleanup();
                reject(error);
            }
        });
    }

    function createDedicatedWorker() {
        return new Worker(WORKER_URL);
    }

    function createBlobWorker() {
        const source = core().createWorkerBootstrapSource();
        const blob = new Blob([source], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);
        worker._blobUrl = url;
        return worker;
    }

    function probeWorkerCreation() {
        const result = {
            dedicated: false,
            dedicatedError: '',
            blob: false,
            blobError: '',
            protocol: String(location.protocol || '')
        };
        try {
            const worker = createDedicatedWorker();
            worker.terminate();
            result.dedicated = true;
        } catch (error) {
            result.dedicatedError = String(error && error.message ? error.message : error);
        }
        try {
            const worker = createBlobWorker();
            if (worker._blobUrl) {
                URL.revokeObjectURL(worker._blobUrl);
            }
            worker.terminate();
            result.blob = true;
        } catch (error) {
            result.blobError = String(error && error.message ? error.message : error);
        }
        return result;
    }

    async function probeWorkerReady() {
        const result = {
            dedicatedReady: false,
            dedicatedError: '',
            blobReady: false,
            blobError: '',
            protocol: String(location.protocol || '')
        };
        let dedicated = null;
        try {
            dedicated = createDedicatedWorker();
            await pingWorker(dedicated);
            dedicated.terminate();
            dedicated = null;
            result.dedicatedReady = true;
        } catch (error) {
            if (dedicated) {
                try { dedicated.terminate(); } catch (ignore) { /* ignore */ }
            }
            result.dedicatedError = String(error && error.message ? error.message : error);
        }
        let blobWorker = null;
        try {
            blobWorker = createBlobWorker();
            await pingWorker(blobWorker);
            if (blobWorker._blobUrl) {
                URL.revokeObjectURL(blobWorker._blobUrl);
            }
            blobWorker.terminate();
            blobWorker = null;
            result.blobReady = true;
        } catch (error) {
            if (blobWorker) {
                try { blobWorker.terminate(); } catch (ignore) { /* ignore */ }
            }
            result.blobError = String(error && error.message ? error.message : error);
        }
        return result;
    }

    let preferredMode = null;

    function canEvaluateOnMain(rawRegex, flags) {
        try {
            const parsed = core().parseRegexLiteral(rawRegex, flags);
            return parsed.pattern === '';
        } catch (error) {
            return true;
        }
    }

    async function createWorkerByMode() {
        if (preferredMode === 'none') {
            return null;
        }
        if (preferredMode === 'dedicated') {
            const dedicated = createDedicatedWorker();
            await pingWorker(dedicated);
            return dedicated;
        }
        if (preferredMode === 'blob') {
            const blobWorker = createBlobWorker();
            await pingWorker(blobWorker);
            return blobWorker;
        }
        try {
            const dedicated = createDedicatedWorker();
            await pingWorker(dedicated);
            preferredMode = 'dedicated';
            return dedicated;
        } catch (dedicatedError) {
            try {
                const blobWorker = createBlobWorker();
                await pingWorker(blobWorker);
                preferredMode = 'blob';
                return blobWorker;
            } catch (blobError) {
                preferredMode = 'none';
                return null;
            }
        }
    }

    function createWorkerSession() {
        let latestRequestId = 0;
        let sessionWorker = null;
        let busy = false;
        let creatingWorker = null;
        let lifecycleId = 0;
        let timeoutTimer = null;
        const pendingResolvers = new Map();

        function resolvePending(requestId, outcome) {
            const resolve = pendingResolvers.get(requestId);
            if (!resolve) {
                return;
            }
            pendingResolvers.delete(requestId);
            resolve(outcome);
        }

        function resolveAllPending(outcome) {
            pendingResolvers.forEach(function (resolve) {
                resolve(outcome);
            });
            pendingResolvers.clear();
        }

        function disposeWorker(reason) {
            lifecycleId += 1;
            creatingWorker = null;
            if (timeoutTimer) {
                clearTimeout(timeoutTimer);
                timeoutTimer = null;
            }
            if (sessionWorker) {
                try {
                    sessionWorker.terminate();
                } catch (error) { /* ignore */ }
                if (sessionWorker._blobUrl) {
                    try {
                        URL.revokeObjectURL(sessionWorker._blobUrl);
                    } catch (error) { /* ignore */ }
                }
                sessionWorker = null;
            }
            busy = false;
            resolveAllPending({
                kind: reason || 'stale',
                message: reason === 'timeout' ? core().MESSAGES.timeout : core().MESSAGES.cancelled
            });
        }

        function bindWorker(nextWorker) {
            nextWorker.onmessage = function (event) {
                const data = event.data || {};
                const handled = core().handleWorkerMessage(latestRequestId, data);
                if (handled.ignore) {
                    return;
                }
                busy = false;
                if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                    timeoutTimer = null;
                }
                if (data.type === 'error') {
                    resolvePending(data.requestId, {
                        kind: 'error',
                        message: String(data.error || '')
                    });
                    return;
                }
                resolvePending(data.requestId, {
                    kind: 'result',
                    result: handled.result
                });
            };
            nextWorker.onerror = function () {
                if (!busy) {
                    return;
                }
            };
        }

        async function ensureWorker() {
            if (sessionWorker) {
                return sessionWorker;
            }
            if (creatingWorker) {
                return creatingWorker;
            }
            const creationId = lifecycleId;
            const job = createWorkerByMode().then(function (next) {
                if (creatingWorker === job) creatingWorker = null;
                if (!next) return null;
                if (creationId !== lifecycleId) {
                    next.terminate();
                    if (next._blobUrl) URL.revokeObjectURL(next._blobUrl);
                    return null;
                }
                sessionWorker = next;
                bindWorker(sessionWorker);
                return sessionWorker;
            }).catch(function (error) {
                if (creatingWorker === job) creatingWorker = null;
                throw error;
            });
            creatingWorker = job;
            return creatingWorker;
        }

        async function recreateWorker() {
            disposeWorker('stale');
            return ensureWorker();
        }

        async function evaluateAsync(payload) {
            const api = core();
            const requestId = latestRequestId + 1;
            latestRequestId = requestId;
            const body = payload && typeof payload === 'object' ? payload : {};

            if (canEvaluateOnMain(body.rawRegex, body.flags)) {
                if (busy) {
                    disposeWorker('stale');
                }
                return {
                    kind: 'result',
                    result: api.evaluateRegex(body),
                    requestId: requestId
                };
            }

            if (busy) {
                await recreateWorker();
            }

            const active = await ensureWorker();
            if (!active) {
                return {
                    kind: 'unavailable',
                    message: api.MESSAGES.unavailable,
                    requestId: requestId
                };
            }

            if (requestId !== latestRequestId) {
                return { kind: 'stale', requestId: requestId };
            }

            return new Promise(function (resolve) {
                pendingResolvers.set(requestId, resolve);
                busy = true;
                if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                }
                timeoutTimer = setTimeout(function () {
                    if (requestId !== latestRequestId) {
                        resolvePending(requestId, { kind: 'stale', requestId: requestId });
                        return;
                    }
                    disposeWorker('timeout');
                }, TIMEOUT_MS);

                try {
                    active.postMessage(api.createWorkerRequest(requestId, body));
                } catch (error) {
                    busy = false;
                    pendingResolvers.delete(requestId);
                    resolve({
                        kind: 'unavailable',
                        message: api.MESSAGES.unavailable,
                        requestId: requestId
                    });
                }
            });
        }

        return {
            evaluateAsync: evaluateAsync,
            cancel: function () { latestRequestId += 1; disposeWorker('stale'); },
            getLatestRequestId: function () { return latestRequestId; },
            getPreferredWorkerMode: function () { return preferredMode; }
        };
    }

    const generatorSession = createWorkerSession();
    const testerSession = createWorkerSession();

    function evaluateAsync(payload) {
        return generatorSession.evaluateAsync(payload);
    }

    let isInitialized = false;

    function initRegexTool() {
        if (isInitialized) return;
        const regexInput = document.getElementById('regexInput');
        if (!regexInput) {
            return;
        }
        if (!core()) {
            return;
        }
        isInitialized = true;

        const flagInputs = document.querySelectorAll('#flagsPanel [data-flag]');
        const testTextInput = document.getElementById('testTextInput');
        const replaceInput = document.getElementById('replaceInput');
        const replaceOutput = document.getElementById('replaceOutput');
        const matchSummary = document.getElementById('matchSummary');
        const matchList = document.getElementById('matchList');
        const highlightedText = document.getElementById('highlightedText');
        const explanationList = document.getElementById('explanationList');
        const statusText = document.getElementById('statusText');
        const copyRegexBtn = document.getElementById('copyRegexBtn');
        const copyMatchesBtn = document.getElementById('copyMatchesBtn');
        const copyReplaceBtn = document.getElementById('copyReplaceBtn');
        const manualPresetSelect = document.getElementById('manualPresetSelect');

        let lastEvaluation = null;
        let isLoadingPreset = false;
        let composingCount = 0;
        let debounceTimer = null;
        let testerRequestId = 0;

        function renderUnavailableOrError(message, kind) {
            matchSummary.textContent = kind === 'error' ? '表达式错误' : '无法计算';
            setStatus(statusText, message, kind === 'warning' ? 'warning' : 'error');
            highlightedText.textContent = testTextInput.value;
            setEmptyState(matchList, message, kind === 'error' ? 'error' : '');
            replaceOutput.value = testTextInput.value;
            renderExplanation(explanationList, []);
        }

        function renderEvaluation(evaluation) {
            if (!evaluation) {
                return;
            }
            lastEvaluation = evaluation;

            if (evaluation.status === 'empty-pattern') {
                matchSummary.textContent = '0 个匹配';
                setStatus(statusText, evaluation.message, '');
                if (!testTextInput.value) {
                    setEmptyPreview(highlightedText, '输入测试文本后在此展示高亮');
                } else {
                    highlightedText.textContent = testTextInput.value;
                }
                setEmptyState(matchList, evaluation.message);
                replaceOutput.value = testTextInput.value;
                renderExplanation(explanationList, []);
                return;
            }

            if (!evaluation.isValid) {
                matchSummary.textContent = '表达式错误';
                setStatus(statusText, evaluation.message || evaluation.error, 'error');
                highlightedText.textContent = testTextInput.value;
                setEmptyState(matchList, evaluation.message || evaluation.error, 'error');
                replaceOutput.value = testTextInput.value;
                renderExplanation(explanationList, []);
                return;
            }

            if (evaluation.parsed && evaluation.parsed.usedLiteralSyntax) {
                setSelectedFlags(flagInputs, evaluation.parsed.flags);
            }

            const displayLimit = evaluation.budgets
                ? evaluation.budgets.maxDisplayCount
                : core().DEFAULT_BUDGETS.maxDisplayCount;
            matchSummary.textContent = evaluation.matches.length + ' 个匹配 / JavaScript / flags: ' + (evaluation.parsed.flags || '无');
            const extra = evaluation.messages && evaluation.messages.length
                ? '；' + evaluation.messages.join('；')
                : '';
            const kind = evaluation.status === 'truncated' ? 'warning' : (evaluation.matches.length ? 'success' : '');
            const base = evaluation.matches.length ? core().MESSAGES.success : core().MESSAGES.noMatch;
            setStatus(statusText, extra ? base + extra : base, kind);
            renderHighlightedMatches(highlightedText, testTextInput.value, evaluation.matches);
            renderMatches(matchList, evaluation.matches, evaluation.displayTruncated, displayLimit);
            replaceOutput.value = evaluation.replacedText;
            renderExplanation(explanationList, core().explainPattern(evaluation.parsed.pattern));
        }

        function renderTimeout() {
            lastEvaluation = null;
            matchSummary.textContent = '已超时';
            setStatus(statusText, core().MESSAGES.timeout, 'error');
            setEmptyState(matchList, core().MESSAGES.timeout, 'error');
        }

        async function dispatchEvaluation() {
            const selectedFlags = getSelectedFlags(flagInputs);
            const payload = {
                rawRegex: regexInput.value,
                testText: testTextInput.value,
                replacement: replaceInput.value,
                flags: selectedFlags
            };
            const myId = testerRequestId + 1;
            testerRequestId = myId;

            if (!canEvaluateOnMain(payload.rawRegex, payload.flags)) {
                setStatus(statusText, core().MESSAGES.running, '');
            }

            const outcome = await testerSession.evaluateAsync(payload);
            if (myId !== testerRequestId || outcome.kind === 'stale') {
                return;
            }
            if (outcome.kind === 'timeout') {
                renderTimeout();
                return;
            }
            if (outcome.kind === 'unavailable') {
                renderUnavailableOrError(outcome.message || core().MESSAGES.unavailable, 'error');
                try {
                    const parsed = core().parseRegexLiteral(payload.rawRegex, payload.flags);
                    renderExplanation(explanationList, core().explainPattern(parsed.pattern));
                } catch (error) { /* ignore */ }
                return;
            }
            if (outcome.kind === 'error') {
                renderUnavailableOrError(core().MESSAGES.syntaxPrefix + String(outcome.message || ''), 'error');
                return;
            }
            renderEvaluation(outcome.result);
        }

        function scheduleEvaluation() {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(function () {
                debounceTimer = null;
                dispatchEvaluation();
            }, DEBOUNCE_MS);
        }

        function evaluateNow() {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }
            return dispatchEvaluation();
        }

        function onComposableInput(event) {
            if (!core().shouldEvaluateInput(event, composingCount > 0)) {
                return;
            }
            if (!isLoadingPreset) {
                scheduleEvaluation();
            }
        }

        [regexInput, testTextInput, replaceInput].forEach(function (element) {
            element.addEventListener('compositionstart', function () {
                composingCount += 1;
            });
            element.addEventListener('compositionend', function () {
                composingCount = Math.max(0, composingCount - 1);
                scheduleEvaluation();
            });
            element.addEventListener('input', onComposableInput);
        });
        flagInputs.forEach(function (input) {
            input.addEventListener('change', function () {
                if (!isLoadingPreset) {
                    scheduleEvaluation();
                }
            });
        });

        document.querySelectorAll('[data-insert-token]').forEach(function (button) {
            button.addEventListener('click', function () {
                insertAtCursor(regexInput, button.dataset.insertToken);
            });
        });

        if (manualPresetSelect) {
            manualPresetSelect.addEventListener('change', function () {
                const idx = manualPresetSelect.value;
                const presetsList = window.PRESETS || [];
                const preset = presetsList[idx];
                if (!preset) return;

                isLoadingPreset = true;
                regexInput.value = preset.pattern.replace(/^\/|\/[gim]*$/g, '');
                testTextInput.value = preset.test;
                replaceInput.value = preset.replacement ?? '';
                const presetFlags = preset.flags || 'g';
                flagInputs.forEach(function (input) {
                    input.checked = presetFlags.includes(input.dataset.flag);
                });
                evaluateNow().then(function () {
                    isLoadingPreset = false;
                    showToast('已成功载入预设：“' + preset.name + '”', 'success');
                });
            });
        }

        if (copyRegexBtn) {
            copyRegexBtn.addEventListener('click', function () { writeClipboard(regexInput.value); });
        }
        if (copyMatchesBtn) {
            copyMatchesBtn.addEventListener('click', function () {
                const text = lastEvaluation && lastEvaluation.matches.length
                    ? lastEvaluation.matches.map(function (match, index) {
                        return (index + 1) + '. [' + match.index + '-' + match.endIndex + '] ' + match.text;
                    }).join('\n')
                    : '';
                writeClipboard(text);
            });
        }
        if (copyReplaceBtn) {
            copyReplaceBtn.addEventListener('click', function () { writeClipboard(replaceOutput.value); });
        }

        window.RegexToolClient = {
            probeWorkerCreation: probeWorkerCreation,
            getPreferredWorkerMode: function () { return testerSession.getPreferredWorkerMode(); },
            evaluateNow: evaluateNow,
            getLatestRequestId: function () { return testerSession.getLatestRequestId(); }
        };

        evaluateNow();
    }

    window.RegexToolUi = {
        initRegexTool: initRegexTool,
        evaluateAsync: evaluateAsync,
        createValidationSession: createWorkerSession,
        renderHighlightedMatches: renderHighlightedMatches,
        setEmptyPreview: setEmptyPreview,
        showToast: showToast
    };

    window.showToast = showToast;

    window.RegexToolProbe = {
        probeWorkerCreation: probeWorkerCreation,
        probeWorkerReady: probeWorkerReady,
        workerUrl: WORKER_URL,
        timeoutMs: TIMEOUT_MS,
        debounceMs: DEBOUNCE_MS
    };

    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', initRegexTool);
    }
})();
