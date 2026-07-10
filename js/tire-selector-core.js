(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TireSelectorCore = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const WIDTH_OPTIONS = [185, 195, 205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305];
    const ASPECT_RATIO_OPTIONS = [30, 35, 40, 45, 50, 55, 60, 65, 70];
    const RIM_DIAMETER_OPTIONS = [15, 16, 17, 18, 19, 20, 21, 22, 23];

    const PRACTICAL_SIZE_MATRIX = {
        185: { 55: [15, 16], 60: [15, 16], 65: [15], 70: [15] },
        195: { 50: [16, 17], 55: [15, 16], 60: [15, 16], 65: [15] },
        205: { 45: [17, 18], 50: [16, 17], 55: [16, 17], 60: [16], 65: [15, 16] },
        215: { 40: [18, 19], 45: [17, 18, 19], 50: [17, 18], 55: [16, 17, 18], 60: [16, 17], 65: [16] },
        225: { 35: [19, 20], 40: [18, 19, 20], 45: [17, 18, 19], 50: [17, 18], 55: [16, 17, 18], 60: [16, 17] },
        235: { 35: [19, 20], 40: [18, 19, 20], 45: [18, 19], 50: [18, 19], 55: [17, 18, 19], 60: [17, 18] },
        245: { 30: [20, 21], 35: [19, 20, 21], 40: [18, 19, 20], 45: [18, 19, 20], 50: [18, 19], 55: [17, 18, 19] },
        255: { 30: [20, 21, 22], 35: [19, 20, 21], 40: [18, 19, 20, 21], 45: [18, 19, 20], 50: [18, 19, 20], 55: [18, 19] },
        265: { 30: [21, 22], 35: [20, 21, 22], 40: [20, 21, 22], 45: [19, 20, 21, 22], 50: [19, 20, 21] },
        275: { 30: [21, 22, 23], 35: [20, 21, 22, 23], 40: [20, 21, 22], 45: [19, 20, 21, 22], 50: [19, 20] },
        285: { 30: [21, 22, 23], 35: [20, 21, 22, 23], 40: [20, 21, 22], 45: [20, 21] },
        295: { 30: [21, 22, 23], 35: [20, 21, 22, 23], 40: [20, 21, 22], 45: [20, 21] },
        305: { 30: [20, 21, 22, 23], 35: [20, 21, 22, 23], 40: [20, 21, 22] }
    };

    const PURCHASE_RANGES = [
        {
            title: '静音舒适',
            icon: 'fa-volume-low',
            width: [205, 245],
            aspectRatio: [50, 65],
            rimDiameter: [16, 19],
            advice: '更适合日常城市通勤和家用舒适取向，优先看静音、滤震和湿地制动。'
        },
        {
            title: '均衡通勤',
            icon: 'fa-road',
            width: [215, 255],
            aspectRatio: [45, 60],
            rimDiameter: [17, 20],
            advice: '兼顾舒适、耐磨和操控，是多数家用车、SUV 的稳妥购买方向。'
        },
        {
            title: '长途耐磨',
            icon: 'fa-route',
            width: [215, 255],
            aspectRatio: [50, 65],
            rimDiameter: [16, 20],
            advice: '适合高速和长距离使用，重点关注耐磨指数、滚阻、胎噪和高速稳定性。'
        },
        {
            title: '运动操控',
            icon: 'fa-gauge-high',
            width: [245, 285],
            aspectRatio: [30, 45],
            rimDiameter: [18, 22],
            advice: '更偏抓地和转向响应，通常会牺牲一部分舒适性、胎噪和使用成本。'
        },
        {
            title: '湿地安全',
            icon: 'fa-cloud-rain',
            width: [215, 265],
            aspectRatio: [45, 60],
            rimDiameter: [17, 21],
            advice: '优先看湿地制动等级、排水花纹和胎纹深度，雨季不要把胎纹磨到极限。'
        }
    ];

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function round(value, digits = 1) {
        const factor = 10 ** digits;
        return Math.round(value * factor) / factor;
    }

    function normalizeNumber(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : fallback;
    }

    function getClosestOption(value, options) {
        const number = normalizeNumber(value, options[0]);
        return options.reduce((closest, option) => {
            const currentDistance = Math.abs(option - number);
            const closestDistance = Math.abs(closest - number);
            return currentDistance < closestDistance ? option : closest;
        }, options[0]);
    }

    function getAspectRatiosForWidth(width) {
        const rule = PRACTICAL_SIZE_MATRIX[width] || PRACTICAL_SIZE_MATRIX[getClosestOption(width, WIDTH_OPTIONS)];
        return Object.keys(rule).map(Number).sort((a, b) => a - b);
    }

    function getRimDiametersForSize(width, aspectRatio) {
        const safeWidth = getClosestOption(width, WIDTH_OPTIONS);
        const aspectRatios = getAspectRatiosForWidth(safeWidth);
        const safeAspectRatio = getClosestOption(aspectRatio, aspectRatios);
        return [...PRACTICAL_SIZE_MATRIX[safeWidth][safeAspectRatio]];
    }

    function normalizeTireSelection(input = {}) {
        const width = getClosestOption(input.width, WIDTH_OPTIONS);
        const aspectRatios = getAspectRatiosForWidth(width);
        const aspectRatio = getClosestOption(input.aspectRatio, aspectRatios);
        const rimDiameters = getRimDiametersForSize(width, aspectRatio);
        const rimDiameter = getClosestOption(input.rimDiameter, rimDiameters);

        return {
            width,
            aspectRatio,
            rimDiameter
        };
    }

    function getConstrainedOptions(input = {}) {
        const normalized = normalizeTireSelection(input);
        const aspectRatios = getAspectRatiosForWidth(normalized.width);
        const rimDiameters = getRimDiametersForSize(normalized.width, normalized.aspectRatio);

        return {
            widths: [...WIDTH_OPTIONS],
            aspectRatios,
            rimDiameters,
            normalized,
            summary: `当前胎宽 ${normalized.width}mm 常见搭配：扁平比 ${aspectRatios[0]}-${aspectRatios[aspectRatios.length - 1]}，轮毂 R${rimDiameters[0]}-R${rimDiameters[rimDiameters.length - 1]}。`
        };
    }

    function categorizeWidth(width) {
        if (width >= 285) return '很宽';
        if (width >= 255) return '偏宽';
        if (width >= 215) return '常见';
        return '偏窄';
    }

    function categorizeAspectRatio(aspectRatio) {
        if (aspectRatio <= 45) return '低扁平比';
        if (aspectRatio <= 55) return '均衡扁平比';
        return '高扁平比';
    }

    function categorizeRimDiameter(rimDiameter) {
        if (rimDiameter >= 21) return '大轮毂';
        if (rimDiameter >= 18) return '常见轮毂';
        return '小轮毂';
    }

    function calculateTireMetrics(input) {
        const { width, aspectRatio, rimDiameter } = normalizeTireSelection(input);
        const sidewallHeight = width * aspectRatio / 100;
        const rimDiameterMm = rimDiameter * 25.4;
        const overallDiameter = rimDiameterMm + sidewallHeight * 2;
        const circumference = overallDiameter * Math.PI;

        return {
            width,
            aspectRatio,
            rimDiameter,
            spec: `${width}/${aspectRatio} R${rimDiameter}`,
            sidewallHeightMm: round(sidewallHeight),
            rimDiameterMm: round(rimDiameterMm),
            overallDiameterMm: round(overallDiameter),
            circumferenceMm: Math.round(circumference),
            widthCategory: categorizeWidth(width),
            aspectCategory: categorizeAspectRatio(aspectRatio),
            rimCategory: categorizeRimDiameter(rimDiameter)
        };
    }

    function isInRange(value, range) {
        return value >= range[0] && value <= range[1];
    }

    function getRangeScore(metrics, range) {
        return [
            isInRange(metrics.width, range.width),
            isInRange(metrics.aspectRatio, range.aspectRatio),
            isInRange(metrics.rimDiameter, range.rimDiameter)
        ].filter(Boolean).length;
    }

    function getStatus(score) {
        if (score >= 3) return '适合';
        if (score === 2) return '可关注';
        return '谨慎';
    }

    function getStatusTone(status) {
        if (status === '适合') return 'good';
        if (status === '可关注') return 'neutral';
        return 'warn';
    }

    function formatRangeText(range) {
        return `胎宽 ${range.width[0]}-${range.width[1]}mm，扁平比 ${range.aspectRatio[0]}-${range.aspectRatio[1]}，轮毂 R${range.rimDiameter[0]}-R${range.rimDiameter[1]}`;
    }

    function getPurchaseReferences(metrics) {
        return PURCHASE_RANGES.map(range => {
            const score = getRangeScore(metrics, range);
            const status = getStatus(score);

            return {
                title: range.title,
                icon: range.icon,
                status,
                tone: getStatusTone(status),
                rangeText: formatRangeText(range),
                advice: range.advice
            };
        });
    }

    function getVisualModel(metrics) {
        const outerSize = clamp(228 + (metrics.overallDiameterMm - 690) * 0.18, 218, 286);
        const rimSize = outerSize * metrics.rimDiameterMm / metrics.overallDiameterMm;
        const sidewallSize = (outerSize - Math.round(rimSize)) / 2;
        const sectionWidth = clamp(outerSize * metrics.width / metrics.overallDiameterMm, 64, outerSize * 0.58);
        const contactWidth = clamp(54 + (metrics.width - 185) * 0.18, 54, 78);

        return {
            outerSize: Math.round(outerSize),
            rimSize: Math.round(rimSize),
            sidewallSize: Math.round(sidewallSize),
            sectionWidth: Math.round(sectionWidth),
            contactWidth: Math.round(contactWidth),
            treadScale: 1
        };
    }

    return {
        WIDTH_OPTIONS,
        ASPECT_RATIO_OPTIONS,
        RIM_DIAMETER_OPTIONS,
        getConstrainedOptions,
        normalizeTireSelection,
        calculateTireMetrics,
        getPurchaseReferences,
        getVisualModel
    };
});
