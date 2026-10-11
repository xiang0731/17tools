(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CodeDiffCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const JSDIFF_VERSION = '5.1.0';
    const DIFF2HTML_VERSION = '3.4.56';
    const JSDIFF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jsdiff/' + JSDIFF_VERSION + '/diff.min.js';
    const DIFF2HTML_JS_URL = 'https://cdn.jsdelivr.net/npm/diff2html@' + DIFF2HTML_VERSION + '/bundles/js/diff2html-ui-slim.min.js';
    const DIFF2HTML_CSS_URL = 'https://cdn.jsdelivr.net/npm/diff2html@' + DIFF2HTML_VERSION + '/bundles/css/diff2html.min.css';
    const JSDIFF_INTEGRITY = 'sha512-vco9RAxEuv4PQ+iTQyuKElwoUOcsVdp+WgU6Lgo82ASpDfF7vI66LlWz+CZc2lMdn52tjjLOuHvy8BQJFp8a1A==';
    const DIFF2HTML_JS_INTEGRITY = 'sha512-CPdxeQvVk+vCFdUDN3d6D1RfuE3/irA/npu8lsaqBrQFUZLyAECDyuhrHUhor+6y34DNZgn9W0l+/AXbRatJzg==';
    const DIFF2HTML_CSS_INTEGRITY = 'sha512-1mTXcOIpTlt1QDpJfE5r7XxEB9chGqfQ8r4RGBsL+Nh3Vg/z4JVPrgQEBLDy5FeXcW6ZkPA6zy5onbOKPci6KQ==';

    function createSession() {
        return {
            oldText: '',
            newText: '',
            generation: 0,
            requestId: 0,
            result: null,
            status: 'empty',
            error: ''
        };
    }

    function setInputs(session, patch) {
        const src = session && typeof session === 'object' ? session : createSession();
        const nextPatch = patch && typeof patch === 'object' ? patch : {};
        const next = {
            oldText: nextPatch.oldText !== undefined ? String(nextPatch.oldText) : String(src.oldText ?? ''),
            newText: nextPatch.newText !== undefined ? String(nextPatch.newText) : String(src.newText ?? ''),
            generation: Number(src.generation || 0) + 1,
            requestId: Number(src.requestId || 0),
            result: src.result == null ? null : src.result,
            status: src.status || 'empty',
            error: src.error || ''
        };

        if (!next.oldText && !next.newText) {
            next.result = null;
            next.status = 'empty';
            next.error = '';
            return next;
        }

        next.status = 'stale';
        return next;
    }

    function beginCompare(session) {
        const src = session && typeof session === 'object' ? session : createSession();
        return {
            generation: Number(src.generation || 0),
            requestId: Number(src.requestId || 0),
            oldText: String(src.oldText ?? ''),
            newText: String(src.newText ?? '')
        };
    }

    function beginCompareWithRequest(session, requestId) {
        const src = session && typeof session === 'object' ? session : createSession();
        return {
            oldText: String(src.oldText ?? ''),
            newText: String(src.newText ?? ''),
            generation: Number(src.generation || 0),
            requestId: Number(requestId || 0),
            next: {
                oldText: String(src.oldText ?? ''),
                newText: String(src.newText ?? ''),
                generation: Number(src.generation || 0),
                requestId: Number(requestId || 0),
                result: src.result == null ? null : src.result,
                status: src.status,
                error: src.error || ''
            }
        };
    }

    function assetUrls() {
        return {
            jsdiff: JSDIFF_URL,
            diff2htmlJs: DIFF2HTML_JS_URL,
            diff2htmlCss: DIFF2HTML_CSS_URL
        };
    }

    function assetResources() {
        return {
            jsdiff: { url: JSDIFF_URL, integrity: JSDIFF_INTEGRITY },
            diff2htmlJs: { url: DIFF2HTML_JS_URL, integrity: DIFF2HTML_JS_INTEGRITY },
            diff2htmlCss: { url: DIFF2HTML_CSS_URL, integrity: DIFF2HTML_CSS_INTEGRITY }
        };
    }

    function finishCompare(session, requestGeneration, payload) {
        const src = session && typeof session === 'object' ? session : createSession();
        if (Number(requestGeneration) !== Number(src.generation || 0)) {
            return {
                oldText: src.oldText,
                newText: src.newText,
                generation: src.generation,
                requestId: src.requestId,
                result: src.result == null ? null : src.result,
                status: src.status,
                error: src.error || ''
            };
        }
        if (payload && payload.requestId != null && Number(payload.requestId) !== Number(src.requestId || 0)) {
            return {
                oldText: src.oldText,
                newText: src.newText,
                generation: src.generation,
                requestId: src.requestId,
                result: src.result == null ? null : src.result,
                status: src.status,
                error: src.error || ''
            };
        }

        if (!src.oldText && !src.newText) {
            return {
                oldText: '',
                newText: '',
                generation: src.generation,
                requestId: src.requestId,
                result: null,
                status: 'empty',
                error: ''
            };
        }

        const body = payload && typeof payload === 'object' ? payload : {};
        if (body.error) {
            return {
                oldText: src.oldText,
                newText: src.newText,
                generation: src.generation,
                requestId: src.requestId,
                result: src.result == null ? null : src.result,
                status: 'failed',
                error: String(body.error)
            };
        }

        return {
            oldText: src.oldText,
            newText: src.newText,
            generation: src.generation,
            requestId: src.requestId,
            result: body.diff,
            status: 'valid',
            error: ''
        };
    }

    return {
        JSDIFF_VERSION,
        DIFF2HTML_VERSION,
        JSDIFF_URL,
        DIFF2HTML_JS_URL,
        DIFF2HTML_CSS_URL,
        JSDIFF_INTEGRITY,
        DIFF2HTML_JS_INTEGRITY,
        DIFF2HTML_CSS_INTEGRITY,
        assetUrls,
        assetResources,
        createSession,
        setInputs,
        beginCompare,
        beginCompareWithRequest,
        finishCompare
    };
}));
