(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.EditorTaskCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    const TIMEOUT_MS = 15000;
    const MAX_INPUT_CHARS = 2 * 1024 * 1024;
    const MAX_DIFF_LINES = 20000;

    function taskError(reason) {
        const messages = {
            cancelled: '已取消本次计算',
            timeout: '后台计算超过 15 秒，已停止；输入仍保留，请缩小内容后重试',
            unavailable: '此内容需要后台计算；当前环境无法使用 Worker，请缩小到 32KB 以下或换用支持后台计算的浏览器'
        };
        return Object.assign(new Error(messages[reason] || '后台计算失败，输入仍保留'), { reason: reason });
    }

    function checkBudget(texts, diff) {
        const values = Array.isArray(texts) ? texts : [texts];
        let chars = 0;
        let lines = 0;
        values.forEach(function (value) {
            const text = String(value == null ? '' : value);
            chars += text.length;
            lines += 1;
            if (diff) for (let i = 0; i < text.length; i += 1) if (text.charCodeAt(i) === 10) lines += 1;
        });
        if (chars > MAX_INPUT_CHARS) return { ok: false, message: '手动处理上限为合计 2MB 字符，请拆成较小内容；输入仍保留' };
        if (diff && lines > MAX_DIFF_LINES) return { ok: false, message: '对比上限为合计 20,000 行，请按文件或章节拆分；输入仍保留' };
        return { ok: true, chars: chars, lines: lines };
    }

    function createController(options) {
        const opts = options || {};
        const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : TIMEOUT_MS;
        const pending = new Set();
        function dispose(target, reason) {
            Array.from(pending).forEach(function (entry) {
                if (!target || entry.target === target) entry.cancel(taskError(reason || 'cancelled'));
            });
            if (target) try { target.terminate(); } catch (error) { /* already stopped */ }
        }
        function wait(target, message) {
            return new Promise(function (resolve, reject) {
                let settled = false;
                let timer;
                const expected = message.type === 'load' || message.type === 'ping' ? 'ready' : 'result';
                const entry = { target: target, cancel: function (error) { finish(error); } };
                function finish(error, result) {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    pending.delete(entry);
                    target.removeEventListener('message', onMessage);
                    target.removeEventListener('error', onError);
                    if (error) reject(error); else resolve(result);
                }
                function onMessage(event) {
                    const data = event && event.data || {};
                    if (data.requestId !== message.requestId) return;
                    if (data.type === 'error') finish(new Error(String(data.error || 'Worker 失败')));
                    else if (data.type === expected) finish(null, data);
                }
                function onError() { finish(new Error('Worker 异常，输入仍保留')); }
                pending.add(entry);
                target.addEventListener('message', onMessage);
                target.addEventListener('error', onError);
                timer = setTimeout(function () { dispose(target, 'timeout'); }, timeoutMs);
                try { target.postMessage(message); } catch (error) { finish(error); }
            });
        }
        function waitPromise(promise) {
            return new Promise(function (resolve, reject) {
                let settled = false;
                let timer;
                const entry = { target: null, cancel: function (error) { finish(error); } };
                function finish(error, value) {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    pending.delete(entry);
                    if (error) reject(error); else resolve(value);
                }
                pending.add(entry);
                timer = setTimeout(function () { finish(taskError('timeout')); }, timeoutMs);
                Promise.resolve(promise).then(function (value) { finish(null, value); }, function (error) { finish(error); });
            });
        }
        return { wait: wait, waitPromise: waitPromise, dispose: dispose, pendingCount: function () { return pending.size; } };
    }
    return { TIMEOUT_MS: TIMEOUT_MS, MAX_INPUT_CHARS: MAX_INPUT_CHARS, MAX_DIFF_LINES: MAX_DIFF_LINES, checkBudget: checkBudget, taskError: taskError, createController: createController };
}));
