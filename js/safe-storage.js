(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SafeStorage = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    function errorKind(error) {
        if (!error) {
            return 'unknown';
        }
        const name = String(error.name || '');
        const code = error.code;
        const message = String(error.message || '');
        if (
            name === 'SecurityError' ||
            code === 18 ||
            /securityerror|access is denied|the operation is insecure/i.test(message)
        ) {
            return 'security';
        }
        if (
            name === 'QuotaExceededError' ||
            name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            code === 22 ||
            code === 1014 ||
            /quota/i.test(message)
        ) {
            return 'quota';
        }
        return 'unknown';
    }

    function probeBackend(backend) {
        if (!backend || typeof backend.getItem !== 'function') {
            return { readOk: false, writeOk: false, reason: 'unavailable' };
        }
        let readOk = false;
        let writeOk = false;
        let reason = 'unavailable';
        try {
            backend.getItem('__17tools_probe__');
            readOk = true;
            reason = null;
        } catch (error) {
            reason = errorKind(error);
        }
        if (typeof backend.setItem !== 'function') {
            return { readOk: readOk, writeOk: false, reason: reason || 'unavailable' };
        }
        const probeKey = '__17tools_probe__';
        try {
            backend.setItem(probeKey, '1');
            let readBack = null;
            try {
                readBack = backend.getItem(probeKey);
            } catch (error) {
                reason = errorKind(error);
                readOk = false;
            }
            if (typeof backend.removeItem === 'function') {
                try {
                    backend.removeItem(probeKey);
                } catch (error) { /* ignore probe cleanup */ }
            }
            if (readBack === '1') {
                writeOk = true;
                readOk = true;
                reason = null;
            }
        } catch (error) {
            reason = errorKind(error);
            if (reason === 'security') {
                readOk = false;
                writeOk = false;
            }
        }
        return { readOk: readOk, writeOk: writeOk, reason: reason };
    }

    function createSafeStorage(backend) {
        const memory = Object.create(null);
        const probed = probeBackend(backend);
        let readOk = !!probed.readOk;
        let writeOk = !!probed.writeOk;
        let lastReason = probed.reason || (readOk || writeOk ? null : 'unavailable');

        function disableRead(reason) {
            readOk = false;
            lastReason = reason || lastReason || 'unknown';
        }

        function disableWrite(reason) {
            writeOk = false;
            lastReason = reason || lastReason || 'unknown';
            if (reason === 'security') {
                disableRead(reason);
            }
        }

        function getItem(key) {
            const name = String(key || '');
            if (readOk) {
                try {
                    const value = backend.getItem(name);
                    if (value == null) {
                        return Object.prototype.hasOwnProperty.call(memory, name) ? memory[name] : null;
                    }
                    return String(value);
                } catch (error) {
                    disableRead(errorKind(error));
                }
            }
            return Object.prototype.hasOwnProperty.call(memory, name) ? memory[name] : null;
        }

        function setItem(key, value) {
            const name = String(key || '');
            const text = String(value == null ? '' : value);
            memory[name] = text;
            if (!writeOk) {
                return { ok: true, persisted: false, reason: lastReason || 'unavailable', verified: false };
            }
            try {
                backend.setItem(name, text);
            } catch (error) {
                const reason = errorKind(error);
                disableWrite(reason);
                return { ok: true, persisted: false, reason: reason, verified: false };
            }
            try {
                const read = backend.getItem(name);
                if (read === text) {
                    lastReason = null;
                    return { ok: true, persisted: true, reason: null, verified: true };
                }
                lastReason = 'unknown';
                return { ok: true, persisted: false, reason: 'unknown', verified: false };
            } catch (error) {
                disableRead(errorKind(error));
                return { ok: true, persisted: false, reason: lastReason, verified: false };
            }
        }

        function removeItem(key) {
            const name = String(key || '');
            delete memory[name];
            if (!writeOk) {
                return { ok: true, persisted: false, reason: lastReason || 'unavailable' };
            }
            try {
                if (typeof backend.removeItem === 'function') {
                    backend.removeItem(name);
                }
                return { ok: true, persisted: true, reason: null };
            } catch (error) {
                const reason = errorKind(error);
                disableWrite(reason);
                return { ok: true, persisted: false, reason: reason };
            }
        }

        return {
            getItem: getItem,
            setItem: setItem,
            removeItem: removeItem,
            isAvailable: function () {
                return writeOk;
            },
            canRead: function () {
                return readOk;
            },
            lastReason: function () {
                return lastReason;
            },
            memorySnapshot: function () {
                const copy = {};
                Object.keys(memory).forEach(function (key) {
                    copy[key] = memory[key];
                });
                return copy;
            }
        };
    }

    function getNativeLocalStorage(win) {
        const target = win || (typeof window !== 'undefined' ? window : null);
        if (!target) {
            return null;
        }
        try {
            return target.localStorage || null;
        } catch (error) {
            return null;
        }
    }

    const api = {
        errorKind: errorKind,
        probeBackend: probeBackend,
        createSafeStorage: createSafeStorage,
        getNativeLocalStorage: getNativeLocalStorage,
        createShared: function (win) {
            return createSafeStorage(getNativeLocalStorage(win));
        }
    };

    if (typeof window !== 'undefined' && !window.SafeStorageShared) {
        api.shared = api.createShared(window);
    }

    return api;
});
