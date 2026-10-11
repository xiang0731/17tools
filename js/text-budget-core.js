(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.TextBudgetCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var LIMITS = Object.freeze({ inputChars: 1000000, lines: 50000, outputChars: 4000000 });
    function check(text, outputChars, maxLines) {
        var value = String(text == null ? '' : text);
        if (value.length > LIMITS.inputChars) return { ok: false, reason: '超过100万字符，请缩小文本后重试；原文已保留' };
        var lines = 1;
        var newline = /\r\n|\r|\n/g;
        while (newline.exec(value)) {
            lines++;
            if (lines > (maxLines || LIMITS.lines)) return { ok: false, reason: '超过' + ((maxLines || LIMITS.lines) === 50000 ? '5万' : (maxLines || LIMITS.lines)) + '行，请分批处理；原文已保留' };
        }
        if (outputChars > LIMITS.outputChars || !Number.isFinite(Number(outputChars || 0))) {
            return { ok: false, reason: '预计结果超过400万字符，请减少输入或缩短附加内容；原文已保留' };
        }
        return { ok: true, lines: lines };
    }
    function assert(text, outputChars, maxLines) {
        var result = check(text, outputChars, maxLines);
        if (!result.ok) throw new Error(result.reason);
        return result;
    }
    return { LIMITS: LIMITS, check: check, assert: assert };
}));
