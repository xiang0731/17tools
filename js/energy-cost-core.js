(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.EnergyCostCore = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const STORAGE_KEY = '17tools-energy-cost';
    const FIELD_KEYS = [
        'gasConsumption',
        'gasPrice',
        'gasTank',
        'electricConsumption',
        'electricPrice',
        'electricBattery',
        'distanceKm',
        'hybridElectricConsumption',
        'hybridGasConsumption',
        'hybridConversionFactor'
    ];
    const ADVANCED_NUMERIC_KEYS = ['chargeEfficiency', 'homeShare', 'homePrice', 'publicPrice', 'annualMileage', 'gasInsurance', 'gasMaintenance', 'gasOther', 'gasDepreciation', 'electricInsurance', 'electricMaintenance', 'electricOther', 'electricDepreciation'];
    const COST_NAMES = { Insurance: '保险', Maintenance: '保养', Other: '其他固定费用', Depreciation: '折旧' };
    function blankAdvanced() {
        const result = { enabled: false, chargeBasis: 'battery', lossEnabled: false, blendedEnabled: false };
        ADVANCED_NUMERIC_KEYS.forEach(function (key) { result[key] = ''; });
        ['gas', 'electric'].forEach(function (vehicle) {
            Object.keys(COST_NAMES).forEach(function (cost) { result[vehicle + cost + 'Excluded'] = false; });
        });
        return result;
    }
    function normalizeAdvanced(input) {
        const source = input || {};
        const clean = blankAdvanced();
        Object.keys(clean).forEach(function (key) {
            if (typeof clean[key] === 'boolean') clean[key] = source[key] === true;
            else if (key === 'chargeBasis') clean[key] = source[key] === 'meter' ? 'meter' : 'battery';
            else clean[key] = normalizeStoredValue(source[key]);
        });
        return clean;
    }
    function hasAdvancedValues(input) {
        const options = normalizeAdvanced(input);
        return JSON.stringify(options) !== JSON.stringify(blankAdvanced());
    }
    function advancedEqual(left, right) {
        return JSON.stringify(normalizeAdvanced(left)) === JSON.stringify(normalizeAdvanced(right));
    }

    const MESSAGES = Object.freeze({
        empty: '填写百公里能耗和单价后，显示每公里花费',
        invalidRate: '百公里能耗和单价都要大于 0',
        overflow: '数字太大，无法计算',
        invalidDistance: '行驶里程请填写大于或等于 0 的数字',
        distanceOverflow: '里程太大，无法计算行程花费',
        compareWaiting: '两边都填好后，对比每公里谁更省',
        tie: '油车和电车每公里花费相同',
        tripTie: '这次行程花费也相同',
        invalidCapacity: '容量要大于 0',
        needConsumption: '填写大于 0 的百公里能耗后，估算续航',
        rangeTooSmall: '按当前能耗，续航不足 0.1 公里'
    });

    function blankPrefs() {
        return {
            gasConsumption: '',
            gasPrice: '',
            gasTank: '',
            electricConsumption: '',
            electricPrice: '',
            electricBattery: '',
            distanceKm: '',
            hybridElectricConsumption: '',
            hybridGasConsumption: '',
            hybridConversionFactor: ''
        };
    }

    function blankResult(status, message, distanceStatus) {
        return {
            status: status,
            distanceStatus: distanceStatus || 'empty',
            perKm: null,
            per100km: null,
            tripCost: null,
            perKmExact: '',
            tripCostExact: '',
            perKmText: '',
            per100kmText: '',
            tripCostText: '',
            distanceText: '',
            message: message || ''
        };
    }

    function classifyNumber(raw, allowZero) {
        const text = String(raw == null ? '' : raw).trim();
        if (!text) {
            return { status: 'empty' };
        }
        if (!/^\d*\.?\d*$/.test(text) || text === '.') {
            return { status: 'invalid' };
        }
        if (text.endsWith('.')) {
            return { status: 'pending' };
        }
        const value = Number(text);
        if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
            return { status: 'invalid' };
        }
        return { status: 'ok', value: value, text: text };
    }

    function splitDecimal(text) {
        const pieces = String(text).trim().split('.');
        return {
            whole: pieces[0] === '' ? '0' : pieces[0],
            frac: pieces[1] || ''
        };
    }

    function placeDecimal(digits, scale) {
        const clean = String(digits).replace(/^0+(?=\d)/, '') || '0';
        const raw = clean.padStart(scale + 1, '0');
        const point = raw.length - scale;
        const whole = raw.slice(0, point).replace(/^0+(?=\d)/, '') || '0';
        const frac = raw.slice(point).replace(/0+$/, '');
        return frac ? whole + '.' + frac : whole;
    }

    function multiplyDecimalStrings(left, right) {
        const a = splitDecimal(left);
        const b = splitDecimal(right);
        const product = BigInt(a.whole + a.frac) * BigInt(b.whole + b.frac);
        return placeDecimal(product.toString(), a.frac.length + b.frac.length);
    }

    function divideByHundred(decimalString) {
        const parts = splitDecimal(decimalString);
        const digits = (parts.whole + parts.frac).replace(/^0+(?=\d)/, '') || '0';
        return placeDecimal(digits, parts.frac.length + 2);
    }

    function roundDecimalString(decimalString, digits) {
        const parts = splitDecimal(decimalString);
        if (parts.frac.length <= digits) {
            return parts.frac ? parts.whole + '.' + parts.frac : parts.whole;
        }
        const keep = parts.frac.slice(0, digits);
        if (parts.frac.charAt(digits) < '5') {
            const frac = keep.replace(/0+$/, '');
            return frac ? parts.whole + '.' + frac : parts.whole;
        }
        const base = BigInt(parts.whole + keep.padEnd(digits, '0')) + 1n;
        return placeDecimal(base.toString(), digits);
    }

    function formatAmount(decimalString, maxDigits) {
        const rounded = roundDecimalString(decimalString, maxDigits);
        const parts = splitDecimal(rounded);
        const frac = parts.frac.padEnd(2, '0');
        return parts.whole + '.' + frac;
    }

    function scaledAmount(text, digits) {
        const parts = splitDecimal(text);
        return BigInt(parts.whole + parts.frac.padEnd(digits, '0').slice(0, digits));
    }

    function subtractAmounts(left, right, digits) {
        const delta = scaledAmount(left, digits) - scaledAmount(right, digits);
        const abs = delta < 0n ? -delta : delta;
        return formatAmount(placeDecimal(abs.toString(), digits), digits);
    }

    function compareDecimals(left, right) {
        const scale = Math.max(splitDecimal(left).frac.length, splitDecimal(right).frac.length);
        const delta = scaledAmount(left, scale) - scaledAmount(right, scale);
        return delta < 0n ? -1 : delta > 0n ? 1 : 0;
    }

    function exactDifference(left, right) {
        const scale = Math.max(splitDecimal(left).frac.length, splitDecimal(right).frac.length);
        const delta = scaledAmount(left, scale) - scaledAmount(right, scale);
        return placeDecimal((delta < 0n ? -delta : delta).toString(), scale);
    }

    function differenceText(left, right, digits, unit) {
        const exact = exactDifference(left, right);
        const threshold = placeDecimal('1', digits);
        return compareDecimals(exact, threshold) < 0
            ? '差额小于 ' + threshold + ' ' + unit
            : '少花 ' + formatAmount(exact, digits) + ' 元';
    }

    function isTooBig(decimalString) {
        const whole = splitDecimal(decimalString).whole.replace(/^0+/, '');
        return whole.length > 15;
    }

    function divideTruncated(numeratorText, denominatorText, fractionDigits) {
        const n = splitDecimal(numeratorText);
        const d = splitDecimal(denominatorText);
        const den = BigInt(d.whole + d.frac);
        if (den === 0n) {
            return '';
        }
        const shift = fractionDigits + d.frac.length - n.frac.length;
        let scaled = BigInt(n.whole + n.frac);
        if (shift > 0) {
            scaled *= 10n ** BigInt(shift);
        } else if (shift < 0) {
            scaled /= 10n ** BigInt(-shift);
        }
        return placeDecimal((scaled / den).toString(), fractionDigits);
    }

    function formatQuantity(decimalString, maxDigits) {
        const rounded = roundDecimalString(decimalString, maxDigits);
        const parts = splitDecimal(rounded);
        const frac = parts.frac.replace(/0+$/, '');
        return frac ? parts.whole + '.' + frac : parts.whole;
    }

    function blankRange(status, message) {
        return {
            status: status,
            rangeText: '',
            shareText: '',
            multiplesText: '',
            overRange: false,
            message: message || ''
        };
    }

    function calculateRange(input) {
        const source = input || {};
        const consumption = classifyNumber(source.consumptionPer100, false);
        const capacity = classifyNumber(source.capacity, false);
        const distance = classifyNumber(source.distanceKm, true);

        if (capacity.status === 'empty' || capacity.status === 'pending') {
            return blankRange('empty', '');
        }
        if (capacity.status === 'invalid') {
            return blankRange('invalid', MESSAGES.invalidCapacity);
        }
        if (consumption.status === 'invalid') {
            return blankRange('empty', '');
        }
        if (consumption.status !== 'ok') {
            return blankRange('waiting', MESSAGES.needConsumption);
        }

        const raw = divideTruncated(multiplyDecimalStrings(capacity.text, '100'), consumption.text, 6);
        if (!raw || isTooBig(raw)) {
            return blankRange('invalid', MESSAGES.overflow);
        }
        const rangeText = formatQuantity(raw, 1);
        if (compareDecimals(multiplyDecimalStrings(capacity.text, '1000'), consumption.text) < 0) {
            return blankRange('invalid', MESSAGES.rangeTooSmall);
        }

        const result = blankRange('ok', '');
        result.rangeText = rangeText;
        if (distance.status !== 'ok') {
            return result;
        }

        const used = multiplyDecimalStrings(distance.text, consumption.text);
        const available = multiplyDecimalStrings(capacity.text, '100');
        result.overRange = compareDecimals(used, available) > 0;
        const shareRaw = divideTruncated(used, capacity.text, 4);
        const multiplesRaw = divideTruncated(used, available, 4);
        if (!shareRaw || !multiplesRaw || isTooBig(shareRaw) || isTooBig(multiplesRaw)) {
            return result;
        }
        result.shareText = formatQuantity(shareRaw, 1);
        result.multiplesText = formatQuantity(multiplesRaw, 2);
        // Business boundaries use the original exact products above.
        return result;
    }

    function calculateVehicleCost(input) {
        const source = input || {};
        const consumption = classifyNumber(source.consumptionPer100, false);
        const price = classifyNumber(source.unitPrice, false);
        const distance = classifyNumber(source.distanceKm, true);
        const distanceStatus = distance.status;

        if (consumption.status === 'invalid' || price.status === 'invalid') {
            return blankResult('invalid', MESSAGES.invalidRate, distanceStatus);
        }
        if (consumption.status !== 'ok' || price.status !== 'ok') {
            return blankResult('empty', MESSAGES.empty, distanceStatus);
        }

        const per100Exact = multiplyDecimalStrings(consumption.text, price.text);
        const perKmExact = divideByHundred(per100Exact);
        if (isTooBig(per100Exact) || isTooBig(perKmExact)) {
            return blankResult('invalid', MESSAGES.overflow, distanceStatus);
        }

        const result = blankResult('ok', '', distanceStatus);
        result.perKmExact = perKmExact;
        result.perKmText = formatAmount(perKmExact, 4);
        result.per100kmText = formatAmount(per100Exact, 2);
        result.perKm = Number(result.perKmText);
        result.per100km = Number(result.per100kmText);

        if (distance.status !== 'ok') {
            return result;
        }

        const tripExact = divideByHundred(multiplyDecimalStrings(per100Exact, distance.text));
        if (isTooBig(tripExact)) {
            result.distanceStatus = 'overflow';
            return result;
        }
        result.tripCostExact = tripExact;
        result.tripCostText = formatAmount(tripExact, 2);
        result.tripCost = Number(result.tripCostText);
        result.distanceText = formatPlain(distance.text);
        return result;
    }

    function formatPlain(decimalString) {
        const rounded = roundDecimalString(decimalString, 4);
        const parts = splitDecimal(rounded);
        const frac = parts.frac.replace(/0+$/, '');
        return frac ? parts.whole + '.' + frac : parts.whole;
    }

    function describeDistance(status) {
        if (status === 'invalid') {
            return MESSAGES.invalidDistance;
        }
        if (status === 'overflow') {
            return MESSAGES.distanceOverflow;
        }
        return '';
    }

    function compareCosts(gas, electric) {
        if (!gas || gas.status !== 'ok' || !electric || electric.status !== 'ok') {
            return {
                status: 'incomplete',
                winner: '',
                headline: MESSAGES.compareWaiting,
                detail: ''
            };
        }

        const gasPer = gas.perKmExact || gas.perKmText;
        const electricPer = electric.perKmExact || electric.perKmText;
        const order = compareDecimals(gasPer, electricPer);
        const winner = order > 0 ? 'electric' : order < 0 ? 'gas' : 'tie';
        let headline = MESSAGES.tie;
        if (winner !== 'tie') {
            const difference = differenceText(gasPer, electricPer, 4, '元/公里');
            headline = (winner === 'electric' ? '电车' : '油车') + (difference.startsWith('差额') ? '更省，每公里' : '每公里') + difference;
        }
        let detail = '';
        if (gas.tripCostText && electric.tripCostText) {
            const gasTrip = gas.tripCostExact || gas.tripCostText;
            const electricTrip = electric.tripCostExact || electric.tripCostText;
            detail = compareDecimals(gasTrip, electricTrip) === 0 ? MESSAGES.tripTie
                : '这次行程' + differenceText(gasTrip, electricTrip, 2, '元');
        }

        return {
            status: 'ok',
            winner: winner,
            headline: headline,
            detail: detail
        };
    }

    function addDecimalStrings(left, right) {
        const a = splitDecimal(left);
        const b = splitDecimal(right);
        const scale = Math.max(a.frac.length, b.frac.length);
        return placeDecimal((scaledAmount(left, scale) + scaledAmount(right, scale)).toString(), scale);
    }

    function calculateHybridEnergy(input) {
        const source = input || {};
        function number(raw, allowZero) {
            if (String(raw == null ? '' : raw).trim().length > 24) return { status: 'invalid' };
            return classifyNumber(raw, allowZero);
        }
        function equivalent(status, message) {
            return { status: status, message: message || '', electricText: '', gasText: '', electricStatus: status, gasStatus: status, electricMessage: message || '', gasMessage: message || '' };
        }
        function convert(total, electricDivisor, gasDivisor) {
            const electric = divideTruncated(total, electricDivisor, 12);
            const gas = divideTruncated(total, gasDivisor, 12);
            if (isTooBig(electric) || isTooBig(gas)) return equivalent('invalid', MESSAGES.overflow);
            return { status: 'ok', message: '', electricText: formatAmount(electric, 2), gasText: formatAmount(gas, 2), electricStatus: 'ok', gasStatus: 'ok', electricMessage: '', gasMessage: '' };
        }
        const electricity = number(source.hybridElectricConsumption, true);
        const fuel = number(source.hybridGasConsumption, true);
        const distance = number(source.distanceKm, true);
        const result = {
            cost: blankResult('empty', '填写混动百公里电耗和油耗，两项均可为 0', distance.status),
            costEquivalent: equivalent('empty', '填写混动百公里电耗和油耗后换算'),
            energyEquivalent: equivalent('empty', '填写混动百公里电耗和油耗后换算'),
            conversionFactorText: ''
        };
        if (electricity.status !== 'ok' || fuel.status !== 'ok') {
            if (electricity.status === 'invalid' || fuel.status === 'invalid') {
                const message = '混动百公里电耗和油耗请填写大于或等于 0 的数字（最多 24 个字符）';
                result.cost = blankResult('invalid', message, distance.status);
                result.costEquivalent = equivalent('invalid', message);
                result.energyEquivalent = equivalent('invalid', message);
            }
            return result;
        }

        const factorRaw = String(source.hybridConversionFactor == null ? '' : source.hybridConversionFactor).trim();
        const factor = number(factorRaw || '3', false);
        if (factor.status !== 'ok') {
            result.energyEquivalent = equivalent(factor.status === 'pending' ? 'empty' : 'invalid', '油电折算系数请填写大于 0 的数字，留空使用 3');
        } else {
            result.conversionFactorText = formatQuantity(factor.text, 24);
            const totalEnergy = addDecimalStrings(electricity.text, multiplyDecimalStrings(fuel.text, factor.text));
            result.energyEquivalent = convert(totalEnergy, '1', factor.text);
        }

        const electricPrice = number(source.electricPrice, false);
        const gasPrice = number(source.gasPrice, false);
        const requiredPrices = [];
        if (compareDecimals(electricity.text, '0') > 0) requiredPrices.push(electricPrice);
        if (compareDecimals(fuel.text, '0') > 0) requiredPrices.push(gasPrice);
        if (requiredPrices.some(function (price) { return price.status !== 'ok'; })) {
            const invalid = requiredPrices.some(function (price) { return price.status === 'invalid'; });
            const message = invalid ? '非零用量对应的单价必须为大于 0 的合法数字' : '请补充非零用量对应的单价；留空表示未知';
            result.cost = blankResult(invalid ? 'invalid' : 'empty', message, distance.status);
            result.costEquivalent = equivalent(invalid ? 'invalid' : 'empty', message);
            return result;
        }
        const totalCost = addDecimalStrings(
            compareDecimals(electricity.text, '0') === 0 ? '0' : multiplyDecimalStrings(electricity.text, electricPrice.text),
            compareDecimals(fuel.text, '0') === 0 ? '0' : multiplyDecimalStrings(fuel.text, gasPrice.text));
        if (isTooBig(totalCost)) {
            result.cost = blankResult('invalid', MESSAGES.overflow, distance.status);
            result.costEquivalent = equivalent('invalid', MESSAGES.overflow);
            return result;
        }
        result.cost = blankResult('ok', '', distance.status);
        result.cost.per100kmText = formatAmount(totalCost, 2);
        result.cost.perKmText = formatAmount(divideByHundred(totalCost), 4);
        result.cost.per100km = Number(result.cost.per100kmText);
        result.cost.perKm = Number(result.cost.perKmText);
        if (distance.status === 'ok') {
            const trip = divideByHundred(multiplyDecimalStrings(totalCost, distance.text));
            if (isTooBig(trip)) result.cost.distanceStatus = 'overflow';
            else {
                result.cost.tripCostText = formatAmount(trip, 2);
                result.cost.tripCost = Number(result.cost.tripCostText);
                result.cost.distanceText = formatPlain(distance.text);
            }
        }
        const costEquivalent = equivalent('empty', '');
        ['electric', 'gas'].forEach(function (direction) {
            const price = direction === 'electric' ? electricPrice : gasPrice;
            const label = direction === 'electric' ? '电价' : '油价';
            let status = price.status === 'pending' ? 'empty' : price.status;
            let message = status === 'invalid' ? label + '必须大于 0，不能用零价或非法值作除数' : '填写大于 0 的' + label + '后换算';
            if (status === 'ok') {
                const value = divideTruncated(totalCost, price.text, 12);
                if (isTooBig(value)) { status = 'invalid'; message = MESSAGES.overflow; }
                else { costEquivalent[direction + 'Text'] = formatAmount(value, 2); message = ''; }
            }
            costEquivalent[direction + 'Status'] = status;
            costEquivalent[direction + 'Message'] = message;
        });
        const states = [costEquivalent.electricStatus, costEquivalent.gasStatus];
        costEquivalent.status = states.every(function (state) { return state === 'ok'; }) ? 'ok'
            : states.includes('invalid') ? 'invalid' : states.includes('ok') ? 'partial' : 'empty';
        costEquivalent.message = [costEquivalent.electricMessage, costEquivalent.gasMessage].filter(Boolean).join('；');
        result.costEquivalent = costEquivalent;
        return result;
    }

    function calculateAdvancedCosts(input) {
        const source = input || {};
        const options = normalizeAdvanced(source.advanced);
        const result = { enabled: options.enabled, status: options.enabled ? 'incomplete' : 'off', gas: null, electric: null, assumptions: [], errors: [], missing: [], comparison: '' };
        if (!options.enabled) return result;
        const mileage = classifyNumber(options.annualMileage, true);
        if (mileage.status !== 'ok') result.errors.push('年里程请填写大于或等于 0 的数字');
        const gasConsumption = classifyNumber(source.gasConsumption, false);
        const gasPrice = classifyNumber(source.gasPrice, false);
        const electricConsumption = classifyNumber(source.electricConsumption, false);
        let electricPrice = classifyNumber(source.electricPrice, false);
        let priceExact = electricPrice.status === 'ok' ? electricPrice.text : '';
        let consumptionExact = electricConsumption.status === 'ok' ? electricConsumption.text : '';
        result.assumptions.push('周期：一年；年里程 ' + (mileage.status === 'ok' ? mileage.text + ' 公里' : '待填写') + '。');
        if (options.blendedEnabled) {
            const share = classifyNumber(options.homeShare, true);
            const home = classifyNumber(options.homePrice, true);
            const outside = classifyNumber(options.publicPrice, true);
            priceExact = '';
            if (share.status !== 'ok' || share.value > 100) result.errors.push('家充比例请填写 0–100%');
            else if ((share.value > 0 && home.status !== 'ok') || (share.value < 100 && outside.status !== 'ok')) result.errors.push('请填写实际使用的家充/公共充电单价，允许 0 元');
            else {
                const shareScale = splitDecimal(share.text).frac.length;
                const publicShare = placeDecimal((100n * 10n ** BigInt(shareScale) - scaledAmount(share.text, shareScale)).toString(), shareScale);
                const weightedHome = share.value > 0 ? multiplyDecimalStrings(home.text, share.text) : '0';
                const weightedPublic = share.value < 100 ? multiplyDecimalStrings(outside.text, publicShare) : '0';
                priceExact = divideByHundred(addDecimalStrings(weightedHome, weightedPublic));
                result.assumptions.push('电价：家充 ' + share.text + '%，公共充电 ' + publicShare + '%；加权电价 ' + formatQuantity(priceExact, 6) + ' 元/度。');
            }
        } else result.assumptions.push('电价：沿用简易模式单价，不混合不同充电场景。');
        if (options.chargeBasis === 'battery' && options.lossEnabled) {
            const efficiency = classifyNumber(options.chargeEfficiency, false);
            if (efficiency.status !== 'ok' || efficiency.value > 100 || efficiency.value < 1) { consumptionExact = ''; result.errors.push('充电效率请填写 1–100%'); }
            else if (consumptionExact) {
                consumptionExact = divideTruncated(multiplyDecimalStrings(consumptionExact, '100'), efficiency.text, 12);
                result.assumptions.push('电耗为电池侧；电表购电量 = 电池用电量 ÷ ' + efficiency.text + '%，只计算一次损耗。');
            }
        } else result.assumptions.push(options.chargeBasis === 'meter' ? '电耗为电表侧，已包含充电损耗，不再重复除以效率。' : '电耗为电池侧；关闭损耗，按 100% 效率估算。');
        function vehicle(prefix, consumption, price) {
            const label = prefix === 'gas' ? '油车' : '电车';
            const data = { status: 'incomplete', lines: [], missing: [], energyText: '', knownTotalText: '', totalText: '', complete: false };
            let subtotal = '0';
            if (mileage.status === 'ok' && consumption && price) {
                const exact = divideByHundred(multiplyDecimalStrings(multiplyDecimalStrings(consumption, price), mileage.text));
                if (isTooBig(exact)) result.errors.push(label + '年度能源费用超过支持范围');
                else { data.energyText = formatAmount(exact, 2); subtotal = roundDecimalString(exact, 2); data.lines.push({ label: '年度能源费用', value: data.energyText + ' 元' }); }
            }
            if (!data.energyText) data.missing.push(label + '年里程/能耗/单价');
            Object.keys(COST_NAMES).forEach(function (cost) {
                const key = prefix + cost;
                if (options[key + 'Excluded']) { data.lines.push({ label: COST_NAMES[cost], value: '不计此项（已排除）' }); return; }
                const amount = classifyNumber(options[key], true);
                if (amount.status !== 'ok') { data.missing.push(label + COST_NAMES[cost]); data.lines.push({ label: COST_NAMES[cost], value: '待填写，未假定为 0' }); return; }
                if (splitDecimal(amount.text).frac.length > 2) { result.errors.push(label + COST_NAMES[cost] + '最多填写两位小数'); return; }
                if (isTooBig(amount.text)) { result.errors.push(label + COST_NAMES[cost] + '超过支持范围'); return; }
                subtotal = addDecimalStrings(subtotal, amount.text);
                data.lines.push({ label: COST_NAMES[cost], value: formatAmount(amount.text, 2) + ' 元/年' });
            });
            if (isTooBig(subtotal)) result.errors.push(label + '年度合计超过支持范围');
            else data.knownTotalText = formatAmount(subtotal, 2);
            data.complete = data.missing.length === 0 && !!data.energyText && !!data.knownTotalText;
            data.status = data.complete ? 'ok' : 'incomplete';
            if (data.complete) data.totalText = data.knownTotalText;
            result.missing.push.apply(result.missing, data.missing);
            return data;
        }
        result.gas = vehicle('gas', gasConsumption.status === 'ok' ? gasConsumption.text : '', gasPrice.status === 'ok' ? gasPrice.text : '');
        result.electric = vehicle('electric', consumptionExact, priceExact);
        result.assumptions.push('各费用分项四舍五入到分后加总；固定费用最多两位小数；效率除法保留 12 位小数；只统计用户填写或明确排除的项目，不自动推算回本年限。');
        if (result.errors.length) result.status = 'invalid';
        else if (result.gas.complete && result.electric.complete) {
            result.status = 'ok';
            const gas = scaledAmount(result.gas.totalText, 2);
            const electric = scaledAmount(result.electric.totalText, 2);
            result.comparison = gas === electric ? '所选项目年度费用相同' : (gas > electric ? '电车' : '油车') + '所选项目每年少花 ' + subtractAmounts(result.gas.totalText, result.electric.totalText, 2) + ' 元';
        }
        return result;
    }

    function normalizeStoredValue(value) {
        const text = String(value == null ? '' : value).trim();
        if (!text || text.length > 24) {
            return '';
        }
        if (!/^\d*\.?\d*$/.test(text) || text === '.') {
            return '';
        }
        return text;
    }

    function hasStoredValues(prefs) {
        const source = prefs || {};
        return FIELD_KEYS.some(function (key) {
            return normalizeStoredValue(source[key]) !== '';
        });
    }

    function preferencesEqual(left, right) {
        const a = left || {};
        const b = right || {};
        return FIELD_KEYS.every(function (key) {
            return normalizeStoredValue(a[key]) === normalizeStoredValue(b[key]);
        });
    }

    function readStorageState(storage) {
        const prefs = blankPrefs();
        if (!storage || typeof storage.getItem !== 'function') {
            return { exists: false, optIn: false, prefs: prefs, advanced: blankAdvanced() };
        }
        let raw;
        try {
            raw = storage.getItem(STORAGE_KEY);
        } catch (error) {
            return { exists: false, optIn: false, prefs: blankPrefs(), advanced: blankAdvanced() };
        }
        if (!raw) {
            return { exists: false, optIn: false, prefs: prefs, advanced: blankAdvanced() };
        }
        try {
            const data = JSON.parse(raw);
            if (!data || typeof data !== 'object') {
                return { exists: true, optIn: false, prefs: blankPrefs(), advanced: blankAdvanced() };
            }
            FIELD_KEYS.forEach(function (key) {
                prefs[key] = normalizeStoredValue(data[key]);
            });
            return {
                exists: true,
                optIn: data.optIn === true,
                prefs: prefs,
                advanced: normalizeAdvanced(data.advanced)
            };
        } catch (error) {
            return { exists: true, optIn: false, prefs: blankPrefs(), advanced: blankAdvanced() };
        }
    }

    function readPreferences(storage) {
        return readStorageState(storage).prefs;
    }

    function writePreferences(storage, prefs, remember, advanced) {
        if (!storage || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
            return false;
        }
        const clean = blankPrefs();
        let hasValue = false;
        const source = prefs || {};
        FIELD_KEYS.forEach(function (key) {
            clean[key] = normalizeStoredValue(source[key]);
            if (clean[key]) {
                hasValue = true;
            }
        });
        const cleanAdvanced = normalizeAdvanced(advanced);
        if (hasAdvancedValues(cleanAdvanced)) {
            clean.advanced = cleanAdvanced;
            hasValue = true;
        }
        try {
            if (!hasValue) {
                storage.removeItem(STORAGE_KEY);
            } else {
                if (remember === true) {
                    clean.optIn = true;
                }
                storage.setItem(STORAGE_KEY, JSON.stringify(clean));
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    function clearPreferences(storage) {
        if (!storage || typeof storage.removeItem !== 'function') {
            return false;
        }
        try {
            storage.removeItem(STORAGE_KEY);
            return true;
        } catch (error) {
            return false;
        }
    }

    return {
        hasAdvancedValues: hasAdvancedValues,
        blankAdvanced: blankAdvanced,
        normalizeAdvanced: normalizeAdvanced,
        advancedEqual: advancedEqual,
        calculateAdvancedCosts: calculateAdvancedCosts,
        calculateHybridEnergy: calculateHybridEnergy,
        STORAGE_KEY: STORAGE_KEY,
        FIELD_KEYS: FIELD_KEYS,
        MESSAGES: MESSAGES,
        classifyNumber: classifyNumber,
        formatAmount: formatAmount,
        calculateVehicleCost: calculateVehicleCost,
        calculateRange: calculateRange,
        describeDistance: describeDistance,
        compareCosts: compareCosts,
        readPreferences: readPreferences,
        readStorageState: readStorageState,
        writePreferences: writePreferences,
        clearPreferences: clearPreferences,
        hasStoredValues: hasStoredValues,
        preferencesEqual: preferencesEqual
    };
});
