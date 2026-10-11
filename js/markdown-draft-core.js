(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.MarkdownDraftCore = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const PREF_KEY = '17tools-markdown';
    const CONTENT_KEY = '17tools-md-content';
    const MAX_BYTES = 262144;

    const STATUS = {
        SESSION: 'session',
        UNAVAILABLE: 'unavailable',
        SAVED: 'saved',
        FAILED: 'failed'
    };

    const MESSAGES = {
        session: '草稿仅在本次会话',
        unavailable: '本机存储不可用，草稿仅在本次会话',
        saved: '已保存到浏览器',
        failed: '保存失败，正文仍在编辑器中',
        tooLarge: '正文超过 256KB，未写入本机，仍在编辑器中',
        legacyBanner: '本机仍留有上次草稿',
        corruptBanner: '本机草稿无法读取，正文未丢在编辑器中'
    };

    function utf8Bytes(value) {
        const text = String(value == null ? '' : value);
        if (typeof TextEncoder === 'function') {
            return new TextEncoder().encode(text).length;
        }
        if (typeof Buffer !== 'undefined') {
            return Buffer.byteLength(text, 'utf8');
        }
        let bytes = 0;
        for (let i = 0; i < text.length; i += 1) {
            const code = text.charCodeAt(i);
            if (code < 0x80) bytes += 1;
            else if (code < 0x800) bytes += 2;
            else if (code >= 0xd800 && code <= 0xdfff) {
                bytes += 4;
                i += 1;
            } else bytes += 3;
        }
        return bytes;
    }

    function parsePreference(raw) {
        if (raw == null || raw === '') {
            return { persistDraft: null };
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && typeof parsed.persistDraft === 'boolean') {
                return { persistDraft: parsed.persistDraft };
            }
        } catch (error) {
            return { persistDraft: null, corrupt: true };
        }
        if (raw === 'true') {
            return { persistDraft: true };
        }
        if (raw === 'false') {
            return { persistDraft: false };
        }
        return { persistDraft: null };
    }

    function serializePreference(persistDraft) {
        return JSON.stringify({ persistDraft: persistDraft === true });
    }

    function decideRestore(input) {
        const pref = parsePreference(input && input.prefRaw);
        const contentRaw = input && input.contentRaw;
        const contentReadable = typeof contentRaw === 'string';
        const hasContent = contentReadable && contentRaw.length > 0;
        const persistDraft = pref.persistDraft === true || (pref.persistDraft == null && hasContent);
        const pendingRestore = pref.persistDraft === false && hasContent;

        return {
            persistDraft: persistDraft,
            autoRestore: persistDraft && hasContent,
            pendingRestore: pendingRestore,
            content: hasContent ? contentRaw : '',
            hasLegacyContent: hasContent,
            prefCorrupt: !!pref.corrupt,
            banner: pendingRestore ? MESSAGES.legacyBanner : ''
        };
    }

    function statusMessage(status, reason) {
        if (status === STATUS.SAVED) {
            return MESSAGES.saved;
        }
        if (status === STATUS.FAILED) {
            if (reason === 'too-large') {
                return MESSAGES.tooLarge;
            }
            return MESSAGES.failed;
        }
        if (status === STATUS.UNAVAILABLE) {
            return MESSAGES.unavailable;
        }
        return MESSAGES.session;
    }

    function persistContent(storage, persistEnabled, content) {
        if (!persistEnabled) {
            return { status: STATUS.SESSION, persisted: false, verified: false };
        }
        if (!storage || typeof storage.setItem !== 'function') {
            return { status: STATUS.UNAVAILABLE, persisted: false, verified: false };
        }
        const text = String(content == null ? '' : content);
        if (utf8Bytes(text) > MAX_BYTES) {
            return { status: STATUS.FAILED, persisted: false, verified: false, reason: 'too-large' };
        }
        const result = storage.setItem(CONTENT_KEY, text);
        if (result && result.persisted && result.verified) {
            return { status: STATUS.SAVED, persisted: true, verified: true };
        }
        if (result && (result.reason === 'unavailable' || result.reason === 'security')) {
            return { status: STATUS.UNAVAILABLE, persisted: false, verified: false, reason: result.reason };
        }
        return {
            status: STATUS.FAILED,
            persisted: false,
            verified: false,
            reason: result ? result.reason : 'unknown'
        };
    }

    function persistPreference(storage, persistDraft) {
        if (!storage || typeof storage.setItem !== 'function') {
            return { persisted: false };
        }
        return storage.setItem(PREF_KEY, serializePreference(persistDraft));
    }

    function loadFromStorage(storage) {
        if (!storage || typeof storage.getItem !== 'function') {
            return decideRestore({ prefRaw: null, contentRaw: null });
        }
        return decideRestore({
            prefRaw: storage.getItem(PREF_KEY),
            contentRaw: storage.getItem(CONTENT_KEY)
        });
    }

    function deleteContent(storage) {
        if (!storage || typeof storage.removeItem !== 'function' || typeof storage.getItem !== 'function') {
            return { ok: false, message: '无法删除本机草稿，当前正文仍在编辑器中' };
        }
        try {
            const result = storage.removeItem(CONTENT_KEY);
            const remaining = storage.getItem(CONTENT_KEY);
            const canRead = typeof storage.canRead !== 'function' || storage.canRead();
            if (result && result.persisted && canRead && remaining == null) {
                return { ok: true, message: '已删除本机旧草稿，当前正文仍在编辑器中' };
            }
        } catch (error) { /* retain explicit failure */ }
        return { ok: false, message: '本机草稿删除失败或无法验证；当前正文仍在编辑器中' };
    }

    return {
        PREF_KEY: PREF_KEY,
        CONTENT_KEY: CONTENT_KEY,
        MAX_BYTES: MAX_BYTES,
        STATUS: STATUS,
        MESSAGES: MESSAGES,
        utf8Bytes: utf8Bytes,
        parsePreference: parsePreference,
        serializePreference: serializePreference,
        decideRestore: decideRestore,
        statusMessage: statusMessage,
        persistContent: persistContent,
        persistPreference: persistPreference,
        loadFromStorage: loadFromStorage,
        deleteContent: deleteContent
    };
});
