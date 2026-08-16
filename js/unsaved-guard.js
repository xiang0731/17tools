(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.UnsavedGuard = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const MESSAGE = {
        CHECK: '17tools-unsaved-check',
        STATE: '17tools-unsaved-state',
        ALLOW: '17tools-unsaved-allow',
        ALLOWED: '17tools-unsaved-allowed'
    };

    const EXCLUDED_PAGES = ['Calendar.html', 'Regex.html'];

    function isExcludedPage(src) {
        const value = String(src || '');
        if (!value) {
            return false;
        }
        for (let i = 0; i < EXCLUDED_PAGES.length; i += 1) {
            const name = EXCLUDED_PAGES[i];
            if (value === name || value.endsWith('/' + name) || value.endsWith(name)) {
                return true;
            }
        }
        return false;
    }

    function iframeSource(iframe) {
        if (!iframe) {
            return '';
        }
        if (typeof iframe.getAttribute === 'function') {
            return iframe.getAttribute('src') || iframe.src || '';
        }
        return iframe.src || '';
    }

    const SKIP_INPUT_TYPES = {
        hidden: true,
        button: true,
        submit: true,
        reset: true,
        image: true,
        checkbox: true,
        radio: true,
        color: true,
        range: true,
        file: true
    };

    function isTrackedElement(el) {
        if (!el || el.disabled || el.readOnly) {
            return false;
        }
        if (typeof el.closest === 'function' && el.closest('[data-unsaved-ignore]')) {
            return false;
        }

        const tag = String(el.tagName || '').toUpperCase();
        if (tag === 'TEXTAREA') {
            return true;
        }
        if (tag === 'SELECT') {
            return false;
        }
        if (el.isContentEditable) {
            return true;
        }
        if (tag !== 'INPUT') {
            return false;
        }

        const type = String(el.type || 'text').toLowerCase();
        return !SKIP_INPUT_TYPES[type];
    }

    function fieldValue(el) {
        if (el && el.isContentEditable) {
            return String(el.innerText == null ? '' : el.innerText);
        }
        return String(el && el.value == null ? '' : el.value);
    }

    function fieldKey(el, index) {
        return el.id || el.name || `${String(el.tagName || 'FIELD').toUpperCase()}:${index}`;
    }

    function snapshot(doc) {
        const fields = {};
        if (!doc || typeof doc.querySelectorAll !== 'function') {
            return fields;
        }
        const nodes = doc.querySelectorAll('input, textarea, select, [contenteditable="true"]');
        for (let i = 0; i < nodes.length; i += 1) {
            const el = nodes[i];
            if (!isTrackedElement(el)) {
                continue;
            }
            fields[fieldKey(el, i)] = fieldValue(el);
        }
        return fields;
    }

    function snapshotsEqual(left, right) {
        const keys = Object.keys(left).concat(Object.keys(right));
        const seen = {};
        for (let i = 0; i < keys.length; i += 1) {
            const key = keys[i];
            if (seen[key]) {
                continue;
            }
            seen[key] = true;
            if ((left[key] || '') !== (right[key] || '')) {
                return false;
            }
        }
        return true;
    }

    function applyBeforeUnload(event, isDirty) {
        if (!isDirty || !event) {
            return false;
        }
        if (typeof event.preventDefault === 'function') {
            event.preventDefault();
        }
        event.returnValue = '';
        return true;
    }

    function isSameToolPage(currentSrc, fileName) {
        const src = String(currentSrc || '');
        const name = String(fileName || '');
        if (!src || !name) {
            return false;
        }
        return src === name || src.endsWith('/' + name) || src.endsWith(name);
    }

    function createGuard() {
        let baseline = {};
        let extraDirty = false;
        let skipUnload = false;

        return {
            captureBaseline(doc) {
                baseline = snapshot(doc);
                extraDirty = false;
            },
            markExtraDirty() {
                extraDirty = true;
            },
            markClean(doc) {
                baseline = snapshot(doc);
                extraDirty = false;
            },
            isDirty(doc) {
                return extraDirty || !snapshotsEqual(baseline, snapshot(doc));
            },
            allowUnload() {
                skipUnload = true;
            },
            consumeUnloadAllowance() {
                if (!skipUnload) {
                    return false;
                }
                skipUnload = false;
                return true;
            }
        };
    }

    function shouldWarnOnUnload(guard, doc) {
        if (!guard) {
            return false;
        }
        if (guard.consumeUnloadAllowance()) {
            return false;
        }
        return !!guard.isDirty(doc);
    }

    function bindDocument(guard, doc) {
        if (!guard || !doc || typeof doc.addEventListener !== 'function') {
            return;
        }
        const markExtra = (event) => {
            const target = event && event.target;
            if (!target) {
                return;
            }
            const tag = String(target.tagName || '').toUpperCase();
            const type = String(target.type || '').toLowerCase();
            if (tag === 'CANVAS' || (tag === 'INPUT' && type === 'file')) {
                guard.markExtraDirty();
            }
        };
        doc.addEventListener('change', markExtra, true);
        doc.addEventListener('pointerdown', markExtra, true);
    }

    function postDirtyState(win, guard) {
        if (!win || !win.parent || win.parent === win) {
            return;
        }
        const dirty = !!(guard && guard.isDirty(win.document));
        try {
            win.parent.postMessage({ type: MESSAGE.STATE, dirty: dirty }, '*');
        } catch (e) { /* ignore */ }
    }

    function bindMessaging(win, guard) {
        if (!win || typeof win.addEventListener !== 'function') {
            return;
        }
        win.addEventListener('message', (event) => {
            if (!event || !event.data) {
                return;
            }
            if (event.data.type === MESSAGE.CHECK) {
                postDirtyState(win, guard);
                return;
            }
            if (event.data.type === MESSAGE.ALLOW) {
                guard.allowUnload();
                if (win.parent && win.parent !== win) {
                    try {
                        win.parent.postMessage({ type: MESSAGE.ALLOWED }, '*');
                    } catch (e) { /* ignore */ }
                }
            }
        });
        win.addEventListener('beforeunload', (event) => {
            applyBeforeUnload(event, shouldWarnOnUnload(guard, win.document));
        });
    }

    function requestDirty(iframe, callback, host) {
        const done = typeof callback === 'function' ? callback : function () {};
        const target = host || (typeof window !== 'undefined' ? window : null);

        if (isExcludedPage(iframeSource(iframe))) {
            done(false);
            return;
        }

        try {
            const frameWindow = iframe && iframe.contentWindow;
            const guard = frameWindow && frameWindow.__17toolsUnsaved;
            if (guard) {
                done(!!guard.isDirty(frameWindow.document));
                return;
            }
        } catch (e) { /* file:// or cross-origin: fall through to postMessage */ }

        if (!iframe || !iframe.contentWindow || !target || typeof target.addEventListener !== 'function') {
            done(false);
            return;
        }

        let settled = false;
        const finish = (dirty) => {
            if (settled) {
                return;
            }
            settled = true;
            target.removeEventListener('message', onMessage);
            done(!!dirty);
        };
        const onMessage = (event) => {
            if (event && event.data && event.data.type === MESSAGE.STATE) {
                finish(event.data.dirty);
            }
        };

        target.addEventListener('message', onMessage);
        try {
            iframe.contentWindow.postMessage({ type: MESSAGE.CHECK }, '*');
        } catch (e) {
            finish(false);
            return;
        }
        setTimeout(() => finish(false), 300);
    }

    function allowUnload(iframe, callback, host) {
        const done = typeof callback === 'function' ? callback : function () {};
        const target = host || (typeof window !== 'undefined' ? window : null);

        try {
            const guard = iframe && iframe.contentWindow && iframe.contentWindow.__17toolsUnsaved;
            if (guard && typeof guard.allowUnload === 'function') {
                guard.allowUnload();
                done();
                return;
            }
        } catch (e) { /* file:// or cross-origin */ }

        if (!iframe || !iframe.contentWindow) {
            done();
            return;
        }

        let settled = false;
        const finish = () => {
            if (settled) {
                return;
            }
            settled = true;
            if (target && typeof target.removeEventListener === 'function') {
                target.removeEventListener('message', onMessage);
            }
            done();
        };
        const onMessage = (event) => {
            if (event && event.data && event.data.type === MESSAGE.ALLOWED) {
                finish();
            }
        };
        if (target && typeof target.addEventListener === 'function') {
            target.addEventListener('message', onMessage);
        }
        try {
            iframe.contentWindow.postMessage({ type: MESSAGE.ALLOW }, '*');
        } catch (e) {
            finish();
            return;
        }
        setTimeout(finish, 80);
    }

    function install(win) {
        if (!win || !win.document) {
            return null;
        }
        try {
            if (isExcludedPage(win.location && win.location.pathname)) {
                return null;
            }
        } catch (e) { /* ignore */ }
        if (win.document.documentElement && win.document.documentElement.getAttribute('data-unsaved-guard') === 'off') {
            return null;
        }
        if (win.__17toolsUnsaved) {
            return win.__17toolsUnsaved;
        }
        const guard = createGuard();
        guard.captureBaseline(win.document);
        if (win.__17toolsEarlyInput) {
            guard.markExtraDirty();
        }
        bindDocument(guard, win.document);
        bindMessaging(win, guard);
        win.__17toolsUnsaved = guard;

        if (typeof win.setTimeout === 'function') {
            win.setTimeout(() => {
                if (!guard.isDirty(win.document)) {
                    guard.captureBaseline(win.document);
                }
            }, 100);
        }
        return guard;
    }

    function shouldAutoInstall(win) {
        if (!win || !win.document) {
            return false;
        }
        if (win.document.getElementById('content-frame')) {
            return false;
        }
        if (win.document.documentElement && win.document.documentElement.getAttribute('data-unsaved-guard') === 'off') {
            return false;
        }
        try {
            const path = String((win.location && win.location.pathname) || '');
            if (isExcludedPage(path)) {
                return false;
            }
            return win.parent !== win || path.indexOf('/items/') !== -1;
        } catch (e) {
            return win.parent !== win;
        }
    }

    function autoInstall(win) {
        if (!shouldAutoInstall(win)) {
            return null;
        }
        const start = () => install(win);
        if (win.document.readyState === 'loading' && win.document.addEventListener) {
            win.document.addEventListener('DOMContentLoaded', start);
            return null;
        }
        return start();
    }

    if (typeof window !== 'undefined') {
        autoInstall(window);
    }

    return {
        MESSAGE,
        EXCLUDED_PAGES,
        isExcludedPage,
        SKIP_INPUT_TYPES,
        isTrackedElement,
        fieldValue,
        snapshot,
        applyBeforeUnload,
        shouldWarnOnUnload,
        isSameToolPage,
        createGuard,
        bindDocument,
        requestDirty,
        allowUnload,
        install,
        autoInstall
    };
});
