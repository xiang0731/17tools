(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ToolRoute = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const QUERY_KEY = 'tool';
    const STORAGE_KEY = '17tools-last-tool';
    const DEFAULT_FILE = 'Welcome.html';
    const MESSAGE_TYPE = '17tools-navigate';
    const FILE_RE = /^[A-Za-z][A-Za-z0-9_-]*\.html$/;
    const STEM_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

    function collectAllowlist(files) {
        const list = [];
        const seen = Object.create(null);
        const source = Array.isArray(files) ? files : [];
        for (let i = 0; i < source.length; i += 1) {
            const name = normalizeFileName(source[i]);
            if (!name || seen[name]) {
                continue;
            }
            seen[name] = true;
            list.push(name);
        }
        return list;
    }

    function asSet(files) {
        const set = Object.create(null);
        const list = collectAllowlist(files);
        for (let i = 0; i < list.length; i += 1) {
            set[list[i]] = true;
        }
        return set;
    }

    function decodeRaw(raw) {
        const text = String(raw == null ? '' : raw).trim();
        if (!text) {
            return '';
        }
        try {
            return decodeURIComponent(text.replace(/\+/g, '%20')).trim();
        } catch (e) {
            return text;
        }
    }

    function normalizeFileName(raw) {
        let text = decodeRaw(raw);
        if (!text) {
            return '';
        }
        if (/[\u0000-\u001F\u007F]/.test(text)) {
            return '';
        }
        if (text.indexOf('\\') !== -1 || text.indexOf('/') !== -1 || text.indexOf('..') !== -1) {
            return '';
        }
        text = text.split('?')[0].split('#')[0];
        if (!text) {
            return '';
        }
        if (FILE_RE.test(text)) {
            return text;
        }
        if (STEM_RE.test(text)) {
            const withHtml = text + '.html';
            return FILE_RE.test(withHtml) ? withHtml : '';
        }
        return '';
    }

    function isAllowed(file, allowlist) {
        const name = normalizeFileName(file);
        if (!name) {
            return false;
        }
        return !!asSet(allowlist)[name];
    }

    function parseToolParam(search, hash) {
        const query = String(search || '');
        const qs = query.charAt(0) === '?' ? query.slice(1) : query;
        const params = new URLSearchParams(qs);
        if (params.has(QUERY_KEY)) {
            return { source: 'query', raw: params.get(QUERY_KEY) };
        }
        const h = String(hash || '');
        const hashValue = h.charAt(0) === '#' ? h.slice(1) : h;
        if (hashValue) {
            return { source: 'hash', raw: hashValue };
        }
        return { source: null, raw: null };
    }

    function resolveFile(raw, allowlist) {
        const name = normalizeFileName(raw);
        if (name && isAllowed(name, allowlist)) {
            return name;
        }
        return DEFAULT_FILE;
    }

    function resolveEntry(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const allowlist = opts.allowlist || [];
        const parsed = parseToolParam(opts.search, opts.hash);
        if (parsed.source) {
            return resolveFile(parsed.raw, allowlist);
        }
        const last = normalizeFileName(opts.lastTool);
        if (last && isAllowed(last, allowlist)) {
            return last;
        }
        return DEFAULT_FILE;
    }

    function needsAuth(file, protectedFiles, authenticated) {
        if (authenticated) {
            return false;
        }
        const name = normalizeFileName(file);
        if (!name) {
            return false;
        }
        return !!asSet(protectedFiles)[name];
    }

    function buildSearch(file) {
        const name = normalizeFileName(file) || DEFAULT_FILE;
        return '?' + QUERY_KEY + '=' + encodeURIComponent(name);
    }

    function buildHref(loc, file) {
        const href = loc && loc.href ? String(loc.href) : '';
        try {
            const url = new URL(href);
            const name = normalizeFileName(file) || DEFAULT_FILE;
            url.searchParams.set(QUERY_KEY, name);
            url.hash = '';
            return url.pathname + url.search;
        } catch (e) {
            return buildSearch(file);
        }
    }

    function readLastTool(storage) {
        if (!storage || typeof storage.getItem !== 'function') {
            return '';
        }
        try {
            return String(storage.getItem(STORAGE_KEY) || '');
        } catch (e) {
            return '';
        }
    }

    function writeLastTool(storage, file, allowlist) {
        const name = normalizeFileName(file);
        if (!name || !isAllowed(name, allowlist)) {
            return false;
        }
        if (!storage || typeof storage.setItem !== 'function') {
            return false;
        }
        try {
            storage.setItem(STORAGE_KEY, name);
            return true;
        } catch (e) {
            return false;
        }
    }

    function isFileNullOrigin(origin) {
        return origin === 'null' || origin === 'file://';
    }

    function readLocationOrigin(win) {
        try {
            return win && win.location ? String(win.location.origin || '') : '';
        } catch (e) {
            return '';
        }
    }

    function postMessageTargetOrigin(targetWin) {
        const origin = readLocationOrigin(targetWin);
        if (!origin || isFileNullOrigin(origin)) {
            return '*';
        }
        return origin;
    }

    function isTrustedFrameMessage(event, iframe) {
        if (!event || !iframe || !iframe.contentWindow || event.source !== iframe.contentWindow) {
            return false;
        }
        const origin = event.origin == null ? '' : String(event.origin);
        const expected = readLocationOrigin(iframe.contentWindow);
        if (isFileNullOrigin(origin)) {
            return !expected || isFileNullOrigin(expected);
        }
        return Boolean(origin && expected && origin === expected);
    }

    function createNavigateMessage(file) {
        return {
            type: MESSAGE_TYPE,
            file: normalizeFileName(file) || ''
        };
    }

    function requestParentNavigate(win, file) {
        if (!win) {
            return false;
        }
        const message = createNavigateMessage(file);
        if (!message.file) {
            return false;
        }
        if (!win.parent || win.parent === win) {
            return false;
        }
        try {
            win.parent.postMessage(message, postMessageTargetOrigin(win.parent));
            return true;
        } catch (e) {
            return false;
        }
    }

    function readNavigateFile(event, iframe, allowlist) {
        if (!isTrustedFrameMessage(event, iframe)) {
            return '';
        }
        const data = event.data;
        if (!data || typeof data !== 'object' || data.type !== MESSAGE_TYPE) {
            return '';
        }
        const name = normalizeFileName(data.file);
        if (!name || !isAllowed(name, allowlist)) {
            return '';
        }
        return name;
    }

    return {
        QUERY_KEY: QUERY_KEY,
        STORAGE_KEY: STORAGE_KEY,
        DEFAULT_FILE: DEFAULT_FILE,
        MESSAGE_TYPE: MESSAGE_TYPE,
        collectAllowlist: collectAllowlist,
        normalizeFileName: normalizeFileName,
        isAllowed: isAllowed,
        parseToolParam: parseToolParam,
        resolveFile: resolveFile,
        resolveEntry: resolveEntry,
        needsAuth: needsAuth,
        buildSearch: buildSearch,
        buildHref: buildHref,
        readLastTool: readLastTool,
        writeLastTool: writeLastTool,
        isFileNullOrigin: isFileNullOrigin,
        postMessageTargetOrigin: postMessageTargetOrigin,
        isTrustedFrameMessage: isTrustedFrameMessage,
        createNavigateMessage: createNavigateMessage,
        requestParentNavigate: requestParentNavigate,
        readNavigateFile: readNavigateFile
    };
});
