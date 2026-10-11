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

    function describeSelectionAdjustment(input = {}) {
        const requested = { width: Number(input.width), aspectRatio: Number(input.aspectRatio), rimDiameter: Number(input.rimDiameter) };
        const normalized = normalizeTireSelection(input);
        const names = { width: '胎宽', aspectRatio: '扁平比', rimDiameter: '轮毂直径' };
        const units = { width: 'mm', aspectRatio: '%', rimDiameter: '英寸' };
        const changes = Object.keys(names).filter(key => requested[key] !== normalized[key]).map(key => ({
            field: key, name: names[key], from: requested[key], to: normalized[key],
            reason: key === 'width' ? '所选胎宽不在页面常见矩阵内，取最近胎宽' : key === 'aspectRatio' ? '该胎宽的常见矩阵没有原扁平比，取最近选项' : '该胎宽与扁平比的常见矩阵没有原轮毂直径，取最近选项',
            text: `${names[key]}由 ${requested[key]}${units[key]} 调整为 ${normalized[key]}${units[key]}`
        }));
        return { requested, normalized, changes, requestedSpec: `${requested.width}/${requested.aspectRatio} R${requested.rimDiameter}`, normalizedSpec: `${normalized.width}/${normalized.aspectRatio} R${normalized.rimDiameter}` };
    }

    function parseDimension(raw, min, max, name) {
        const text = String(raw == null ? '' : raw).trim();
        if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) return { error: name + '请填写有效数字，最多两位小数' };
        const value = Number(text);
        if (!Number.isFinite(value) || value < min || value > max) return { error: name + `范围为 ${min}–${max}` };
        return { value };
    }

    function calculateArbitraryMetrics(input = {}) {
        const width = parseDimension(input.width, 50, 500, '胎宽(mm)');
        const aspect = parseDimension(input.aspectRatio, 10, 100, '扁平比(%)');
        const rim = parseDimension(input.rimDiameter, 5, 30, '轮毂(英寸)');
        const error = width.error || aspect.error || rim.error;
        if (error) return { status: 'invalid', error };
        const sidewallHeight = width.value * aspect.value / 100;
        const rimDiameterMm = rim.value * 25.4;
        const overallDiameter = rimDiameterMm + 2 * sidewallHeight;
        const circumference = overallDiameter * Math.PI;
        const row = PRACTICAL_SIZE_MATRIX[width.value];
        const inMatrix = !!(row && row[aspect.value] && row[aspect.value].includes(rim.value));
        return { status: 'ok', error: '', width: width.value, aspectRatio: aspect.value, rimDiameter: rim.value,
            spec: `${width.value}/${aspect.value} R${rim.value}`, sidewallHeightMm: sidewallHeight,
            rimDiameterMm, overallDiameterMm: overallDiameter, circumferenceMm: circumference, inMatrix };
    }

    function compareTireSizes(originalInput, candidateInput, indicatedSpeed = '100') {
        const original = calculateArbitraryMetrics(originalInput);
        const candidate = calculateArbitraryMetrics(candidateInput);
        const speed = parseDimension(indicatedSpeed, 0, 500, '表显车速(km/h)');
        if (original.status !== 'ok' || candidate.status !== 'ok' || speed.error) {
            return { status: 'invalid', error: original.error ? '原厂规格：' + original.error : candidate.error ? '候选规格：' + candidate.error : speed.error };
        }
        const ratio = candidate.circumferenceMm / original.circumferenceMm;
        return { status: 'ok', error: '', original, candidate,
            diameterDeltaMm: candidate.overallDiameterMm - original.overallDiameterMm,
            circumferenceDeltaMm: candidate.circumferenceMm - original.circumferenceMm,
            deltaPercent: (ratio - 1) * 100, ratio,
            indicatedSpeed: speed.value, theoreticalSpeed: speed.value * ratio,
            speedDelta: speed.value * (ratio - 1) };
    }

    function buildComparisonCopy(result) {
        if (!result || result.status !== 'ok') return '';
        const notes = getResultAssumptions();
        const matrix = metrics => metrics.inMatrix ? '页面常见矩阵内，仍需核对车辆' : '矩阵外：仅理论计算，不是推荐搭配';
        return [
            '原厂/候选轮胎尺寸理论对比',
            '原厂：' + result.original.spec + '；' + matrix(result.original),
            '候选：' + result.candidate.spec + '；' + matrix(result.candidate),
            '外径：' + result.original.overallDiameterMm.toFixed(1) + ' → ' + result.candidate.overallDiameterMm.toFixed(1) + ' mm；差值 ' + result.diameterDeltaMm.toFixed(1) + ' mm',
            '周长：' + result.original.circumferenceMm.toFixed(1) + ' → ' + result.candidate.circumferenceMm.toFixed(1) + ' mm；差值 ' + result.circumferenceDeltaMm.toFixed(1) + ' mm',
            '尺寸变化：' + result.deltaPercent.toFixed(2) + '%（未提前舍入原值计算）',
            '以原厂周长标定，相同轮转速下：理论真实车速 = 表显车速 × 候选周长 ÷ 原厂周长',
            '表显 ' + result.indicatedSpeed + ' km/h → 理论真实 ' + result.theoreticalSpeed.toFixed(2) + ' km/h',
            ...notes.formulaLines, '矩阵：' + notes.matrixNote,
            '实际车速还受胎压、载荷、磨耗、形变和仪表校准影响；尺寸比较不保证车辆适配或合规。',
            '请另核对载荷指数、速度等级、轮圈宽度、ET、车身间隙、制动系统及当地要求。'
        ].join('\n');
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

    // 胎宽、扁平比、轮毂和购买区间都是仓库内固定表，文件里没有外部标准更新日期。
    const RESULT_ASSUMPTIONS = {
        formulaLines: [
            '胎侧毫米 = 胎宽 × 扁平比 / 100',
            '轮毂毫米 = 英寸 × 25.4',
            '外径 = 轮毂毫米 + 2 × 胎侧',
            '周长 = 外径 × π'
        ],
        rounding: '外径、胎壁高度和轮毂直径保留一位小数，周长四舍五入到整数。',
        units: '尺寸单位为毫米，轮毂直径选项为英寸。',
        matrixNote: '仓库内常见量产组合，无外部认证日期',
        manualCheck: '建议核对车辆手册，本结果不保证能安装'
    };

    function getResultAssumptions() {
        return {
            formulaLines: RESULT_ASSUMPTIONS.formulaLines.slice(),
            rounding: RESULT_ASSUMPTIONS.rounding,
            units: RESULT_ASSUMPTIONS.units,
            matrixNote: RESULT_ASSUMPTIONS.matrixNote,
            manualCheck: RESULT_ASSUMPTIONS.manualCheck
        };
    }

    function buildResultCopy(input) {
        const metrics = calculateTireMetrics(input);
        const references = getPurchaseReferences(metrics);
        const assumptions = getResultAssumptions();
        const lines = [
            '参数',
            `规格：${metrics.spec}`,
            `胎宽：${metrics.width} 毫米`,
            `扁平比：${metrics.aspectRatio}`,
            `轮毂：${metrics.rimDiameter} 英寸`,
            '',
            '假设',
            ...assumptions.formulaLines,
            assumptions.rounding,
            assumptions.units,
            `矩阵是${assumptions.matrixNote}。`,
            assumptions.manualCheck,
            '',
            '结果',
            `外径：${metrics.overallDiameterMm} 毫米`,
            `胎壁高度：${metrics.sidewallHeightMm} 毫米`,
            `轮毂直径：${metrics.rimDiameterMm} 毫米`,
            `滚动周长：${metrics.circumferenceMm} 毫米`,
            ...references.map(item => `${item.title}：${item.status}；${item.rangeText}`)
        ];

        return {
            metrics,
            references,
            assumptions,
            text: lines.join('\n')
        };
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
        describeSelectionAdjustment,
        calculateArbitraryMetrics,
        compareTireSizes,
        buildComparisonCopy,
        WIDTH_OPTIONS,
        ASPECT_RATIO_OPTIONS,
        RIM_DIAMETER_OPTIONS,
        getConstrainedOptions,
        normalizeTireSelection,
        calculateTireMetrics,
        getPurchaseReferences,
        getResultAssumptions,
        buildResultCopy,
        getVisualModel
    };
});
