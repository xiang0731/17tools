(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.ChinaHolidayData = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';
    function span(start, end) {
        const list = [], from = Date.parse(start + 'T00:00:00Z'), to = Date.parse(end + 'T00:00:00Z');
        for (let day = from; day <= to; day += 86400000) list.push(new Date(day).toISOString().slice(0, 10));
        return list;
    }
    return Object.freeze({
        2025: Object.freeze({
            title: '国务院办公厅关于2025年部分节假日安排的通知',
            source: 'https://www.gov.cn/zhengce/content/202411/content_6986382.htm',
            published: '2024-11-12', verified: '2026-10-04',
            rest: Object.freeze(['2025-01-01', ...span('2025-01-28', '2025-02-04'), ...span('2025-04-04', '2025-04-06'), ...span('2025-05-01', '2025-05-05'), ...span('2025-05-31', '2025-06-02'), ...span('2025-10-01', '2025-10-08')]),
            work: Object.freeze(['2025-01-26', '2025-02-08', '2025-04-27', '2025-09-28', '2025-10-11'])
        }),
        2026: Object.freeze({
            title: '国务院办公厅关于2026年部分节假日安排的通知',
            source: 'https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm',
            published: '2025-11-04', verified: '2026-10-04',
            rest: Object.freeze([...span('2026-01-01', '2026-01-03'), ...span('2026-02-15', '2026-02-23'), ...span('2026-04-04', '2026-04-06'), ...span('2026-05-01', '2026-05-05'), ...span('2026-06-19', '2026-06-21'), ...span('2026-09-25', '2026-09-27'), ...span('2026-10-01', '2026-10-07')]),
            work: Object.freeze(['2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10'])
        })
    });
});
