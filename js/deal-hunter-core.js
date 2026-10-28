(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DealHunterCore = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const MESSAGES = Object.freeze({
        invalidNumber: '请输入有效的数字格式',
        missingPrice: '缺少有效价格',
        tooManyFields: '多了字段，每行只接受总价和数量',
        comparedComplete: '已完整比较',
        needHeader: '首行请输入: 总原价 总实付',
        originalMustBePositive: '总原价必须大于 0',
        negativeTotals: '总原价和实付不能为负数',
        unitMustBePositive: '数量必须大于 0',
        priceMustBeNonNegative: '价格不能为负数',
        itemMustBeNonNegative: '单件原价不能为负数',
        itemsExceedTotal: '单品总和已超总额',
        paidExceedsOriginal: '实付价格大于原价',
        bestDeal: '最划算!',
        incomparable: '无法比价'
    });

    const BUDGET = Object.freeze({ inputChars: 200000, inputLines: 10001, results: 10000, autoChars: 12000, autoResults: 200, pageSize: 50 });

    function inspectInput(text, mode) {
        const source = String(text == null ? '' : text);
        if (source.length > BUDGET.inputChars) return { ok: false, error: '输入超限：最多 ' + BUDGET.inputChars + ' 字符；原文已保留' };
        const lines = source.split(/\r\n|\n|\r/);
        if (lines.length > BUDGET.inputLines) return { ok: false, error: '输入超限：最多 ' + BUDGET.inputLines + ' 物理行；原文已保留' };
        const nonEmpty = lines.reduce(function (count, line) { return count + (line.trim() ? 1 : 0); }, 0);
        const count = Math.max(0, nonEmpty - (mode === 'B' ? 1 : 0));
        if (count > BUDGET.results) return { ok: false, error: '结果超限：最多 ' + BUDGET.results + ' 行；原文已保留' };
        return { ok: true, lineCount: lines.length, resultCount: count, empty: nonEmpty === 0,
            requiresManual: source.length > BUDGET.autoChars || count > BUDGET.autoResults };
    }

    function budgetError(mode, check) {
        return Object.assign(emptyResult(mode), { empty: false, error: check.error, budgetExceeded: true });
    }

    function parseNumber(token) {
        if (token == null || token === '') {
            return NaN;
        }
        const text = String(token).trim();
        if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text)) {
            return NaN;
        }
        const value = Number(text);
        return Number.isFinite(value) ? value : NaN;
    }

    function splitNonEmptyLines(text) {
        return String(text || '')
            .replace(/^\uFEFF/, '')
            .split(/\n/)
            .map(function (line) {
                return line.trim();
            })
            .filter(function (line) {
                return line.length > 0;
            });
    }

    function toCents(value) {
        return Math.round(Number(value) * 100);
    }

    function fromCents(cents) {
        return cents / 100;
    }

    function roundMoney(value) {
        return fromCents(toCents(value));
    }

    function formatMoney(value) {
        return roundMoney(value).toFixed(2);
    }

    function formatPlainNumber(value) {
        if (!Number.isFinite(value)) {
            return '';
        }
        if (Number.isInteger(value)) {
            return String(value);
        }
        return String(value);
    }

    function rankLabel(rank) {
        return '第 ' + rank + ' 名';
    }

    function comparisonSummary(validCount, invalidCount) {
        if (invalidCount === 0) {
            return MESSAGES.comparedComplete;
        }
        return '已比较 ' + validCount + ' 行、' + invalidCount + ' 行需修正';
    }

    function emptyResult(mode) {
        return {
            mode: mode,
            empty: true,
            error: null,
            copyable: false,
            products: [],
            items: [],
            warnings: []
        };
    }

    function parseComparisonLine(raw, lineNumber) {
        const parts = raw.split(/\s+/);
        const product = {
            lineNumber: lineNumber,
            raw: raw,
            price: NaN,
            unit: NaN,
            unitPrice: null,
            valid: false,
            error: null,
            rank: null,
            rankLabel: MESSAGES.incomparable,
            isWinner: false
        };

        if (parts.length > 2) {
            product.error = MESSAGES.tooManyFields;
            return product;
        }

        const price = parseNumber(parts[0]);
        if (!Number.isFinite(price)) {
            if (parts.length >= 2) {
                const unit = parseNumber(parts[1]);
                product.unit = Number.isFinite(unit) ? unit : NaN;
            }
            product.error = MESSAGES.missingPrice;
            return product;
        }

        const hasUnit = parts.length >= 2;
        const unit = hasUnit ? parseNumber(parts[1]) : 1;
        product.price = price;
        product.unit = Number.isFinite(unit) ? unit : NaN;

        if (!Number.isFinite(product.unit)) {
            product.error = MESSAGES.invalidNumber;
        } else if (price < 0) {
            product.error = MESSAGES.priceMustBeNonNegative;
        } else if (product.unit <= 0) {
            product.error = MESSAGES.unitMustBePositive;
        } else if (!Number.isFinite(price / product.unit)) {
            product.error = '单价超出有限数范围，请缩小价格或增大数量';
        } else {
            product.valid = true;
            product.unitPrice = price / product.unit;
            product.error = null;
        }

        return product;
    }

    function compareUnitPrices(text) {
        const check = inspectInput(text, 'A');
        if (!check.ok) return budgetError('A', check);
        const rawText = String(text || '').replace(/^\uFEFF/, '');
        if (rawText.trim() === '') {
            return emptyResult('A');
        }

        const products = [];
        rawText.split(/\r\n|\n|\r/).forEach(function (line, index) {
            const raw = line.trim();
            if (raw.length === 0) {
                return;
            }
            products.push(parseComparisonLine(raw, index + 1));
        });

        if (products.length === 0) {
            return emptyResult('A');
        }

        const validProducts = products.filter(function (product) {
            return product.valid;
        });
        const sorted = validProducts.slice().sort(function (a, b) {
            if (a.unitPrice === b.unitPrice) {
                return 0;
            }
            return a.unitPrice < b.unitPrice ? -1 : 1;
        });

        const firstRankByPrice = new Map();
        sorted.forEach(function (product, index) {
            if (!firstRankByPrice.has(product.unitPrice)) firstRankByPrice.set(product.unitPrice, index + 1);
        });
        validProducts.forEach(function (product) {
            product.rank = firstRankByPrice.get(product.unitPrice);
            product.rankLabel = rankLabel(product.rank);
        });

        const minPrice = sorted.length > 0 ? sorted[0].unitPrice : null;
        const canPickWinner = validProducts.length > 1 && minPrice != null;
        if (canPickWinner) {
            validProducts.forEach(function (product) {
                if (product.unitPrice === minPrice) {
                    product.isWinner = true;
                    product.rankLabel = MESSAGES.bestDeal;
                }
            });
        }

        const invalidCount = products.length - validProducts.length;
        return {
            mode: 'A',
            empty: false,
            error: null,
            copyable: true,
            summary: comparisonSummary(validProducts.length, invalidCount),
            products: products,
            items: [],
            warnings: []
        };
    }

    // 金额先按十进制转换为整数分，乘除使用 BigInt，避免浮点舍入与乘法溢出。
    function parseMoney(token) {
        const text = String(token == null ? '' : token).trim();
        if (!/^[+]?(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) {
            return { error: text.startsWith('-') ? MESSAGES.itemMustBeNonNegative : '金额只接受非负数字，最多两位小数（最小 0.01 元）' };
        }
        if (text.length > 32) return { error: '金额格式过长，请缩短为最多 32 个字符' };
        const parts = text.replace(/^\+/, '').split('.');
        const cents = BigInt(parts[0] || '0') * 100n + BigInt((parts[1] || '').padEnd(2, '0'));
        if (cents > 99999999999999n) return { error: '金额超过支持上限 999999999999.99 元' };
        return { cents: cents, value: Number(cents) / 100 };
    }

    // 最大余数法：先向下分配，再按余数降序补分；相同余数保留原行顺序。
    function allocatePaidAmounts(originalCents, totalOriginal, totalPaid) {
        const listed = originalCents.reduce(function (sum, cents) { return sum + cents; }, 0n);
        const numerator = listed * totalPaid;
        const target = (numerator + totalOriginal / 2n) / totalOriginal;
        const shares = originalCents.map(function (cents, index) {
            const product = cents * totalPaid;
            return { index: index, cents: product / totalOriginal, remainder: product % totalOriginal };
        });
        let remaining = target - shares.reduce(function (sum, share) { return sum + share.cents; }, 0n);
        shares.slice().sort(function (a, b) {
            return a.remainder === b.remainder ? a.index - b.index : (a.remainder > b.remainder ? -1 : 1);
        }).forEach(function (share) {
            if (remaining > 0n) { share.cents += 1n; remaining -= 1n; }
        });
        return { amounts: shares.map(function (share) { return Number(share.cents) / 100; }), target: Number(target) / 100 };
    }

    function allocateDiscount(text) {
        const check = inspectInput(text, 'B');
        if (!check.ok) return budgetError('B', check);
        const raw = String(text || '').replace(/^\uFEFF/, '');
        if (!raw.trim()) return emptyResult('B');
        const lines = raw.split(/\r\n|\n|\r/).map(function (line, index) {
            return { raw: line.trim(), lineNumber: index + 1 };
        }).filter(function (line) { return line.raw.length > 0; });
        const header = lines[0];
        const headerParts = header.raw.split(/\s+/);
        const original = parseMoney(headerParts[0]);
        const paid = parseMoney(headerParts[1]);
        const items = lines.slice(1).map(function (line) {
            const parts = line.raw.split(/\s+/);
            const money = parseMoney(parts[0]);
            const error = parts.length !== 1 ? '商品行只接受一列原价，请删除多余字段' : money.error;
            return { lineNumber: line.lineNumber, raw: line.raw, original: money.value == null ? null : money.value,
                originalCents: money.cents, paid: null, valid: !error, error: error || null };
        });
        let error = null;
        if (headerParts.length !== 2) error = '首行只能填写两列：总原价 总实付';
        else if (headerParts.some(function (part) { return part.startsWith('-'); })) error = MESSAGES.negativeTotals;
        else if (original.error || paid.error) error = '首行：' + (original.error || paid.error);
        else if (original.cents === 0n) error = MESSAGES.originalMustBePositive;
        else if (paid.cents > original.cents) error = '实付价格大于原价；当前折扣分摊不支持加价或退款';
        const validItems = items.filter(function (item) { return item.valid; });
        const listed = validItems.reduce(function (sum, item) { return sum + item.originalCents; }, 0n);
        if (!error && listed > original.cents) error = '单品总和已超总额，请修正清单后分摊';
        const invalidCount = items.length - validItems.length;
        const partial = !error && listed < original.cents;
        let summary = '有效 ' + validItems.length + ' 行、待修正 ' + invalidCount + ' 行';
        if (invalidCount) summary += '；未完整计算，错误行未参与';
        else if (partial) summary += '；部分清单，未列商品保留折扣额度';
        else if (!error) summary += '；已完整分摊';
        let allocated = { amounts: [], target: null };
        if (!error) allocated = allocatePaidAmounts(validItems.map(function (item) { return item.originalCents; }), original.cents, paid.cents);
        validItems.forEach(function (item, index) { item.paid = error ? null : allocated.amounts[index]; });
        // 核心返回 JSON 可序列化结果，不暴露内部 BigInt。
        items.forEach(function (item) { delete item.originalCents; });
        const discount = error ? null : Number(paid.cents) / Number(original.cents);
        return {
            mode: 'B', empty: false, error: error, copyable: !error, products: [], items: items,
            warnings: partial ? ['仅分摊已列商品；商品实付合计按比例四舍五入到分'] : [],
            header: { raw: header.raw, lineNumber: header.lineNumber, valid: !error, error: error },
            validCount: validItems.length, invalidCount: invalidCount, summary: summary,
            complete: !error && !invalidCount && !partial, partial: partial,
            totalOriginal: original.value, totalPaid: paid.value, discount: discount,
            discountPercent: discount == null ? '' : (discount * 100).toFixed(1) + '%',
            discountZhe: discount == null ? '' : (discount * 10).toFixed(2),
            itemOriginalSum: Number(listed) / 100, paidSum: allocated.target
        };
    }

    function formatCopyText(result) {
        if (!result || result.empty || !result.copyable) {
            return '';
        }

        if (result.mode === 'A') {
            const validCount = result.products.filter(function (product) {
                return product.valid;
            }).length;
            const summary = result.summary || comparisonSummary(validCount, result.products.length - validCount);
            const rows = [summary, '行号\t原文\t总价\t数量\t单价\t备注'];
            result.products.forEach(function (product) {
                const priceText = formatPlainNumber(product.price);
                const unitText = Number.isFinite(product.unit) ? formatPlainNumber(product.unit) : '';
                const rawText = String(product.raw == null ? '' : product.raw).replace(/[\t\r\n]/g, ' ');
                if (!product.valid) {
                    rows.push([
                        product.lineNumber,
                        rawText,
                        priceText,
                        unitText,
                        '',
                        product.error || MESSAGES.incomparable
                    ].join('\t'));
                    return;
                }
                rows.push([
                    product.lineNumber,
                    rawText,
                    priceText,
                    unitText,
                    product.unitPrice.toFixed(2),
                    product.rankLabel
                ].join('\t'));
            });
            return rows.join('\n');
        }

        if (result.mode === 'B') {
            const rows = [
                result.summary,
                ['总原价', formatMoney(result.totalOriginal)].join('\t'),
                ['实付', formatMoney(result.totalPaid)].join('\t'),
                ['折扣', result.discountPercent, result.discountZhe + ' 折'].join('\t')
            ];
            result.warnings.forEach(function (warning) {
                rows.push(['警告', warning].join('\t'));
            });
            if (result.items.length > 0) {
                rows.push(['行号', '原文', '原价', '实付', '备注'].join('\t'));
                result.items.forEach(function (item) {
                    if (!item.valid) {
                        rows.push([item.lineNumber, item.raw, '', '', item.error || ''].join('\t'));
                        return;
                    }
                    rows.push([item.lineNumber, item.raw, formatMoney(item.original), formatMoney(item.paid), ''].join('\t'));
                });
            }
            return rows.join('\n');
        }

        return '';
    }

    return {
        MESSAGES: MESSAGES,
        BUDGET: BUDGET,
        inspectInput: inspectInput,
        parseNumber: parseNumber,
        parseMoney: parseMoney,
        roundMoney: roundMoney,
        formatMoney: formatMoney,
        compareUnitPrices: compareUnitPrices,
        allocateDiscount: allocateDiscount,
        formatCopyText: formatCopyText
    };
});
