(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./text-budget-core.js'));
    } else {
        root.CalculatorCore = factory(root.TextBudgetCore);
    }
})(typeof window !== 'undefined' ? window : globalThis, function (TextBudgetCore) {
    'use strict';

    class ExpressionParser {
        constructor(expr) {
            this.expr = expr.replace(/x/gi, '*');
            this.index = 0;
        }

        checked(value) {
            if (!Number.isFinite(value)) throw new Error('数值超出有限数范围');
            return value;
        }

        parse() {
            const value = this.parseExpression();
            this.skipWhitespace();
            if (!this.isAtEnd()) {
                throw new Error('算式不完整');
            }
            return value;
        }

        parseExpression() {
            let value = this.parseTerm();
            while (true) {
                this.skipWhitespace();
                if (this.match('+')) {
                    value = this.checked(value + this.parseTerm());
                } else if (this.match('-')) {
                    value = this.checked(value - this.parseTerm());
                } else {
                    return value;
                }
            }
        }

        parseTerm() {
            let value = this.parseSignedPower();
            while (true) {
                this.skipWhitespace();
                if (this.match('*')) {
                    if (this.peek() === '*') {
                        this.index--;
                        return value;
                    }
                    const multiplier = this.parseSignedPower();
                    const product = this.checked(value * multiplier);
                    if (product === 0 && value !== 0 && multiplier !== 0) throw new Error('数值太小，超出可表示精度');
                    value = product;
                } else if (this.match('/')) {
                    const divisor = this.parseSignedPower();
                    if (divisor === 0) {
                        throw new Error('除数不能为0');
                    }
                    const quotient = this.checked(value / divisor);
                    if (quotient === 0 && value !== 0) throw new Error('数值太小，超出可表示精度');
                    value = quotient;
                } else {
                    return value;
                }
            }
        }

        // 一元正负号弱于幂：-2**2 = -(2**2)。指数可以再带正负号，幂右结合。
        parseSignedPower() {
            this.skipWhitespace();
            if (this.match('+')) return this.parseSignedPower();
            if (this.match('-')) return -this.parseSignedPower();
            return this.parsePower();
        }

        parsePower() {
            let value = this.parsePrimary();
            this.skipWhitespace();
            if (this.match('**')) {
                const result = this.checked(value ** this.parseSignedPower());
                if (result === 0 && value !== 0) throw new Error('数值太小，超出可表示精度');
                value = result;
            }
            return value;
        }

        parsePrimary() {
            this.skipWhitespace();

            if (this.match('(')) {
                const value = this.parseExpression();
                this.skipWhitespace();
                if (!this.match(')')) {
                    throw new Error('括号未闭合');
                }
                return value;
            }

            return this.parseNumber();
        }

        parseNumber() {
            this.skipWhitespace();
            const start = this.index;
            let hasDigit = false;
            let hasDot = false;

            while (!this.isAtEnd()) {
                const char = this.peek();
                if (char >= '0' && char <= '9') {
                    hasDigit = true;
                    this.index++;
                } else if (char === '.' && !hasDot) {
                    hasDot = true;
                    this.index++;
                } else {
                    break;
                }
            }

            if (!hasDigit) {
                throw new Error('算式不完整');
            }

            const literal = this.expr.slice(start, this.index);
            const value = this.checked(Number(literal));
            if (value === 0 && /[1-9]/.test(literal)) throw new Error('数值太小，超出可表示精度');
            return value;
        }

        match(token) {
            if (this.expr.slice(this.index, this.index + token.length) === token) {
                this.index += token.length;
                return true;
            }
            return false;
        }

        peek() {
            return this.expr[this.index] || '';
        }

        isAtEnd() {
            return this.index >= this.expr.length;
        }

        skipWhitespace() {
            while (/\s/.test(this.peek())) {
                this.index++;
            }
        }
    }

    const DISPLAY_DIGITS = 15;
    const PRECISION_NOTE = '采用双精度浮点计算，显示最多 15 位有效数字；≈ 表示显示值经过舍入，超安全整数不保证逐位精确。';

    function formatNumber(value) {
        if (!Number.isFinite(value)) return null;
        if (Object.is(value, -0)) return '0';
        const parts = value.toPrecision(DISPLAY_DIGITS).split('e');
        const mantissa = parts[0].includes('.') ? parts[0].replace(/0+$/, '').replace(/\.$/, '') : parts[0];
        return parts.length > 1 ? mantissa + 'e' + parts[1] : mantissa;
    }

    function splitLines(input) {
        return String(input == null ? '' : input)
            .split(/\r\n|\n|\r/)
            .map(function (line) {
                return line.trim();
            })
            .filter(function (line) {
                return line !== '';
            });
    }

    function evaluateExpression(expr) {
        const trimmed = String(expr == null ? '' : expr).trim();
        if (!trimmed) {
            return { value: 0, error: null };
        }

        try {
            if (/[^0-9+\-*/xX().\s]/.test(trimmed)) {
                return { value: 0, error: '非法字符' };
            }

            const result = new ExpressionParser(trimmed).parse();

            if (!Number.isFinite(result)) {
                return { value: 0, error: '非法计算' };
            }

            return { value: result, error: null };
        } catch (e) {
            let errorMsg = /call stack/i.test(e.message || '') ? '算式嵌套太深，请拆成多行计算' : e.message || '算式不完整';

            const openCount = (trimmed.match(/\(/g) || []).length;
            const closeCount = (trimmed.match(/\)/g) || []).length;
            if (openCount !== closeCount) {
                errorMsg = '括号未闭合';
            } else if (/[+\-*/xX]$/.test(trimmed)) {
                errorMsg = '运算符结尾';
            }

            return { value: 0, error: errorMsg };
        }
    }

    function calculate(input) {
        const budget = TextBudgetCore.check(input, 0);
        if (!budget.ok) return { lines: [], total: null, totalText: '', totalError: budget.reason, budgetError: budget.reason,
            approximate: false, precisionWarning: false, precisionNote: PRECISION_NOTE,
            errors: [budget.reason], empty: false, validCount: 0, errorCount: 0, complete: false, copyable: false };
        const expressions = splitLines(input);
        const seen = Object.create(null);
        const errors = [];
        let total = 0;
        let totalError = null;
        let validCount = 0;
        let errorCount = 0;
        let precisionWarning = false;
        const lines = expressions.map(function (expression) {
            const evaluated = evaluateExpression(expression);
            if (evaluated.error) {
                errorCount += 1;
                if (!seen[evaluated.error]) { seen[evaluated.error] = true; errors.push(evaluated.error); }
            } else {
                validCount += 1;
                const nextTotal = total + evaluated.value;
                if (!Number.isFinite(nextTotal)) totalError = '合计超出有限数范围，请拆分计算或缩小数值';
                if (!totalError) total = nextTotal;
                if (Math.abs(evaluated.value) > Number.MAX_SAFE_INTEGER || /\d{16,}/.test(expression)) precisionWarning = true;
            }
            const display = evaluated.error ? null : formatNumber(evaluated.value);
            const approximate = display != null && Number(display) !== evaluated.value;
            return { expression: expression, value: evaluated.error ? null : evaluated.value,
                error: evaluated.error, approximate: approximate,
                text: evaluated.error || ((approximate ? '≈ ' : '') + display) };
        });
        if (totalError) errors.push(totalError);
        const totalText = totalError ? '' : formatNumber(total);
        const approximate = !totalError && Number(totalText) !== total;
        return {
            lines: lines, total: totalError ? null : total,
            totalText: totalText, totalError: totalError, approximate: approximate,
            precisionWarning: precisionWarning, precisionNote: PRECISION_NOTE,
            errors: errors, empty: expressions.length === 0,
            validCount: validCount, errorCount: errorCount,
            complete: !totalError && errorCount === 0 && expressions.length > 0,
            copyable: !totalError && errorCount === 0 && expressions.length > 0
        };
    }

    function canSaveToHistory(input) {
        return calculate(input).complete;
    }

    return {
        DISPLAY_DIGITS: DISPLAY_DIGITS,
        PRECISION_NOTE: PRECISION_NOTE,
        splitLines: splitLines,
        evaluateExpression: evaluateExpression,
        calculate: calculate,
        formatNumber: formatNumber,
        canSaveToHistory: canSaveToHistory
    };
});
