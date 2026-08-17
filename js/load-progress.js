(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.LoadProgress = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const DELAY_MS = 1000;
    const PROGRESS_CAP = 0.9;
    const DEFAULT_ESTIMATE_MS = 2500;
    const ESTIMATES_MS = {
        'PrettyFormat.html': 8000,
        'ImageProcessor.html': 3000,
        'Markdown.html': 3000,
        'QRCode.html': 2000,
        'CodeDiff.html': 1500,
        'About.html': 1200
    };

    function pageName(src) {
        const value = String(src || '');
        if (!value) {
            return '';
        }
        const parts = value.split(/[\\/]/);
        return parts[parts.length - 1] || value;
    }

    function estimateFor(fileName) {
        const name = pageName(fileName);
        if (Object.prototype.hasOwnProperty.call(ESTIMATES_MS, name)) {
            return ESTIMATES_MS[name];
        }
        return DEFAULT_ESTIMATE_MS;
    }

    function progressAt(elapsedMs, estimateMs, loaded) {
        if (loaded) {
            return 1;
        }
        const elapsed = Math.max(0, Number(elapsedMs) || 0);
        const estimate = Math.max(1, Number(estimateMs) || DEFAULT_ESTIMATE_MS);
        return Math.min(PROGRESS_CAP, elapsed / estimate);
    }

    function loadingCopy(label) {
        const name = String(label || '').trim();
        return name ? '正在加载 ' + name : '正在加载';
    }

    function idleState() {
        return {
            active: false,
            visible: false,
            progress: 0,
            percent: 0,
            label: '正在加载',
            fileName: ''
        };
    }

    function createController() {
        let session = null;

        function getState(now) {
            if (!session) {
                return idleState();
            }
            const elapsed = Math.max(0, now - session.startedAt);
            if (!session.loaded && !session.hidden && elapsed >= DELAY_MS) {
                session.revealed = true;
            }
            const progress = progressAt(elapsed, session.estimateMs, session.loaded);
            return {
                active: !session.loaded,
                visible: session.revealed && !session.hidden,
                progress: progress,
                percent: Math.round(progress * 100),
                label: loadingCopy(session.label),
                fileName: session.fileName
            };
        }

        function start(meta, now) {
            const fileName = pageName(meta && meta.fileName);
            session = {
                fileName: fileName,
                label: meta && meta.label ? String(meta.label) : '',
                startedAt: now,
                estimateMs: estimateFor(fileName),
                loaded: false,
                revealed: false,
                hidden: false
            };
            return getState(now);
        }

        function complete(now) {
            if (!session) {
                return getState(now);
            }
            session.loaded = true;
            if (!session.revealed) {
                session.hidden = true;
            }
            return getState(now);
        }

        function hide(now) {
            if (session) {
                session.hidden = true;
            }
            return getState(now);
        }

        return {
            start: start,
            getState: getState,
            complete: complete,
            hide: hide
        };
    }

    return {
        DELAY_MS: DELAY_MS,
        PROGRESS_CAP: PROGRESS_CAP,
        DEFAULT_ESTIMATE_MS: DEFAULT_ESTIMATE_MS,
        ESTIMATES_MS: ESTIMATES_MS,
        pageName: pageName,
        estimateFor: estimateFor,
        progressAt: progressAt,
        loadingCopy: loadingCopy,
        createController: createController
    };
});
