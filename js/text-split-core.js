(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TextSplitCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var MAX_INPUT_CHARS = 1000000;
    var MAX_RENDERED_PARTS = 50;

    var MESSAGES = {
        empty: '没有检测到有效行',
        linesPerPart: '每份行数至少为 1',
        overLimit: '超过 100 万字，建议缩小文本或增大每份行数',
        displayBudget: '屏幕只显示当前一批，复制和下载仍是完整结果'
    };

    function fail(reason, inputChars) {
        return {
            ok: false,
            reason: reason,
            parts: [],
            totalLines: 0,
            linesPerPart: 0,
            partsCount: 0,
            lastPartLines: 0,
            lastPartIncomplete: false,
            inputChars: inputChars || 0,
            fullText: ''
        };
    }

    function splitText(text, linesPerPart) {
        var source = text == null ? '' : String(text);
        var per = Number(linesPerPart);
        if (!Number.isInteger(per) || per < 1) {
            return fail(MESSAGES.linesPerPart, source.length);
        }
        var linesPer = Math.floor(per);
        if (source.length > MAX_INPUT_CHARS) {
            return fail(MESSAGES.overLimit, source.length);
        }
        if (source === '') {
            return fail(MESSAGES.empty, 0);
        }

        var normalized = source.replace(/\r\n|\r/g, '\n');
        var totalLines = 1;
        for (var i = 0; i < normalized.length; i++) if (normalized[i] === '\n') totalLines++;
        var starts = new Uint32Array(totalLines + 1);
        var cursor = 1;
        for (var j = 0; j < normalized.length; j++) if (normalized[j] === '\n') starts[cursor++] = j + 1;
        starts[totalLines] = normalized.length + 1;
        var partsCount = Math.ceil(totalLines / linesPer);
        function partAt(index) {
            if (!Number.isInteger(index) || index < 0 || index >= partsCount) return undefined;
            var from = index * linesPer;
            var until = Math.min(totalLines, from + linesPer);
            return {
                index: index, number: index + 1, startLine: from + 1, endLine: until,
                lineCount: until - from,
                text: normalized.slice(starts[from], starts[until] - 1),
                filename: 'split_part_' + (index + 1) + '.txt'
            };
        }
        // Keep the public array interface without allocating an object/string per part.
        var parts = new Proxy(new Array(partsCount), {
            get: function (target, key) {
                if (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)) return partAt(Number(key));
                return Reflect.get(target, key);
            },
            has: function (target, key) {
                if (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)) return Number(key) < partsCount;
                return Reflect.has(target, key);
            }
        });
        var lastLines = totalLines - (partsCount - 1) * linesPer;
        return {
            ok: true, reason: '', parts: parts, totalLines: totalLines,
            linesPerPart: linesPer, partsCount: partsCount,
            lastPartLines: lastLines, lastPartIncomplete: lastLines !== linesPer,
            inputChars: source.length, fullText: source,
            indexBytes: starts.byteLength, materializedParts: 0
        };
    }

    function pageWindow(partsCount, pageIndex) {
        var total = Math.max(0, Number(partsCount) || 0);
        var pageCount = total === 0 ? 1 : Math.ceil(total / MAX_RENDERED_PARTS);
        var page = Number(pageIndex);
        if (!Number.isFinite(page) || page < 0) page = 0;
        if (page > pageCount - 1) page = pageCount - 1;
        var start = page * MAX_RENDERED_PARTS;
        var end = Math.min(start + MAX_RENDERED_PARTS, total);
        return {
            page: page,
            pageCount: pageCount,
            start: start,
            end: end,
            count: Math.max(0, end - start),
            truncated: total > MAX_RENDERED_PARTS
        };
    }

    function visibleParts(result, pageIndex) {
        if (!result || result.ok !== true || !Array.isArray(result.parts)) return [];
        var windowInfo = pageWindow(result.parts.length, pageIndex);
        return result.parts.slice(windowInfo.start, windowInfo.end);
    }

    function renderedBlockCount(result, pageIndex) {
        return visibleParts(result, pageIndex).length;
    }

    function exportAllText(result) {
        if (!result || result.ok !== true) return '';
        return String(result.fullText || '');
    }

    function exportPartText(result, index) {
        if (!result || result.ok !== true || !Array.isArray(result.parts)) return '';
        var part = result.parts[index];
        if (!part) return '';
        return String(part.text);
    }

    function displayBudgetMessage() {
        return MESSAGES.displayBudget;
    }

    return {
        MAX_INPUT_CHARS: MAX_INPUT_CHARS,
        MAX_RENDERED_PARTS: MAX_RENDERED_PARTS,
        MESSAGES: MESSAGES,
        splitText: splitText,
        pageWindow: pageWindow,
        visibleParts: visibleParts,
        renderedBlockCount: renderedBlockCount,
        exportAllText: exportAllText,
        exportPartText: exportPartText,
        displayBudgetMessage: displayBudgetMessage
    };
}));
