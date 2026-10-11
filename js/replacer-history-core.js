(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ReplacerHistoryCore = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const OLD_KEY = 'text_replacer_history_v1';
    const NEW_KEY = '17tools-replacer';
    const PREF_KEY = '17tools-replacer-pref';
    const MAX_ITEMS = 50;
    const MAX_BYTES = 262144;

    const STATUS = {
        SESSION: 'session',
        UNAVAILABLE: 'unavailable',
        SAVED: 'saved',
        FAILED: 'failed',
        QUOTA: 'quota'
    };

    const MESSAGES = {
        session: '历史仅在本次会话',
        unavailable: '本机存储不可用，历史仅在本次会话',
        saved: '已保存到浏览器',
        failed: '保存失败，历史仍在本次会话',
        quota: '本机空间不足，历史仍在本次会话，可导出后重试',
        corrupt: '历史数据无法读取，未删除本机旧数据'
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

    function cloneItems(items) {
        if (!Array.isArray(items)) {
            return [];
        }
        return items.map(function (item) {
            return item && typeof item === 'object' ? Object.assign({}, item) : item;
        });
    }

    function serialize(items) {
        return JSON.stringify(cloneItems(items));
    }

    function parseHistory(raw) {
        if (raw == null || raw === '') {
            return { ok: true, items: [], empty: true };
        }
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return { ok: false, items: [], error: 'not-array', raw: raw };
            }
            return { ok: true, items: parsed, empty: parsed.length === 0 };
        } catch (error) {
            return { ok: false, items: [], error: 'parse', raw: String(raw) };
        }
    }

    function exceedsBudget(items) {
        return items.length > MAX_ITEMS || utf8Bytes(serialize(items)) > MAX_BYTES;
    }

    function applyBudget(items) {
        const kept = cloneItems(items);
        let dropped = 0;
        let rejected = false;
        while (kept.length && exceedsBudget(kept)) {
            if (kept.length === 1) {
                rejected = true;
                dropped += 1;
                kept.pop();
                break;
            }
            kept.pop();
            dropped += 1;
        }
        return {
            items: kept,
            dropped: dropped,
            rejected: rejected,
            bytes: utf8Bytes(serialize(kept))
        };
    }

    function addItem(items, item) {
        const previous = cloneItems(items);
        const next = [item].concat(previous);
        const fitted = applyBudget(next);
        if (fitted.rejected) {
            const restored = applyBudget(previous);
            return {
                items: restored.items,
                dropped: restored.dropped,
                rejected: true,
                keptPrevious: true,
                bytes: restored.bytes
            };
        }
        return fitted;
    }

    function parsePreference(raw) {
        if (raw == null || raw === '') {
            return { persistHistory: null };
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && typeof parsed.persistHistory === 'boolean') {
                return { persistHistory: parsed.persistHistory };
            }
        } catch (error) {
            return { persistHistory: null, corrupt: true };
        }
        return { persistHistory: null };
    }

    function statusMessage(status) {
        if (status === STATUS.SAVED) {
            return MESSAGES.saved;
        }
        if (status === STATUS.QUOTA) {
            return MESSAGES.quota;
        }
        if (status === STATUS.FAILED) {
            return MESSAGES.failed;
        }
        if (status === STATUS.UNAVAILABLE) {
            return MESSAGES.unavailable;
        }
        return MESSAGES.session;
    }

    function persistItems(storage, items, options) {
        const persistEnabled = !options || options.persistEnabled !== false;
        if (!persistEnabled) {
            return { status: STATUS.SESSION, persisted: false, verified: false, oldKeyRemoved: false };
        }
        if (!storage || typeof storage.setItem !== 'function') {
            return { status: STATUS.UNAVAILABLE, persisted: false, verified: false, oldKeyRemoved: false };
        }
        const budget = applyBudget(items);
        if (budget.rejected && budget.items.length === 0) {
            return {
                status: STATUS.QUOTA,
                persisted: false,
                verified: false,
                oldKeyRemoved: false,
                dropped: budget.dropped,
                rejected: true
            };
        }
        const payload = serialize(budget.items);
        const result = storage.setItem(NEW_KEY, payload);
        if (!result || !result.persisted || !result.verified) {
            const quota = result && result.reason === 'quota';
            return {
                status: quota ? STATUS.QUOTA : (result && (result.reason === 'security' || result.reason === 'unavailable')
                    ? STATUS.UNAVAILABLE
                    : STATUS.FAILED),
                persisted: false,
                verified: false,
                oldKeyRemoved: false,
                reason: result ? result.reason : 'unknown',
                items: budget.items
            };
        }
        let oldKeyRemoved = false;
        if (options && options.removeOldKey) {
            const removal = storage.removeItem(OLD_KEY);
            oldKeyRemoved = !!(removal && removal.persisted);
        }
        return {
            status: STATUS.SAVED,
            persisted: true,
            verified: true,
            oldKeyRemoved: oldKeyRemoved,
            items: budget.items
        };
    }

    function migrate(storage) {
        const empty = {
            items: [],
            source: 'none',
            oldKeyRemoved: false,
            error: null,
            canRetry: false,
            persistHistory: true
        };
        if (!storage || typeof storage.getItem !== 'function') {
            return Object.assign({}, empty, { persistHistory: true });
        }
        const pref = parsePreference(storage.getItem(PREF_KEY));
        const persistHistory = pref.persistHistory !== false;
        const newParsed = parseHistory(storage.getItem(NEW_KEY));
        const oldParsed = parseHistory(storage.getItem(OLD_KEY));

        if (newParsed.ok && !newParsed.empty) {
            const verify = persistItems(storage, newParsed.items, {
                persistEnabled: persistHistory,
                removeOldKey: persistHistory && oldParsed.ok
            });
            if (verify.persisted && verify.verified) {
                return {
                    items: newParsed.items,
                    source: 'new',
                    oldKeyRemoved: verify.oldKeyRemoved,
                    error: null,
                    canRetry: false,
                    persistHistory: persistHistory
                };
            }
            if (verify.status === STATUS.SESSION) {
                return {
                    items: newParsed.items,
                    source: 'new-session',
                    oldKeyRemoved: false,
                    error: null,
                    canRetry: false,
                    persistHistory: persistHistory
                };
            }
            return {
                items: newParsed.items,
                source: 'new-memory',
                oldKeyRemoved: false,
                error: verify.status,
                canRetry: true,
                persistHistory: persistHistory
            };
        }

        if (!newParsed.ok) {
            return {
                items: oldParsed.ok ? oldParsed.items : [],
                source: oldParsed.ok ? 'old-fallback' : 'corrupt',
                oldKeyRemoved: false,
                error: 'corrupt-new',
                canRetry: true,
                persistHistory: persistHistory,
                raw: newParsed.raw
            };
        }

        if (oldParsed.ok && !oldParsed.empty) {
            const migrated = persistItems(storage, oldParsed.items, {
                persistEnabled: persistHistory,
                removeOldKey: persistHistory
            });
            if (migrated.persisted && migrated.verified) {
                return {
                    items: oldParsed.items,
                    source: 'migrated',
                    oldKeyRemoved: migrated.oldKeyRemoved,
                    error: null,
                    canRetry: false,
                    persistHistory: persistHistory
                };
            }
            if (migrated.status === STATUS.SESSION) {
                return {
                    items: oldParsed.items,
                    source: 'old-session',
                    oldKeyRemoved: false,
                    error: null,
                    canRetry: false,
                    persistHistory: persistHistory
                };
            }
            return {
                items: oldParsed.items,
                source: 'old-memory',
                oldKeyRemoved: false,
                error: migrated.status,
                canRetry: true,
                persistHistory: persistHistory
            };
        }

        if (!oldParsed.ok) {
            return {
                items: [],
                source: 'corrupt',
                oldKeyRemoved: false,
                error: 'corrupt-old',
                canRetry: true,
                persistHistory: persistHistory,
                raw: oldParsed.raw
            };
        }

        return {
            items: [],
            source: 'none',
            oldKeyRemoved: false,
            error: null,
            canRetry: false,
            persistHistory: persistHistory
        };
    }

    function exportPayload(items) {
        return serialize(items);
    }

    return {
        OLD_KEY: OLD_KEY,
        NEW_KEY: NEW_KEY,
        PREF_KEY: PREF_KEY,
        MAX_ITEMS: MAX_ITEMS,
        MAX_BYTES: MAX_BYTES,
        STATUS: STATUS,
        MESSAGES: MESSAGES,
        utf8Bytes: utf8Bytes,
        serialize: serialize,
        parseHistory: parseHistory,
        applyBudget: applyBudget,
        addItem: addItem,
        parsePreference: parsePreference,
        statusMessage: statusMessage,
        persistItems: persistItems,
        migrate: migrate,
        exportPayload: exportPayload
    };
});
