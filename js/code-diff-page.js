(function () {
    'use strict';

    const WORKER_URL = '../js/code-diff-worker.js';
    let diffStyle = 'side-by-side';
    let compareTimer = null;
    let session = CodeDiffCore.createSession();
    let latestRequestId = 0;
    let lastPatch = '';
    let worker = null;
    let workerBusy = false;
    let workerLoadedJsdiff = false;
    let compareInFlight = false;
    let resultSnapshot = null;
    const taskController = EditorTaskCore.createController();
    const loader = LazyScriptCore.createResourceLoader({ document: document });

    function showStatus(message, type) {
        const statusEl = document.getElementById('status-message');
        statusEl.className = 'status-message status-' + (type || 'info');
        const icon = document.createElement('i');
        const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
        icon.className = 'fas fa-' + iconName;
        statusEl.replaceChildren(icon, document.createTextNode(' ' + String(message)));
        statusEl.classList.add('show');
        setTimeout(function () { statusEl.classList.remove('show'); }, 3000);
    }

    function setHint(message, kind) {
        const hint = document.getElementById('compute-hint');
        if (!hint) return;
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

    function currentInputs() {
        return {
            oldText: document.getElementById('old-code').value,
            newText: document.getElementById('new-code').value
        };
    }

    function applyInputs(patch) {
        const next = patch && typeof patch === 'object' ? patch : currentInputs();
        if (patch) {
            if (patch.oldText !== undefined) document.getElementById('old-code').value = patch.oldText;
            if (patch.newText !== undefined) document.getElementById('new-code').value = patch.newText;
        }
        const incomingOld = next.oldText !== undefined ? next.oldText : document.getElementById('old-code').value;
        const incomingNew = next.newText !== undefined ? next.newText : document.getElementById('new-code').value;
        if (incomingOld === session.oldText && incomingNew === session.newText) return;
        abandonCompare();
        session = CodeDiffCore.setInputs(session, {
            oldText: next.oldText !== undefined ? next.oldText : document.getElementById('old-code').value,
            newText: next.newText !== undefined ? next.newText : document.getElementById('new-code').value
        });
        const chars = EditorRuntimeCore.combinedChars(session.oldText, session.newText);
        if (!EditorRuntimeCore.shouldAutoCompute(chars)) {
            setHint(EditorRuntimeCore.heavyInputMessage(), 'stale');
        } else {
            setHint('');
        }
        renderSession(session.status === 'empty');
    }

    function renderEmptyDiff() {
        const target = document.getElementById('diff-output');
        const wrap = document.createElement('div');
        wrap.className = 'empty-diff';
        const icon = document.createElement('i');
        icon.className = 'fas fa-code-compare';
        const heading = document.createElement('h3');
        heading.textContent = '等待对比';
        const detail = document.createElement('p');
        detail.textContent = '在上方输入两段代码，点击“开始对比”按钮查看差异';
        wrap.append(icon, heading, detail);
        target.replaceChildren(wrap);
        lastPatch = '';
        resultSnapshot = null;
    }

    function drawTruncatedPatch(patch) {
        const plan = EditorRuntimeCore.planTextDisplay(patch);
        const pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.margin = '0';
        pre.style.fontFamily = 'var(--font-mono)';
        pre.style.fontSize = '13px';
        pre.textContent = plan.shown;
        document.getElementById('diff-output').replaceChildren(pre);
        if (plan.truncated) {
            setHint(EditorRuntimeCore.displayTruncatedMessage(), 'stale');
        }
    }

    function drawCurrentDiff() {
        if (!session.result) {
            renderEmptyDiff();
            return;
        }
        lastPatch = String(session.result);
        const plan = EditorRuntimeCore.planTextDisplay(lastPatch);
        if (plan.truncated || typeof Diff2HtmlUI !== 'function') {
            drawTruncatedPatch(lastPatch);
            return;
        }
        const targetElement = document.getElementById('diff-output');
        targetElement.replaceChildren();
        const diff2htmlUi = new Diff2HtmlUI(targetElement, session.result, {
            drawFileList: false,
            matching: 'lines',
            outputFormat: diffStyle,
            synchronizedScroll: true,
            highlight: true,
            renderNothingWhenEmpty: false
        });
        diff2htmlUi.draw();
        const nodeCount = targetElement.querySelectorAll('*').length;
        if (nodeCount > 8000) {
            drawTruncatedPatch(lastPatch);
        }
    }

    function renderSession(redraw) {
        const banner = document.getElementById('diff-result-status');
        banner.className = 'result-status';
        const copyBtn = document.getElementById('copy-patch-btn');
        copyBtn.textContent = session.status !== 'valid' && session.result ? '复制上次有效补丁' : '复制补丁';
        copyBtn.disabled = !session.result;
        if (session.status === 'stale') {
            banner.hidden = false;
            banner.classList.add('is-stale');
            banner.textContent = '结果已过期';
        } else if (session.status === 'failed') {
            banner.hidden = false;
            banner.classList.add('is-failed');
            banner.textContent = session.error ? ('对比失败：' + session.error) : '对比失败';
        } else {
            banner.hidden = true;
            banner.textContent = '';
        }

        if (session.status === 'empty' || session.result == null) {
            renderEmptyDiff();
            return;
        }
        if (redraw) {
            drawCurrentDiff();
        }
    }

    function disposeWorker(reason) {
        taskController.dispose(null, reason || 'cancelled');
        taskController.dispose(worker, reason || 'cancelled');
        worker = null;
        workerBusy = false;
        workerLoadedJsdiff = false;
    }

    function setBusy(busy) {
        compareInFlight = busy;
        const button = document.getElementById('compare-btn');
        button.textContent = busy ? '取消对比' : '开始对比';
        button.setAttribute('aria-busy', String(busy));
    }

    function abandonCompare() {
        latestRequestId = EditorRuntimeCore.nextRequestId(latestRequestId);
        if (compareTimer) clearTimeout(compareTimer);
        compareTimer = null;
        disposeWorker();
        setBusy(false);
    }

    function toggleCompare() {
        if (compareInFlight) {
            abandonCompare();
            setHint('已取消本次对比；输入与上次结果仍保留', 'stale');
            return;
        }
        compareCode();
    }

    function ensureWorker() {
        if (worker) return worker;
        try {
            worker = new Worker(WORKER_URL);
            return worker;
        } catch (error) {
            return null;
        }
    }

    function postToWorker(target, message) {
        return taskController.wait(target, message).catch(function (error) {
            disposeWorker(error.reason);
            throw error;
        });
    }

    async function ensureDiffAssets() {
        const resources = CodeDiffCore.assetResources();
        await loader.loadStyle(resources.diff2htmlCss);
        await loader.loadSequential([resources.jsdiff, resources.diff2htmlJs]);
    }

    async function createPatchString(oldText, newText, requestId) {
        const chars = EditorRuntimeCore.combinedChars(oldText, newText);
        const assets = CodeDiffCore.assetUrls();
        if (EditorRuntimeCore.shouldUseWorker(chars)) {
            if (workerBusy || taskController.pendingCount()) disposeWorker();
            const target = ensureWorker();
            if (!target) throw EditorTaskCore.taskError('unavailable');
            workerBusy = true;
            try {
                if (!workerLoadedJsdiff) {
                    await postToWorker(target, { type: 'load', requestId: requestId, urls: [assets.jsdiff] });
                    workerLoadedJsdiff = true;
                }
                if (!EditorRuntimeCore.isCurrentRequest(latestRequestId, requestId)) return null;
                const result = await postToWorker(target, { type: 'diff', requestId: requestId, oldText: oldText, newText: newText });
                return result.diff;
            } finally { workerBusy = false; }
        }
        await taskController.waitPromise(ensureDiffAssets());
        return Diff.createPatch('file', oldText, newText, 'Old', 'New');
    }

    function scheduleCompare() {
        const chars = EditorRuntimeCore.combinedChars(session.oldText, session.newText);
        if (!EditorRuntimeCore.shouldAutoCompute(chars)) {
            return;
        }
        const generation = session.generation;
        if (compareTimer) clearTimeout(compareTimer);
        compareTimer = setTimeout(function () {
            compareTimer = null;
            compareCode(true, generation);
        }, 500);
    }

    function onEditorInput() {
        applyInputs();
        scheduleCompare();
    }

    async function pasteText(target) {
        try {
            const text = await navigator.clipboard.readText();
            applyInputs(target === 'old' ? { oldText: text } : { newText: text });
            showStatus('已从剪贴板粘贴', 'success');
            const chars = EditorRuntimeCore.combinedChars(session.oldText, session.newText);
            if (EditorRuntimeCore.shouldAutoCompute(chars)) {
                compareCode(true, session.generation);
            }
        } catch (err) {
            showStatus('无法访问剪贴板，请手动粘贴', 'error');
        }
    }

    function clearText(target) {
        applyInputs(target === 'old' ? { oldText: '' } : { newText: '' });
        scheduleCompare();
    }

    function clearAll() {
        applyInputs({ oldText: '', newText: '' });
        showStatus('已清空所有内容', 'info');
    }

    function setDiffStyle(style) {
        diffStyle = style;
        document.getElementById('side-by-side-btn').classList.toggle('active', style === 'side-by-side');
        document.getElementById('line-by-line-btn').classList.toggle('active', style === 'line-by-line');
        document.getElementById('side-by-side-btn').setAttribute('aria-pressed', String(style === 'side-by-side'));
        document.getElementById('line-by-line-btn').setAttribute('aria-pressed', String(style === 'line-by-line'));
        if (session.status !== 'empty' && session.result != null) renderSession(true);
    }

    async function compareCode(silent, expectedGeneration) {
        if (expectedGeneration == null) {
            applyInputs();
        }
        if (expectedGeneration != null && expectedGeneration !== session.generation) {
            return;
        }
        if (!session.oldText && !session.newText) {
            renderSession(true);
            if (!silent) showStatus('请输入要对比的内容', 'error');
            return;
        }

        const budget = EditorTaskCore.checkBudget([session.oldText, session.newText], true);
        if (!budget.ok) { setHint(budget.message, 'failed'); if (!silent) showStatus(budget.message, 'error'); return; }
        if (compareInFlight) abandonCompare();
        if (compareTimer) clearTimeout(compareTimer);
        compareTimer = null;
        const requestId = EditorRuntimeCore.nextRequestId(latestRequestId);
        latestRequestId = requestId;
        session.requestId = requestId;
        const request = CodeDiffCore.beginCompare(session);
        setBusy(true);
        try {
            const diffString = await createPatchString(request.oldText, request.newText, requestId);
            if (!EditorRuntimeCore.isCurrentRequest(latestRequestId, requestId)) return;
            session = CodeDiffCore.finishCompare(session, request.generation, { diff: diffString, requestId: requestId });
            lastPatch = session.result || '';
            if (session.status === 'valid') resultSnapshot = Object.freeze({ patch: lastPatch, oldText: request.oldText, newText: request.newText, generation: request.generation, requestId: requestId });
            if (session.status === 'valid' && EditorRuntimeCore.shouldUseWorker(budget.chars)) {
                try { await taskController.waitPromise(ensureDiffAssets()); } catch (error) { if (EditorRuntimeCore.isCurrentRequest(latestRequestId, requestId)) setHint('美化依赖加载失败，仍可查看和复制完整纯文本补丁', 'stale'); }
            }
            if (!EditorRuntimeCore.isCurrentRequest(latestRequestId, requestId)) return;
            renderSession(true);
            if (!silent && session.status === 'valid') showStatus('对比完成', 'success');
        } catch (error) {
            if (!EditorRuntimeCore.isCurrentRequest(latestRequestId, requestId)) return;
            const depFailed = /加载失败/.test(String(error && error.message));
            session = CodeDiffCore.finishCompare(session, request.generation, {
                error: depFailed ? EditorRuntimeCore.dependencyFailedMessage() : error.message,
                requestId: requestId
            });
            renderSession(true);
            if (!silent) showStatus((depFailed ? EditorRuntimeCore.dependencyFailedMessage() : ('对比失败: ' + error.message)), 'error');
        } finally {
            if (EditorRuntimeCore.isCurrentRequest(latestRequestId, requestId)) setBusy(false);
        }
    }

    function copyPatch() {
        if (!lastPatch) {
            showStatus('没有可复制的对比结果', 'error');
            return;
        }
        const snapshot = resultSnapshot;
        const stale = session.status !== 'valid' || !snapshot || snapshot.oldText !== document.getElementById('old-code').value || snapshot.newText !== document.getElementById('new-code').value;
        ToolsClipboard.copyText(lastPatch, { element: document.getElementById('diff-output') }).then(function (result) {
            const nowStale = stale || !snapshot || snapshot.oldText !== document.getElementById('old-code').value || snapshot.newText !== document.getElementById('new-code').value;
            showStatus(result.ok ? (nowStale ? '已复制上次有效补丁；当前输入尚未完成对比' : '完整补丁已复制') : result.message, result.ok ? 'success' : 'error');
        });
    }

    document.getElementById('old-code').addEventListener('input', onEditorInput);
    document.getElementById('new-code').addEventListener('input', onEditorInput);
    window.addEventListener('pagehide', abandonCompare);
    renderSession(true);

    window.toggleCompare = toggleCompare;
    window.compareCode = compareCode;
    window.pasteText = pasteText;
    window.clearText = clearText;
    window.clearAll = clearAll;
    window.setDiffStyle = setDiffStyle;
    window.copyPatch = copyPatch;
})();
