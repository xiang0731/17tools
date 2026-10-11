(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./text-budget-core.js'));
    } else {
        root.ReplacerCore = factory(root.TextBudgetCore);
    }
})(typeof window !== 'undefined' ? window : globalThis, function (budget) {
    'use strict';

    function processSpecialChars(text) {
        const source = String(text == null ? '' : text);
        const escapes = { n: '\n', t: '\t', r: '\r', '\\': '\\' };
        let result = '';
        for (let i = 0; i < source.length; i++) {
            const next = source[i + 1];
            if (source[i] === '\\' && Object.prototype.hasOwnProperty.call(escapes, next)) {
                result += escapes[next];
                i++;
            } else result += source[i];
        }
        return result;
    }

    function escapeRegExp(string) {
        return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function replaceLiteral(originalText, searchText, replaceText) {
        const original = String(originalText == null ? '' : originalText);
        if (budget) {
            const valid = budget.check(original);
            if (!valid.ok) return { ok: false, reason: valid.reason, resultText: original, matchCount: 0 };
            if (String(searchText || '').length + String(replaceText || '').length > budget.LIMITS.inputChars) {
                return { ok: false, reason: '查找和替换内容过长，请缩小后重试', resultText: original, matchCount: 0 };
            }
        }
        const processedSearchText = processSpecialChars(searchText);
        const processedReplaceText = processSpecialChars(replaceText);
        if (processedSearchText === '') {
            return {
                ok: false,
                reason: 'empty-search',
                resultText: original,
                matchCount: 0,
                processedSearchText: processedSearchText,
                processedReplaceText: processedReplaceText
            };
        }
        const regex = new RegExp(escapeRegExp(processedSearchText), 'g');
        let count = 0;
        while (regex.exec(original)) {
            count++;
            if (budget && original.length + count * Math.max(0, processedReplaceText.length - processedSearchText.length) > budget.LIMITS.outputChars) {
                return { ok: false, reason: '预计结果超过400万字符，请缩短替换内容；原文已保留', resultText: original, matchCount: count };
            }
        }
        regex.lastIndex = 0;
        const resultText = original.replace(regex, function () {
            return processedReplaceText;
        });
        return {
            ok: true,
            resultText: resultText,
            matchCount: count,
            processedSearchText: processedSearchText,
            processedReplaceText: processedReplaceText
        };
    }

    return {
        processSpecialChars: processSpecialChars,
        escapeRegExp: escapeRegExp,
        replaceLiteral: replaceLiteral
    };
});
