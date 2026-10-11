(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.DateCalculatorCore = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';
    const MIN_YEAR = 1900, MAX_YEAR = 2100;
    const UNIT_LIMITS = Object.freeze({ days: 73413, weeks: 10488, months: 2411, years: 200, 'calendar-months': 2447, hours: 1761936, minutes: 105716160 });
    function parseInteger(raw, options) {
        const text = String(raw == null ? '' : raw).trim();
        if (!text && options && options.emptyZero) return { ok: true, value: 0 };
        if (!text) return { ok: false, message: '请输入数量。' };
        if (!/^[+-]?\d+$/.test(text)) return { ok: false, message: '请输入完整整数，不能使用小数、指数或文字。' };
        const value = Number(text);
        if (!Number.isSafeInteger(value)) return { ok: false, message: '数量过大，请缩小偏移量。' };
        const limit = options && options.limit;
        if (limit != null && Math.abs(value) > limit) return { ok: false, message: '偏移量超出 1900–2100 年支持范围。' };
        return { ok: true, value };
    }
    function validDate(date) { return date instanceof Date && Number.isFinite(date.getTime()) && date.getFullYear() >= MIN_YEAR && date.getFullYear() <= MAX_YEAR; }
    function offsetCalendar(base, amount, unit) {
        if (!validDate(base) || !Number.isSafeInteger(amount) || !Object.hasOwn(UNIT_LIMITS, unit) || ['hours', 'minutes'].includes(unit) || Math.abs(amount) > UNIT_LIMITS[unit]) return { ok: false, message: '参数不合法或超出 1900–2100 年支持范围。' };
        const date = new Date(base);
        if (unit === 'months' || unit === 'years') {
            const day = date.getDate(); date.setDate(1);
            if (unit === 'months') date.setMonth(date.getMonth() + amount); else date.setFullYear(date.getFullYear() + amount);
            date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
        } else date.setDate(date.getDate() + amount * (unit === 'weeks' ? 7 : unit === 'calendar-months' ? 30 : 1));
        return validDate(date) ? { ok: true, date } : { ok: false, message: '结果超出 1900-01-01 至 2100-12-31，请缩小偏移量。' };
    }
    function offsetElapsed(base, hours, minutes) {
        if (!validDate(base) || !Number.isSafeInteger(hours) || !Number.isSafeInteger(minutes) || Math.abs(hours) > UNIT_LIMITS.hours || Math.abs(minutes) > UNIT_LIMITS.minutes) return { ok: false, message: '时间偏移不合法或超出支持范围。' };
        const elapsedMinutes = hours * 60 + minutes;
        const date = new Date(base.getTime() + elapsedMinutes * 60000);
        return validDate(date) ? { ok: true, date, elapsedMinutes } : { ok: false, message: '结果超出 1900-01-01 至 2100-12-31，请缩小时间偏移。' };
    }
    return { MIN_YEAR, MAX_YEAR, UNIT_LIMITS, parseInteger, validDate, offsetCalendar, offsetElapsed };
});
