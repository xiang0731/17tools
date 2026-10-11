(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.ToolsClipboard = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function environment(options) {
        return options && options.env || (typeof globalThis !== 'undefined' ? globalThis : {});
    }

    function manual(element) {
        if (element && typeof element.select === 'function') {
            if (typeof element.focus === 'function') element.focus();
            element.select();
        }
        return { ok: false, method: 'manual', message: element && typeof element.select === 'function'
            ? '复制未成功，已选择结果，请手动复制' : '复制未成功，请选中结果手动复制' };
    }

    async function copyText(text, options) {
        var opts = options || {};
        var env = environment(opts);
        var value = String(text == null ? '' : text);
        var doc = env.document;
        try {
            if (env.navigator && env.navigator.clipboard && typeof env.navigator.clipboard.writeText === 'function') {
                await env.navigator.clipboard.writeText(value);
                return { ok: true, method: 'clipboard', message: '已复制' };
            }
        } catch (error) { /* Try the compatibility path after permission rejection. */ }
        if (!doc || typeof doc.execCommand !== 'function') return manual(opts.element);
        var active = doc.activeElement;
        var selection = typeof doc.getSelection === 'function' ? doc.getSelection() : null;
        var ranges = [];
        if (selection) {
            for (var i = 0; i < selection.rangeCount; i++) ranges.push(selection.getRangeAt(i).cloneRange());
        }
        var controlRange = active && typeof active.selectionStart === 'number'
            ? [active.selectionStart, active.selectionEnd, active.selectionDirection] : null;
        var area = doc.createElement('textarea');
        area.value = value;
        area.setAttribute('aria-label', '复制结果');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        area.style.pointerEvents = 'none';
        doc.body.appendChild(area);
        var ok = false;
        try {
            area.focus();
            area.select();
            ok = doc.execCommand('copy') === true;
        } catch (error) { ok = false; }
        finally {
            area.remove();
            if (active && typeof active.focus === 'function') active.focus();
            if (controlRange && typeof active.setSelectionRange === 'function') {
                active.setSelectionRange(controlRange[0], controlRange[1], controlRange[2]);
            } else if (selection) {
                selection.removeAllRanges();
                ranges.forEach(function (range) { selection.addRange(range); });
            }
        }
        return ok ? { ok: true, method: 'legacy', message: '已复制（兼容模式）' } : manual(opts.element);
    }

    async function copyHtml(html, plainText, options) {
        var env = environment(options);
        try {
            var Item = env.ClipboardItem;
            var api = env.navigator && env.navigator.clipboard;
            if (typeof Item === 'function' && typeof env.Blob === 'function' && api && typeof api.write === 'function' &&
                (typeof Item.supports !== 'function' || Item.supports('text/html'))) {
                var data = {
                    'text/html': new env.Blob([String(html)], { type: 'text/html' }),
                    'text/plain': new env.Blob([String(plainText)], { type: 'text/plain' })
                };
                await api.write([new Item(data)]);
                return { ok: true, method: 'clipboard', message: '已复制富文本' };
            }
        } catch (error) { /* Rich text is optional; keep a usable text fallback. */ }
        var result = await copyText(plainText, options);
        if (result.ok) return { ok: true, method: 'plain-text', message: '当前环境改为复制纯文本' };
        return result;
    }

    return { copyText: copyText, copyHtml: copyHtml };
}));
