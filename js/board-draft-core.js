(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./board-load-core.js'));
    } else {
        root.BoardDraftCore = factory(root.BoardLoadCore);
    }
})(typeof window !== 'undefined' ? window : globalThis, function (BoardLoadCore) {
    'use strict';

    const DB_NAME = '17tools-board-draft';
    const STORE_NAME = 'drafts';
    const RECORD_KEY = 'current';
    const DEBOUNCE_MS = 800;
    const BOARD_VERSION = '1.2';

    const STATUS = {
        SESSION: 'session',
        UNAVAILABLE: 'unavailable',
        PAUSED: 'paused',
        SAVED: 'saved',
        FAILED: 'failed',
        QUOTA: 'quota'
    };

    const MESSAGES = {
        banner: '本机留有上次画到一半的草稿',
        priorityHint: '临时槽 1/2/3 会一起回来；撤销只记这次打开，不进草稿。',
        quota: '本机空间不够，草稿没写进去。请下载 JSON 再继续。',
        session: '草稿仅在本次会话',
        unavailable: '本机草稿不可用，画只留在这次打开里',
        paused: '有未恢复的草稿，先恢复或丢弃',
        saved: '草稿已写入本机',
        failed: '草稿没写进去，画还在当前页',
        quotaStatus: '本机空间不够，请下载 JSON',
        restore: '恢复',
        discard: '丢弃',
        downloadJson: '下载 JSON',
        dismissQuota: '知道了'
    };

    function emptyCamera() {
        return { offsetX: 0, offsetY: 0, scale: 1 };
    }

    function emptySlot() {
        return { tiles: {}, camera: emptyCamera(), theme: '' };
    }

    function normalizeSlot(value) {
        const id = Number(value);
        return id === 2 || id === 3 ? id : 1;
    }

    function normalizeCamera(camera) {
        if (!camera || typeof camera !== 'object') {
            return emptyCamera();
        }
        const scale = Number(camera.scale);
        return {
            offsetX: Number.isFinite(Number(camera.offsetX)) ? Number(camera.offsetX) : 0,
            offsetY: Number.isFinite(Number(camera.offsetY)) ? Number(camera.offsetY) : 0,
            scale: Number.isFinite(scale) && scale > 0 ? scale : 1
        };
    }

    function cloneTiles(tiles) {
        if (!tiles || typeof tiles !== 'object' || Array.isArray(tiles)) {
            return {};
        }
        const out = {};
        Object.keys(tiles).forEach(function (key) {
            if (typeof tiles[key] === 'string' && tiles[key]) {
                out[key] = tiles[key];
            }
        });
        return out;
    }

    function hasTilesContent(tiles) {
        if (!tiles || typeof tiles !== 'object' || Array.isArray(tiles)) {
            return false;
        }
        return Object.keys(tiles).some(function (key) {
            return typeof tiles[key] === 'string' && tiles[key].length > 0;
        });
    }

    function normalizeSlotSnapshot(src) {
        if (!src || typeof src !== 'object' || Array.isArray(src)) {
            return emptySlot();
        }
        return {
            tiles: cloneTiles(src.tiles),
            camera: normalizeCamera(src.camera),
            theme: src.theme === 'dark' || src.theme === 'light' ? src.theme : ''
        };
    }

    function normalizeSlots(slots, board, currentSlot) {
        const out = {
            1: emptySlot(),
            2: emptySlot(),
            3: emptySlot()
        };
        [1, 2, 3].forEach(function (id) {
            out[id] = normalizeSlotSnapshot(slots && slots[id]);
        });
        out[currentSlot] = {
            tiles: cloneTiles(board && board.tiles),
            camera: normalizeCamera(board && board.camera),
            theme: board && (board.theme === 'dark' || board.theme === 'light') ? board.theme : ''
        };
        return out;
    }

    function recordHasContent(record) {
        if (!record || typeof record !== 'object') {
            return false;
        }
        if (BoardLoadCore.hasTiles(record.board) && hasTilesContent(record.board.tiles)) {
            return true;
        }
        if (BoardLoadCore.hasLegacyCanvas(record.board)) {
            return true;
        }
        const slots = record.slots || {};
        return [1, 2, 3].some(function (id) {
            return hasTilesContent(slots[id] && slots[id].tiles);
        });
    }

    function serializeDraft(input) {
        const board = input && input.board;
        if (!BoardLoadCore.isValidBoardPayload(board)) {
            return { ok: false, reason: 'missing-fields' };
        }
        const currentSlot = normalizeSlot(input && input.currentSlot);
        const record = {
            version: 1,
            savedAt: typeof (input && input.savedAt) === 'string' && input.savedAt
                ? input.savedAt
                : '',
            currentSlot: currentSlot,
            board: board,
            slots: normalizeSlots(input && input.slots, board, currentSlot)
        };
        if (!record.savedAt) {
            record.savedAt = new Date().toISOString();
        }
        return { ok: true, record: record };
    }

    function parseDraft(raw) {
        if (raw == null || raw === '') {
            return { ok: true, empty: true, record: null };
        }
        let data = raw;
        if (typeof raw === 'string') {
            try {
                data = JSON.parse(raw);
            } catch (error) {
                return { ok: false, reason: 'not-json' };
            }
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return { ok: false, reason: 'missing-fields' };
        }
        const board = data.board && typeof data.board === 'object' ? data.board : data;
        if (!BoardLoadCore.isValidBoardPayload(board)) {
            return { ok: false, reason: 'missing-fields' };
        }
        const currentSlot = normalizeSlot(data.currentSlot);
        return {
            ok: true,
            empty: false,
            record: {
                version: 1,
                savedAt: typeof data.savedAt === 'string' ? data.savedAt : '',
                currentSlot: currentSlot,
                board: board,
                slots: normalizeSlots(data.slots, board, currentSlot)
            }
        };
    }

    function decideRestore(loaded) {
        if (!loaded || loaded.ok === false) {
            return {
                showBanner: false,
                record: null,
                reason: loaded && loaded.reason ? loaded.reason : 'unavailable'
            };
        }
        const parsed = parseDraft(loaded.record);
        if (!parsed.ok) {
            return { showBanner: false, record: null, reason: parsed.reason };
        }
        if (parsed.empty || !recordHasContent(parsed.record)) {
            return { showBanner: false, record: null, reason: 'empty' };
        }
        return {
            showBanner: true,
            record: parsed.record,
            banner: MESSAGES.banner,
            hint: MESSAGES.priorityHint
        };
    }

    function isQuotaError(error) {
        if (!error) {
            return false;
        }
        const name = String(error.name || '');
        const message = String(error.message || '');
        const code = error.code;
        return name === 'QuotaExceededError'
            || name === 'NS_ERROR_DOM_QUOTA_REACHED'
            || code === 22
            || /quota/i.test(message);
    }

    function statusMessage(status) {
        if (status === STATUS.SAVED) {
            return MESSAGES.saved;
        }
        if (status === STATUS.QUOTA) {
            return MESSAGES.quotaStatus;
        }
        if (status === STATUS.FAILED) {
            return MESSAGES.failed;
        }
        if (status === STATUS.UNAVAILABLE) {
            return MESSAGES.unavailable;
        }
        if (status === STATUS.PAUSED) {
            return MESSAGES.paused;
        }
        return MESSAGES.session;
    }

    function toDownloadJson(record) {
        const board = record && record.board;
        if (!BoardLoadCore.isValidBoardPayload(board)) {
            return '';
        }
        return JSON.stringify(board);
    }

    function downloadFilename(now) {
        const stamp = now && typeof now.getTime === 'function' ? now.getTime() : Date.now();
        return 'whiteboard_' + stamp + '.json';
    }

    function createDebouncer(fn, wait) {
        const delay = Number(wait);
        const ms = Number.isFinite(delay) && delay >= 0 ? delay : DEBOUNCE_MS;
        let timer = null;
        function schedule() {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(function () {
                timer = null;
                fn();
            }, ms);
        }
        function flush() {
            if (!timer) {
                return;
            }
            clearTimeout(timer);
            timer = null;
            fn();
        }
        function cancel() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        }
        function isPending() {
            return timer !== null;
        }
        return {
            schedule: schedule,
            flush: flush,
            cancel: cancel,
            isPending: isPending
        };
    }

    function createMemoryStore(options) {
        const opts = options || {};
        let record = Object.prototype.hasOwnProperty.call(opts, 'record') ? opts.record : null;
        return {
            available: opts.available !== false,
            get: function () {
                if (opts.available === false) {
                    return Promise.resolve({ ok: false, reason: 'unavailable' });
                }
                return Promise.resolve({ ok: true, record: record });
            },
            set: function (next) {
                if (opts.quota) {
                    return Promise.resolve({ ok: false, reason: 'quota' });
                }
                record = next;
                return Promise.resolve({ ok: true });
            },
            remove: function () {
                record = null;
                return Promise.resolve({ ok: true });
            }
        };
    }

    function openDatabase(indexedDBImpl) {
        return new Promise(function (resolve, reject) {
            const request = indexedDBImpl.open(DB_NAME, 1);
            request.onupgradeneeded = function () {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = function () {
                resolve(request.result);
            };
            request.onerror = function () {
                reject(request.error);
            };
        });
    }

    function createIndexedDbStore(indexedDBImpl) {
        const idb = indexedDBImpl || (typeof indexedDB !== 'undefined' ? indexedDB : null);
        if (!idb) {
            return createMemoryStore({ available: false });
        }
        let dbPromise = null;
        function db() {
            if (!dbPromise) {
                dbPromise = openDatabase(idb);
            }
            return dbPromise;
        }
        function fail(error) {
            return {
                ok: false,
                reason: isQuotaError(error) ? 'quota' : 'unavailable',
                error: error
            };
        }
        return {
            available: true,
            get: function () {
                return db().then(function (database) {
                    return new Promise(function (resolve) {
                        const tx = database.transaction(STORE_NAME, 'readonly');
                        const request = tx.objectStore(STORE_NAME).get(RECORD_KEY);
                        request.onsuccess = function () {
                            resolve({ ok: true, record: request.result || null });
                        };
                        request.onerror = function () {
                            resolve({ ok: false, reason: 'read-failed', error: request.error });
                        };
                    });
                }).catch(function (error) {
                    return fail(error);
                });
            },
            set: function (record) {
                return db().then(function (database) {
                    return new Promise(function (resolve) {
                        const tx = database.transaction(STORE_NAME, 'readwrite');
                        const request = tx.objectStore(STORE_NAME).put(record, RECORD_KEY);
                        let settled = false;
                        function done(result) {
                            if (settled) {
                                return;
                            }
                            settled = true;
                            resolve(result);
                        }
                        request.onsuccess = function () {
                            done({ ok: true });
                        };
                        request.onerror = function () {
                            done(fail(request.error));
                        };
                        tx.onabort = function () {
                            done(fail(tx.error || request.error));
                        };
                    });
                }).catch(function (error) {
                    return fail(error);
                });
            },
            remove: function () {
                return db().then(function (database) {
                    return new Promise(function (resolve) {
                        const tx = database.transaction(STORE_NAME, 'readwrite');
                        const request = tx.objectStore(STORE_NAME).delete(RECORD_KEY);
                        request.onsuccess = function () {
                            resolve({ ok: true });
                        };
                        request.onerror = function () {
                            resolve({ ok: false, reason: 'delete-failed', error: request.error });
                        };
                    });
                }).catch(function (error) {
                    return fail(error);
                });
            }
        };
    }

    return {
        DB_NAME: DB_NAME,
        STORE_NAME: STORE_NAME,
        RECORD_KEY: RECORD_KEY,
        DEBOUNCE_MS: DEBOUNCE_MS,
        BOARD_VERSION: BOARD_VERSION,
        STATUS: STATUS,
        MESSAGES: MESSAGES,
        serializeDraft: serializeDraft,
        parseDraft: parseDraft,
        decideRestore: decideRestore,
        recordHasContent: recordHasContent,
        hasTilesContent: hasTilesContent,
        isQuotaError: isQuotaError,
        statusMessage: statusMessage,
        toDownloadJson: toDownloadJson,
        downloadFilename: downloadFilename,
        createDebouncer: createDebouncer,
        createMemoryStore: createMemoryStore,
        createIndexedDbStore: createIndexedDbStore,
        normalizeSlot: normalizeSlot
    };
});
