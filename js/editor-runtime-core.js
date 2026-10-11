(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.EditorRuntimeCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const AUTO_COMPUTE_MAX_CHARS = 100 * 1024;
    const WORKER_MIN_CHARS = 32 * 1024;
    const DISPLAY_MAX_LINES = 2000;
    const DISPLAY_MAX_CHARS = 200 * 1024;
    const HIGHLIGHT_MAX_CHARS = 100 * 1024;
    const LINE_NUMBER_DELTA_MAX = 40;
    const PREVIEW_MAX_CHILDREN = 400;

    function inputChars(value) {
        return String(value == null ? '' : value).length;
    }

    function combinedChars() {
        var total = 0;
        var i;
        for (i = 0; i < arguments.length; i += 1) {
            total += inputChars(arguments[i]);
        }
        return total;
    }

    function shouldAutoCompute(chars) {
        return Number(chars || 0) <= AUTO_COMPUTE_MAX_CHARS;
    }

    function shouldUseWorker(chars) {
        return Number(chars || 0) >= WORKER_MIN_CHARS;
    }

    function shouldHighlight(chars) {
        return Number(chars || 0) <= HIGHLIGHT_MAX_CHARS;
    }

    function nextRequestId(prev) {
        var current = Number(prev);
        if (!Number.isFinite(current) || current < 0) {
            current = 0;
        }
        return current + 1;
    }

    function isCurrentRequest(current, incoming) {
        return Number(current) === Number(incoming);
    }

    function lineCount(value) {
        var text = String(value == null ? '' : value);
        if (text === '') {
            return 1;
        }
        var count = 1;
        var index = 0;
        while (index < text.length) {
            if (text.charCodeAt(index) === 10) {
                count += 1;
            }
            index += 1;
        }
        return count;
    }

    function planLineNumbers(prevCount, nextCount) {
        var prev = Math.max(1, Number(prevCount) || 1);
        var next = Math.max(1, Number(nextCount) || 1);
        if (prev === next) {
            return { type: 'noop', count: next, add: 0, remove: 0 };
        }
        if (next > prev && (next - prev) <= LINE_NUMBER_DELTA_MAX) {
            return { type: 'append', count: next, add: next - prev, remove: 0, from: prev + 1, to: next };
        }
        if (next < prev && (prev - next) <= LINE_NUMBER_DELTA_MAX) {
            return { type: 'remove', count: next, add: 0, remove: prev - next };
        }
        return { type: 'rebuild', count: next, add: next, remove: prev };
    }

    function planTextDisplay(value) {
        var text = String(value == null ? '' : value);
        var lines = lineCount(text);
        var truncated = false;
        var shown = text;
        var reason = '';

        if (text.length > DISPLAY_MAX_CHARS) {
            shown = text.slice(0, DISPLAY_MAX_CHARS);
            truncated = true;
            reason = 'chars';
        }

        if (lines > DISPLAY_MAX_LINES) {
            var limited = [];
            var taken = 0;
            var start = 0;
            var cursor = 0;
            while (cursor <= text.length && taken < DISPLAY_MAX_LINES) {
                if (cursor === text.length || text.charCodeAt(cursor) === 10) {
                    limited.push(text.slice(start, cursor));
                    taken += 1;
                    start = cursor + 1;
                }
                cursor += 1;
            }
            var lineShown = limited.join('\n');
            if (lineShown.length < shown.length) {
                shown = lineShown;
                truncated = true;
                reason = reason ? reason + '+lines' : 'lines';
            }
        }

        return {
            truncated: truncated,
            shown: shown,
            full: text,
            omittedChars: Math.max(0, text.length - shown.length),
            shownLines: lineCount(shown),
            fullLines: lines,
            reason: reason
        };
    }

    function planPreviewChildren(childCount) {
        var count = Math.max(0, Number(childCount) || 0);
        if (count <= PREVIEW_MAX_CHILDREN) {
            return { truncated: false, keep: count, drop: 0 };
        }
        return { truncated: true, keep: PREVIEW_MAX_CHILDREN, drop: count - PREVIEW_MAX_CHILDREN };
    }

    function heavyInputMessage() {
        return '输入超过 100KB，已停止自动处理，请点击按钮执行';
    }

    function displayTruncatedMessage() {
        return '展示已截断，复制和导出仍是完整内容';
    }

    function dependencyFailedMessage() {
        return '依赖加载失败，输入仍保留，可点击重试';
    }

    function workerFallbackMessage() {
        return '当前环境无法使用后台计算，已在页面内执行';
    }

    function skippedHighlightMessage() {
        return '输入较大，已跳过语法高亮；复制和导出仍是完整内容';
    }

    return {
        AUTO_COMPUTE_MAX_CHARS: AUTO_COMPUTE_MAX_CHARS,
        WORKER_MIN_CHARS: WORKER_MIN_CHARS,
        DISPLAY_MAX_LINES: DISPLAY_MAX_LINES,
        DISPLAY_MAX_CHARS: DISPLAY_MAX_CHARS,
        HIGHLIGHT_MAX_CHARS: HIGHLIGHT_MAX_CHARS,
        PREVIEW_MAX_CHILDREN: PREVIEW_MAX_CHILDREN,
        inputChars: inputChars,
        combinedChars: combinedChars,
        shouldAutoCompute: shouldAutoCompute,
        shouldUseWorker: shouldUseWorker,
        shouldHighlight: shouldHighlight,
        nextRequestId: nextRequestId,
        isCurrentRequest: isCurrentRequest,
        lineCount: lineCount,
        planLineNumbers: planLineNumbers,
        planTextDisplay: planTextDisplay,
        planPreviewChildren: planPreviewChildren,
        heavyInputMessage: heavyInputMessage,
        displayTruncatedMessage: displayTruncatedMessage,
        dependencyFailedMessage: dependencyFailedMessage,
        workerFallbackMessage: workerFallbackMessage,
        skippedHighlightMessage: skippedHighlightMessage
    };
}));
