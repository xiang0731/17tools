(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.LunarCore = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    var MS_PER_DAY = 86400000;
    var MIN_YEAR = 1900;
    var MAX_YEAR = 2100;
    var MIN_SOLAR = { year: 1900, month: 1, day: 31 };
    var MAX_SOLAR = { year: 2100, month: 12, day: 31 };

    // 农历编码（1900–2100，共 201 项）。低 4 位为闰月月份（0 表示无闰月），
    // bit4–bit15 为十二月大小（1=30 日），bit16 为闰月大小。
    // 1954/1956/1978/2033 按香港天文台《公历与农历日期对照表》校正。
    var LUNAR_INFO = [
        0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
        0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
        0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
        0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
        0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
        0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
        0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
        0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
        0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
        0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
        0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
        0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
        0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
        0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
        0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
        0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
        0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
        0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
        0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
        0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
        0x0d520                                                                                     // 2100
    ];

    var MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    var DAY_NAMES = [
        '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
        '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
        '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
    ];
    var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    var ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

    var SOLAR_TERM_NAMES = [
        '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
        '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
        '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
        '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
    ];
    var SOLAR_TERM_INFO = [
        0, 21208, 42467, 63836, 85337, 107014,
        128867, 150921, 173149, 195551, 218072, 240693,
        263343, 285989, 308563, 331033, 353350, 375494,
        397447, 419210, 440795, 462224, 483532, 504758
    ];
    var SOLAR_TERM_BASE_MS = Date.UTC(1900, 0, 6, 2, 5);
    var SHANGHAI_FORMATTER = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    });

    function isInteger(value) {
        return typeof value === 'number' && Number.isInteger(value);
    }

    function yearData(year) {
        if (!isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
            return null;
        }
        return LUNAR_INFO[year - MIN_YEAR];
    }

    function leapMonth(year) {
        var data = yearData(year);
        return data == null ? 0 : data & 0xf;
    }

    function leapDays(year) {
        if (!leapMonth(year)) {
            return 0;
        }
        return (yearData(year) & 0x10000) ? 30 : 29;
    }

    function monthDays(year, month) {
        var data = yearData(year);
        if (data == null || !isInteger(month) || month < 1 || month > 12) {
            return 0;
        }
        return (data & (0x10000 >> month)) ? 30 : 29;
    }

    function yearDays(year) {
        var data = yearData(year);
        if (data == null) {
            return 0;
        }
        var sum = 348;
        for (var bit = 0x8000; bit > 0x8; bit >>= 1) {
            sum += (data & bit) ? 1 : 0;
        }
        return sum + leapDays(year);
    }

    function solarDayNumber(year, month, day) {
        return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
    }

    function ymdFromDayNumber(dayNumber) {
        var date = new Date(dayNumber * MS_PER_DAY);
        return {
            year: date.getUTCFullYear(),
            month: date.getUTCMonth() + 1,
            day: date.getUTCDate()
        };
    }

    function isValidSolarDate(year, month, day) {
        if (!isInteger(year) || !isInteger(month) || !isInteger(day)) {
            return false;
        }
        if (month < 1 || month > 12 || day < 1 || day > 31) {
            return false;
        }
        var date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year &&
            date.getUTCMonth() + 1 === month &&
            date.getUTCDate() === day;
    }

    function compareYmd(left, right) {
        if (left.year !== right.year) {
            return left.year - right.year;
        }
        if (left.month !== right.month) {
            return left.month - right.month;
        }
        return left.day - right.day;
    }

    function isValidLunarDate(year, month, day, isLeap) {
        if (!isInteger(year) || !isInteger(month) || !isInteger(day)) {
            return false;
        }
        if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12 || day < 1) {
            return false;
        }
        var leap = !!isLeap;
        if (leap && leapMonth(year) !== month) {
            return false;
        }
        var maxDay = leap ? leapDays(year) : monthDays(year, month);
        return day <= maxDay;
    }

    function solarToLunar(year, month, day) {
        if (!isValidSolarDate(year, month, day)) {
            return null;
        }
        if (compareYmd({ year: year, month: month, day: day }, MIN_SOLAR) < 0 ||
            compareYmd({ year: year, month: month, day: day }, MAX_SOLAR) > 0) {
            return null;
        }

        var offset = solarDayNumber(year, month, day) - solarDayNumber(MIN_SOLAR.year, MIN_SOLAR.month, MIN_SOLAR.day);
        var lunarYear = MIN_YEAR;
        while (lunarYear <= MAX_YEAR) {
            var days = yearDays(lunarYear);
            if (offset < days) {
                break;
            }
            offset -= days;
            lunarYear += 1;
        }
        if (lunarYear > MAX_YEAR) {
            return null;
        }

        var leap = leapMonth(lunarYear);
        var lunarMonth = 1;
        var isLeap = false;
        while (lunarMonth <= 12) {
            var thisMonthDays = isLeap ? leapDays(lunarYear) : monthDays(lunarYear, lunarMonth);
            if (offset < thisMonthDays) {
                return {
                    year: lunarYear,
                    month: lunarMonth,
                    day: offset + 1,
                    isLeap: isLeap
                };
            }
            offset -= thisMonthDays;
            if (isLeap) {
                isLeap = false;
                lunarMonth += 1;
            } else if (leap > 0 && lunarMonth === leap) {
                isLeap = true;
            } else {
                lunarMonth += 1;
            }
        }
        return null;
    }

    function lunarToSolar(year, month, day, isLeap) {
        var leap = !!isLeap;
        if (!isValidLunarDate(year, month, day, leap)) {
            return null;
        }

        var offset = 0;
        var y;
        for (y = MIN_YEAR; y < year; y++) {
            offset += yearDays(y);
        }

        var leapM = leapMonth(year);
        var m;
        for (m = 1; m < month; m++) {
            offset += monthDays(year, m);
            if (leapM === m) {
                offset += leapDays(year);
            }
        }
        if (leap) {
            offset += monthDays(year, month);
        }
        offset += day - 1;

        return ymdFromDayNumber(
            solarDayNumber(MIN_SOLAR.year, MIN_SOLAR.month, MIN_SOLAR.day) + offset
        );
    }

    function formatLunar(lunar) {
        if (!lunar || !lunar.month || !lunar.day) {
            return '';
        }
        var monthLabel = (lunar.isLeap ? '闰' : '') + MONTH_NAMES[lunar.month - 1];
        return lunar.year + '年' + monthLabel + DAY_NAMES[lunar.day - 1];
    }

    function getZodiac(year) {
        if (!isInteger(year)) {
            return '';
        }
        var index = (year - 4) % 12;
        if (index < 0) {
            index += 12;
        }
        return ZODIACS[index];
    }

    function getGanZhi(year) {
        if (!isInteger(year)) {
            return '';
        }
        var ganIndex = (year - 4) % 10;
        var zhiIndex = (year - 4) % 12;
        if (ganIndex < 0) {
            ganIndex += 10;
        }
        if (zhiIndex < 0) {
            zhiIndex += 12;
        }
        return GAN[ganIndex] + ZHI[zhiIndex];
    }

    function shanghaiYmd(date) {
        var parts = SHANGHAI_FORMATTER.formatToParts(date);
        var values = {};
        var i;
        for (i = 0; i < parts.length; i++) {
            if (parts[i].type !== 'literal') {
                values[parts[i].type] = Number(parts[i].value);
            }
        }
        return {
            year: values.year,
            month: values.month,
            day: values.day
        };
    }

    function getSolarTermInstant(year, index) {
        if (!isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
            return null;
        }
        if (!isInteger(index) || index < 0 || index > 23) {
            return null;
        }
        return new Date(
            SOLAR_TERM_BASE_MS +
            31556925974.7 * (year - MIN_YEAR) +
            SOLAR_TERM_INFO[index] * 60000
        );
    }

    function getSolarTermYmd(year, index) {
        var instant = getSolarTermInstant(year, index);
        return instant ? shanghaiYmd(instant) : null;
    }

    function getSolarTerm(year, month, day) {
        if (!isValidSolarDate(year, month, day) || year < MIN_YEAR || year > MAX_YEAR) {
            return null;
        }
        var firstIndex = (month - 1) * 2;
        var indices = [firstIndex, firstIndex + 1];
        var i;
        for (i = 0; i < indices.length; i++) {
            var index = indices[i];
            if (index < 0 || index > 23) {
                continue;
            }
            var ymd = getSolarTermYmd(year, index);
            if (ymd && ymd.year === year && ymd.month === month && ymd.day === day) {
                return SOLAR_TERM_NAMES[index];
            }
        }
        return null;
    }

    return {
        LUNAR_INFO: LUNAR_INFO,
        MIN_YEAR: MIN_YEAR,
        MAX_YEAR: MAX_YEAR,
        MIN_SOLAR: MIN_SOLAR,
        MAX_SOLAR: MAX_SOLAR,
        MONTH_NAMES: MONTH_NAMES,
        DAY_NAMES: DAY_NAMES,
        SOLAR_TERM_NAMES: SOLAR_TERM_NAMES,
        SOLAR_TERM_INFO: SOLAR_TERM_INFO,
        yearData: yearData,
        yearDays: yearDays,
        leapMonth: leapMonth,
        leapDays: leapDays,
        monthDays: monthDays,
        solarToLunar: solarToLunar,
        lunarToSolar: lunarToSolar,
        formatLunar: formatLunar,
        getZodiac: getZodiac,
        getGanZhi: getGanZhi,
        shanghaiYmd: shanghaiYmd,
        getSolarTermInstant: getSolarTermInstant,
        getSolarTermYmd: getSolarTermYmd,
        getSolarTerm: getSolarTerm
    };
});
