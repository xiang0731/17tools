(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./china-holidays.js'));
    else root.WorkdayCore = factory(root.ChinaHolidayData || {});
})(typeof window !== 'undefined' ? window : globalThis, function (official) {
    'use strict';
    const MS = 86400000, MIN = Date.UTC(1900, 0, 1) / MS, MAX = Date.UTC(2100, 11, 31) / MS, MAX_STEPS = MAX - MIN + 1;
    function parseDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
        if (!match) return null;
        const [year, month, day] = match.slice(1).map(Number), date = new Date(Date.UTC(year, month - 1, day));
        const n = date.getTime() / MS;
        return Number.isInteger(n) && n >= MIN && n <= MAX && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? n : null;
    }
    const key = day => new Date(day * MS).toISOString().slice(0, 10);
    function parseDates(raw) {
        const tokens = String(raw || '').split(/[\s,，;；]+/).filter(Boolean), days = new Set(), errors = [];
        for (const token of tokens) { const day = parseDate(token); if (day == null) errors.push(token); else days.add(day); }
        return { ok: !errors.length, days, errors };
    }
    function rules(input) {
        const source = input || {}, weekend = source.weekend == null ? [0, 6] : source.weekend;
        if (!Array.isArray(weekend) || weekend.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(weekend).size === 7) return { ok: false, message: '周末规则至少要保留一个可能工作日。' };
        const rest = parseDates(source.rest), work = parseDates(source.work);
        if (!rest.ok || !work.ok) return { ok: false, field: !rest.ok ? 'rest' : 'work', message: `例外日期无效：${[...rest.errors, ...work.errors].join('、')}；请使用 YYYY-MM-DD（1900–2100）。` };
        for (const day of rest.days) if (work.days.has(day)) return { ok: false, field: 'work', message: `${key(day)} 同时设为休息和补班，请保留一种规则。` };
        const data = source.official === false ? {} : official;
        const officialRest = new Set(), officialWork = new Set();
        Object.values(data).forEach(record => { record.rest.forEach(date => officialRest.add(parseDate(date))); record.work.forEach(date => officialWork.add(parseDate(date))); });
        return { ok: true, weekend: new Set(weekend), rest: rest.days, work: work.days, official: data, officialRest, officialWork };
    }
    function classify(day, config) {
        const year = new Date(day * MS).getUTCFullYear();
        if (config.work.has(day)) return { work: true, reason: '自定义补班', known: Boolean(config.official[year]), year };
        if (config.rest.has(day)) return { work: false, reason: '自定义休息', known: Boolean(config.official[year]), year };
        if (config.officialWork.has(day)) return { work: true, reason: '法定安排补班', known: true, year };
        if (config.officialRest.has(day)) return { work: false, reason: '法定安排休息', known: true, year };
        return { work: !config.weekend.has(new Date(day * MS).getUTCDay()), reason: config.weekend.has(new Date(day * MS).getUTCDay()) ? '周末休息' : '通常工作日', known: Boolean(config.official[year]), year };
    }
    function coverage(years, config) {
        const list = [...years].sort((a, b) => a - b);
        return { years: list, missingYears: list.filter(year => !config.official[year]), sources: list.filter(year => config.official[year]).map(year => ({ year, ...config.official[year] })) };
    }
    function offset(start, amount, input) {
        let day = parseDate(start);
        const config = rules(input);
        if (!config.ok) return config;
        if (day == null || !Number.isSafeInteger(amount) || Math.abs(amount) > MAX_STEPS) return { ok: false, message: '起始日期或数量不合法；数量应是整数且在支持范围内。' };
        const years = new Set([new Date(day * MS).getUTCFullYear()]);
        const direction = amount < 0 ? -1 : 1; let remaining = Math.abs(amount), steps = 0;
        if (remaining && input && input.includeStart && classify(day, config).work) remaining--;
        while (remaining) {
            day += direction; steps++;
            if (day < MIN || day > MAX || steps > MAX_STEPS) return { ok: false, message: '工作日结果超出 1900–2100 年范围，请减少数量。' };
            const status = classify(day, config); years.add(status.year); if (status.work) remaining--;
        }
        return { ok: true, date: key(day), amount, ...coverage(years, config) };
    }
    function count(start, end, input) {
        const a = parseDate(start), b = parseDate(end), config = rules(input);
        if (!config.ok) return config;
        if (a == null || b == null) return { ok: false, message: '请输入1900–2100范围内的完整起止日期。' };
        const direction = a <= b ? 1 : -1, years = new Set(); let total = 0, calendarDays = 0;
        for (let day = a; direction > 0 ? day <= b : day >= b; day += direction) {
            const status = classify(day, config); years.add(status.year);
            if ((day === a && input && input.includeStart === false) || (day === b && input && input.includeEnd === false)) continue;
            calendarDays++; if (status.work) total++;
        }
        return { ok: true, count: total * direction, absoluteCount: total, calendarDays, start, end, ...coverage(years, config) };
    }
    function status(date, input) { const day = parseDate(date), config = rules(input); return day == null || !config.ok ? null : classify(day, config); }
    return { MIN, MAX, MAX_STEPS, parseDate, key, parseDates, rules, classify, offset, count, status, official };
});
