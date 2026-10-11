(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.RegexToolCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function buildRegexToolCore() {
    'use strict';

    const VALID_FLAGS = ['g', 'i', 'm', 's', 'u', 'y', 'd', 'v'];
    const DEFAULT_FLAGS = 'g';
    const DEFAULT_BUDGETS = Object.freeze({
        maxInputChars: 20000,
        maxMatchCount: 400,
        maxDisplayCount: 80,
        maxReplaceChars: 100000
    });
    const MESSAGES = Object.freeze({
        emptyPattern: '请输入正则表达式后再测试匹配',
        syntaxPrefix: '表达式语法错误：',
        timeout: '匹配超时，已中止本次计算。可以继续输入，或改用更简单的表达式。',
        tooHard: '太难了，已经停下来。可以继续改，或换更简单的表达式。',
        cancelled: '已取消上一次计算',
        unavailable: '当前环境无法启动可中断的正则计算，已停止自动匹配以免卡死页面。请通过本地 HTTP 打开本工具。',
        truncatedInput: '测试文本过长，仅处理前 {n} 个字符',
        truncatedMatches: '匹配条数超过上限，仅保留前 {n} 条',
        truncatedDisplay: '列表仅展示前 {n} 条匹配',
        truncatedReplace: '替换结果过长，已截断到 {n} 个字符',
        running: '正在匹配…',
        success: '已完成匹配',
        noMatch: '当前没有匹配结果'
    });

    function formatMsg(template, n) {
        return String(template).replace('{n}', String(n));
    }

    function normalizeBudgets(input) {
        const src = input && typeof input === 'object' ? input : {};
        const pick = function (key) {
            const value = Number(src[key]);
            if (Number.isFinite(value) && value > 0) {
                return Math.floor(value);
            }
            return DEFAULT_BUDGETS[key];
        };
        return {
            maxInputChars: pick('maxInputChars'),
            maxMatchCount: pick('maxMatchCount'),
            maxDisplayCount: pick('maxDisplayCount'),
            maxReplaceChars: pick('maxReplaceChars')
        };
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function findLiteralClosingSlash(value) {
        let escaped = false;
        let inClass = false;

        for (let i = value.length - 1; i > 0; i -= 1) {
            const char = value[i];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === '\\') {
                escaped = true;
                continue;
            }
            if (char === ']' && !escaped) {
                inClass = true;
                continue;
            }
            if (char === '[' && !escaped) {
                inClass = false;
                continue;
            }
            if (char === '/' && !inClass) {
                return i;
            }
        }

        return -1;
    }

    function sanitizeFlags(flags) {
        const cleanFlags = String(flags || '').trim();
        const seen = new Set();

        for (const flag of cleanFlags) {
            if (!VALID_FLAGS.includes(flag)) {
                throw new SyntaxError('不支持的 flag: ' + flag);
            }
            if (seen.has(flag)) {
                throw new SyntaxError('重复的 flag: ' + flag);
            }
            seen.add(flag);
        }

        return cleanFlags;
    }

    function parseRegexLiteral(rawRegex, fallbackFlags) {
        const flagsDefault = fallbackFlags === undefined ? DEFAULT_FLAGS : fallbackFlags;
        const value = String(rawRegex || '').trim();
        if (value.startsWith('/')) {
            const closingSlash = findLiteralClosingSlash(value);
            if (closingSlash > 0) {
                return {
                    pattern: value.slice(1, closingSlash),
                    flags: sanitizeFlags(value.slice(closingSlash + 1)),
                    usedLiteralSyntax: true
                };
            }
        }

        return {
            pattern: value,
            flags: sanitizeFlags(flagsDefault),
            usedLiteralSyntax: false
        };
    }

    function compileLogicExpression(expr, segmentPatterns) {
        const parts = Array.isArray(segmentPatterns) ? segmentPatterns.map(function (item) {
            return String(item == null ? '' : item);
        }) : [];
        const normalized = String(expr || '').replace(/（/g, '(').replace(/）/g, ')');
        const trimmed = normalized.trim();
        if (!trimmed) {
            return parts.join('');
        }

        const invalidCharMatch = normalized.replace(/\s+/g, '')
            .replace(/\d+/g, '')
            .replace(/\(/g, '')
            .replace(/\)/g, '')
            .replace(/AND/gi, '')
            .replace(/OR/gi, '');
        if (invalidCharMatch.length > 0) {
            throw new Error('含有无效字符: "' + invalidCharMatch[0] + '"');
        }

        const tokens = normalized.replace(/\(/g, ' ( ')
            .replace(/\)/g, ' ) ')
            .replace(/AND/gi, ' & ')
            .replace(/OR/gi, ' | ')
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        const outputQueue = [];
        const operatorStack = [];
        const precedence = {
            '|': 1,
            '&': 2
        };

        for (let t = 0; t < tokens.length; t += 1) {
            const token = tokens[t];
            if (/^\d+$/.test(token)) {
                outputQueue.push(token);
            } else if (token === '(') {
                operatorStack.push(token);
            } else if (token === ')') {
                while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
                    outputQueue.push(operatorStack.pop());
                }
                if (operatorStack.length === 0) {
                    throw new Error('括号不匹配');
                }
                operatorStack.pop();
            } else if (token === '&' || token === '|') {
                while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
                    const topOp = operatorStack[operatorStack.length - 1];
                    if (precedence[topOp] >= precedence[token]) {
                        outputQueue.push(operatorStack.pop());
                    } else {
                        break;
                    }
                }
                operatorStack.push(token);
            } else {
                throw new Error('未知的分隔词: "' + token + '"');
            }
        }

        while (operatorStack.length > 0) {
            const topOp = operatorStack[operatorStack.length - 1];
            if (topOp === '(' || topOp === ')') {
                throw new Error('括号不匹配');
            }
            outputQueue.push(operatorStack.pop());
        }

        const stack = [];
        for (let i = 0; i < outputQueue.length; i += 1) {
            const token = outputQueue[i];
            if (/^\d+$/.test(token)) {
                const idx = parseInt(token, 10) - 1;
                if (idx < 0 || idx >= parts.length) {
                    throw new Error('无效的片段序号: ' + token);
                }
                stack.push({
                    pattern: parts[idx],
                    type: 'operand'
                });
            } else if (token === '&') {
                if (stack.length < 2) {
                    throw new Error("逻辑运算符 'AND' 缺少操作数");
                }
                const b = stack.pop();
                const a = stack.pop();
                stack.push({
                    pattern: a.pattern + b.pattern,
                    type: 'concat'
                });
            } else if (token === '|') {
                if (stack.length < 2) {
                    throw new Error("逻辑运算符 'OR' 缺少操作数");
                }
                const b = stack.pop();
                const a = stack.pop();
                stack.push({
                    pattern: '(?:' + a.pattern + '|' + b.pattern + ')',
                    type: 'or'
                });
            }
        }

        if (stack.length === 0) {
            return '';
        }
        if (stack.length !== 1) {
            throw new Error('逻辑表达式不完整');
        }
        return stack[0].pattern;
    }

    function isEmptyParsedPattern(parsed) {
        return !parsed || parsed.pattern === '';
    }

    function formatMatch(match) {
        const groups = match.slice(1).map(function (value, index) {
            return {
                index: index + 1,
                value: value === undefined ? null : value
            };
        });
        const namedGroups = match.groups ? Object.assign({}, match.groups) : {};
        const hasIndices = Array.isArray(match.indices);
        const indices = hasIndices
            ? match.indices.map(function (item) {
                return item ? { start: item[0], end: item[1] } : null;
            })
            : [];

        return {
            text: match[0],
            index: match.index,
            endIndex: match.index + match[0].length,
            groups: groups,
            namedGroups: namedGroups,
            indices: indices
        };
    }

    function isUnicodeRegex(regex) {
        return Boolean(regex && (regex.unicode || regex.unicodeSets));
    }

    function codePointSize(text, index) {
        if (index >= text.length) {
            return 1;
        }
        const cp = text.codePointAt(index);
        if (cp === undefined) {
            return 1;
        }
        return cp > 0xFFFF ? 2 : 1;
    }

    function advanceAfterMatch(regex, text, match) {
        const matchedLen = match[0].length;
        if (matchedLen > 0) {
            if (regex.lastIndex <= match.index) {
                regex.lastIndex = match.index + matchedLen;
            }
            return;
        }
        const size = isUnicodeRegex(regex) ? codePointSize(text, match.index) : 1;
        const next = match.index + size;
        if (regex.lastIndex < next) {
            regex.lastIndex = next;
        } else if (regex.lastIndex === match.index) {
            regex.lastIndex = next;
        }
    }

    function collectMatches(regex, testText, maxMatchCount) {
        const matches = [];
        const limit = Math.max(1, Number(maxMatchCount) || DEFAULT_BUDGETS.maxMatchCount);
        regex.lastIndex = 0;

        if (!regex.global) {
            const match = regex.exec(testText);
            return {
                matches: match ? [formatMatch(match)] : [],
                truncated: false
            };
        }

        let match;
        let truncated = false;
        while ((match = regex.exec(testText)) !== null) {
            matches.push(formatMatch(match));
            advanceAfterMatch(regex, testText, match);
            if (matches.length >= limit) {
                truncated = true;
                break;
            }
            if (regex.lastIndex > testText.length) {
                break;
            }
        }

        return { matches: matches, truncated: truncated };
    }

    function substituteReplacement(replacement, match, input) {
        const raw = String(replacement);
        return raw.replace(/\$(\$|&|`|'|<([^>]+)>|(\d{1,3}))/g, function (whole, token, name, digits) {
            if (token === '$') {
                return '$';
            }
            if (token === '&') {
                return match[0];
            }
            if (token === '`') {
                return input.slice(0, match.index);
            }
            if (token === "'") {
                return input.slice(match.index + match[0].length);
            }
            if (name) {
                const groups = match.groups || {};
                if (!Object.prototype.hasOwnProperty.call(groups, name) || groups[name] == null) {
                    return whole;
                }
                return String(groups[name]);
            }
            if (digits) {
                const n = Number(digits);
                if (n <= 0 || n >= match.length || match[n] == null) {
                    return whole;
                }
                return String(match[n]);
            }
            return whole;
        });
    }

    function appendCapped(state, chunk, maxReplaceChars) {
        if (state.truncated) {
            return;
        }
        const text = String(chunk);
        const room = maxReplaceChars - state.text.length;
        if (text.length <= room) {
            state.text += text;
            return;
        }
        if (room > 0) {
            state.text += text.slice(0, room);
        }
        state.truncated = true;
    }

    function replaceWithBudget(regex, text, replacement, maxReplaceChars) {
        const state = { text: '', truncated: false };
        const limit = Math.max(1, Number(maxReplaceChars) || DEFAULT_BUDGETS.maxReplaceChars);
        regex.lastIndex = 0;

        if (!regex.global) {
            const match = regex.exec(text);
            if (!match) {
                appendCapped(state, text, limit);
                return state;
            }
            appendCapped(state, text.slice(0, match.index), limit);
            appendCapped(state, substituteReplacement(replacement, match, text), limit);
            appendCapped(state, text.slice(match.index + match[0].length), limit);
            return state;
        }

        let cursor = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            appendCapped(state, text.slice(cursor, match.index), limit);
            appendCapped(state, substituteReplacement(replacement, match, text), limit);
            if (state.truncated) {
                return state;
            }
            cursor = match.index + match[0].length;
            advanceAfterMatch(regex, text, match);
            if (regex.lastIndex > text.length) {
                break;
            }
        }
        appendCapped(state, text.slice(cursor), limit);
        return state;
    }

    function failResult(status, error, testText, parsed) {
        const detail = String(error || '');
        const message = status === 'syntax' ? MESSAGES.syntaxPrefix + detail : detail;
        return {
            isValid: false,
            status: status,
            error: detail,
            message: message,
            messages: [message],
            parsed: parsed || null,
            matches: [],
            matchCount: 0,
            matchTruncated: false,
            inputTruncated: false,
            replaceTruncated: false,
            displayTruncated: false,
            replacedText: String(testText ?? ''),
            usedTextLength: 0
        };
    }

    function evaluateRegex(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const sourceText = String(opts.testText ?? '');
        const replacementText = String(opts.replacement ?? '');
        const limits = normalizeBudgets(opts.budgets);
        const messages = [];

        let parsed;
        try {
            parsed = parseRegexLiteral(opts.rawRegex, opts.flags === undefined ? DEFAULT_FLAGS : opts.flags);
        } catch (error) {
            return failResult('syntax', error.message, sourceText);
        }

        if (isEmptyParsedPattern(parsed)) {
            return {
                isValid: true,
                status: 'empty-pattern',
                error: '',
                message: MESSAGES.emptyPattern,
                messages: [MESSAGES.emptyPattern],
                parsed: parsed,
                matches: [],
                matchCount: 0,
                matchTruncated: false,
                inputTruncated: false,
                replaceTruncated: false,
                displayTruncated: false,
                replacedText: sourceText,
                usedTextLength: 0,
                budgets: limits
            };
        }

        let regex;
        try {
            regex = new RegExp(parsed.pattern, parsed.flags);
        } catch (error) {
            return failResult('syntax', error.message, sourceText, parsed);
        }

        let usedText = sourceText;
        let inputTruncated = false;
        if (usedText.length > limits.maxInputChars) {
            usedText = usedText.slice(0, limits.maxInputChars);
            inputTruncated = true;
            messages.push(formatMsg(MESSAGES.truncatedInput, limits.maxInputChars));
        }

        let collected;
        try {
            collected = collectMatches(regex, usedText, limits.maxMatchCount);
        } catch (error) {
            return failResult('error', error.message, sourceText, parsed);
        }

        if (collected.truncated) {
            messages.push(formatMsg(MESSAGES.truncatedMatches, limits.maxMatchCount));
        }

        let replaced;
        try {
            const replaceRegex = new RegExp(parsed.pattern, parsed.flags);
            replaced = replaceWithBudget(replaceRegex, usedText, replacementText, limits.maxReplaceChars);
        } catch (error) {
            return failResult('error', error.message, sourceText, parsed);
        }

        if (replaced.truncated) {
            messages.push(formatMsg(MESSAGES.truncatedReplace, limits.maxReplaceChars));
        }

        const displayTruncated = collected.matches.length > limits.maxDisplayCount;
        if (displayTruncated) {
            messages.push(formatMsg(MESSAGES.truncatedDisplay, limits.maxDisplayCount));
        }

        const truncated = inputTruncated || collected.truncated || replaced.truncated || displayTruncated;
        return {
            isValid: true,
            status: truncated ? 'truncated' : 'ok',
            error: '',
            message: messages[0] || (collected.matches.length ? MESSAGES.success : MESSAGES.noMatch),
            messages: messages,
            parsed: parsed,
            matches: collected.matches,
            matchCount: collected.matches.length,
            matchTruncated: collected.truncated,
            inputTruncated: inputTruncated,
            replaceTruncated: replaced.truncated,
            displayTruncated: displayTruncated,
            replacedText: replaced.text,
            usedTextLength: usedText.length,
            budgets: limits
        };
    }

    function readBracketToken(pattern, startIndex) {
        let escaped = false;
        for (let i = startIndex + 1; i < pattern.length; i += 1) {
            const char = pattern[i];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === '\\') {
                escaped = true;
                continue;
            }
            if (char === ']') {
                return pattern.slice(startIndex, i + 1);
            }
        }
        return pattern.slice(startIndex);
    }

    function readQuantifier(pattern, startIndex) {
        if (pattern[startIndex] !== '{') {
            return pattern[startIndex];
        }
        const closeIndex = pattern.indexOf('}', startIndex + 1);
        return closeIndex === -1 ? '{' : pattern.slice(startIndex, closeIndex + 1);
    }

    function describeEscape(token) {
        const map = {
            '\\d': ['数字字符', '匹配任意一个 0-9 数字。'],
            '\\D': ['非数字字符', '匹配任意一个不是数字的字符。'],
            '\\w': ['单词字符', '匹配字母、数字或下划线。'],
            '\\W': ['非单词字符', '匹配不是字母、数字或下划线的字符。'],
            '\\s': ['空白字符', '匹配空格、制表符、换行等空白字符。'],
            '\\S': ['非空白字符', '匹配任意非空白字符。'],
            '\\b': ['单词边界', '匹配单词字符和非单词字符之间的位置。'],
            '\\B': ['非单词边界', '匹配不是单词边界的位置。'],
            '\\n': ['换行符', '匹配换行。'],
            '\\r': ['回车符', '匹配回车。'],
            '\\t': ['制表符', '匹配 Tab。']
        };
        return map[token] || ['转义字符', '按字面量或特殊含义匹配 ' + token + '。'];
    }

    function describeQuantifier(token) {
        const isLazy = token.endsWith('?');
        const baseToken = isLazy ? token.slice(0, -1) : token;
        const lazyText = isLazy ? '（懒惰模式/非贪婪，匹配尽可能少的内容）' : '';

        const map = {
            '*': '重复前一个 token 0 次或多次。',
            '+': '重复前一个 token 1 次或多次。',
            '?': '让前一个 token 可选，重复 0 次或 1 次。'
        };

        let baseDesc = '';
        if (map[baseToken]) {
            baseDesc = map[baseToken];
        } else if (/^\{\d+\}$/.test(baseToken)) {
            baseDesc = '让前一个 token 精确重复 ' + baseToken.slice(1, -1) + ' 次。';
        } else if (/^\{\d+,\}$/.test(baseToken)) {
            baseDesc = '让前一个 token 至少重复 ' + baseToken.slice(1, -2) + ' 次。';
        } else if (/^\{\d+,\d+\}$/.test(baseToken)) {
            const parts = baseToken.slice(1, -1).split(',');
            baseDesc = '让前一个 token 重复 ' + parts[0] + ' 到 ' + parts[1] + ' 次。';
        } else {
            baseDesc = '量词语法，用于控制前一个 token 的重复次数。';
        }

        return baseDesc + (isLazy ? ' ' + lazyText : '');
    }

    function explainPattern(pattern) {
        const explanations = [];
        const source = String(pattern || '');

        for (let i = 0; i < source.length; i += 1) {
            const char = source[i];
            let token = char;
            let label = '普通字符';
            let description = '按字面量匹配字符 ' + char + '。';

            if (char === '\\') {
                token = source.slice(i, i + 2);
                const described = describeEscape(token);
                label = described[0];
                description = described[1];
                i += 1;
            } else if (char === '[') {
                token = readBracketToken(source, i);
                label = token.startsWith('[^') ? '排除字符类' : '字符类';
                description = token.startsWith('[^')
                    ? '匹配不在方括号范围内的任意一个字符。'
                    : '匹配方括号范围内的任意一个字符。';
                i += token.length - 1;
            } else if (char === '(') {
                if (source.startsWith('(?:', i)) {
                    token = '(?:';
                    label = '非捕获组';
                    description = '对表达式分组，但不会保存为捕获组。';
                    i += 2;
                } else if (source.startsWith('(?=', i)) {
                    token = '(?=';
                    label = '正向预查';
                    description = '要求当前位置后面能匹配指定内容，但不消耗字符。';
                    i += 2;
                } else if (source.startsWith('(?!', i)) {
                    token = '(?!';
                    label = '负向预查';
                    description = '要求当前位置后面不能匹配指定内容。';
                    i += 2;
                } else if (source.startsWith('(?<=', i)) {
                    token = '(?<=';
                    label = '正向后顾';
                    description = '要求当前位置前面能匹配指定内容。';
                    i += 3;
                } else if (source.startsWith('(?<!', i)) {
                    token = '(?<!';
                    label = '负向后顾';
                    description = '要求当前位置前面不能匹配指定内容。';
                    i += 3;
                } else if (source.startsWith('(?<', i)) {
                    const closeIndex = source.indexOf('>', i + 3);
                    token = closeIndex === -1 ? '(?<' : source.slice(i, closeIndex + 1);
                    label = '命名捕获组';
                    description = '捕获匹配内容，并使用名称在代码或替换中引用。';
                    i += token.length - 1;
                } else {
                    label = '捕获组';
                    description = '对表达式分组，并保存匹配内容供后续引用。';
                }
            } else if (char === '^') {
                label = '行首锚点';
                description = '匹配字符串开头；开启 m flag 时也匹配每一行开头。';
            } else if (char === '$') {
                label = '行尾锚点';
                description = '匹配字符串结尾；开启 m flag 时也匹配每一行结尾。';
            } else if (char === '.') {
                label = '任意字符';
                description = '匹配除换行外的任意一个字符；开启 s flag 后也匹配换行。';
            } else if (char === '|') {
                label = '分支选择';
                description = '匹配左侧或右侧任一表达式。';
            } else if ('*+?'.includes(char) || char === '{') {
                token = readQuantifier(source, i);
                if (source[i + token.length] === '?') {
                    token += '?';
                }
                label = '量词';
                description = describeQuantifier(token);
                i += token.length - 1;
            } else if (char === ')') {
                label = '分组结束';
                description = '结束当前分组。';
            }

            explanations.push({
                token: token,
                label: label,
                description: description,
                index: i - token.length + 1
            });
        }

        return explanations;
    }

    function buildHighlightSegments(testText, matches) {
        const source = String(testText || '');
        if (!source) {
            return [];
        }
        if (!matches || !matches.length) {
            return [{ type: 'text', value: source }];
        }

        const segments = [];
        let cursor = 0;
        for (let i = 0; i < matches.length; i += 1) {
            const match = matches[i];
            if (!match || match.index < cursor) {
                continue;
            }
            if (match.index > cursor) {
                segments.push({ type: 'text', value: source.slice(cursor, match.index) });
            }
            if (match.endIndex === match.index) {
                segments.push({ type: 'zero', value: '' });
                cursor = match.index;
            } else {
                segments.push({
                    type: 'mark',
                    value: source.slice(match.index, match.endIndex)
                });
                cursor = match.endIndex;
            }
        }
        if (cursor < source.length) {
            segments.push({ type: 'text', value: source.slice(cursor) });
        }
        return segments;
    }

    function buildHighlightedText(testText, matches) {
        const source = String(testText || '');
        if (!source) {
            return '<span class="empty-state">输入测试文本后会显示高亮结果</span>';
        }

        const segments = buildHighlightSegments(source, matches);
        let output = '';
        for (let i = 0; i < segments.length; i += 1) {
            const segment = segments[i];
            if (segment.type === 'mark') {
                output += '<mark>' + escapeHtml(segment.value) + '</mark>';
            } else if (segment.type === 'zero') {
                output += '<span class="zero-match" title="零宽匹配"></span>';
            } else {
                output += escapeHtml(segment.value);
            }
        }
        return output;
    }

    function sliceMatchesForDisplay(matches, maxDisplayCount) {
        const list = Array.isArray(matches) ? matches : [];
        const limit = Math.max(1, Number(maxDisplayCount) || DEFAULT_BUDGETS.maxDisplayCount);
        return list.slice(0, limit);
    }

    function shouldIgnoreStaleResult(currentRequestId, resultRequestId) {
        return Number(currentRequestId) !== Number(resultRequestId);
    }

    function shouldEvaluateInput(event, composing) {
        if (composing) {
            return false;
        }
        if (event && event.isComposing) {
            return false;
        }
        return true;
    }

    function handleWorkerMessage(currentRequestId, message) {
        const msg = message && typeof message === 'object' ? message : {};
        if (shouldIgnoreStaleResult(currentRequestId, msg.requestId)) {
            return { ignore: true, result: null };
        }
        return { ignore: false, result: msg.result || null, type: msg.type || '' };
    }

    function createWorkerRequest(requestId, payload) {
        return {
            type: 'run',
            requestId: requestId,
            payload: payload && typeof payload === 'object' ? payload : {}
        };
    }

    function workerOnMessage(event) {
        const msg = (event && event.data) || {};
        const requestId = msg.requestId;
        if (msg.type === 'ping') {
            self.postMessage({ type: 'ready', requestId: requestId });
            return;
        }
        if (msg.type !== 'run') {
            return;
        }
        try {
            const result = (self.RegexToolCore || RegexToolCore).evaluateRegex(msg.payload || {});
            self.postMessage({ type: 'result', requestId: requestId, result: result });
        } catch (error) {
            self.postMessage({
                type: 'error',
                requestId: requestId,
                error: String(error && error.message ? error.message : error)
            });
        }
    }

    function createWorkerBootstrapSource() {
        return (
            'var RegexToolCore = (' + buildRegexToolCore.toString() + ')();\n' +
            'self.RegexToolCore = RegexToolCore;\n' +
            'self.onmessage = ' + workerOnMessage.toString() + ';'
        );
    }

    const RULE_KIT_LIMITS = Object.freeze({ maxBytes: 512 * 1024, maxCases: 32, maxPatternChars: 4000, maxCaseChars: 20000, maxTotalChars: 100000, maxMatches: 400 });

    function matchSignature(match) {
        const namedGroups = {};
        Object.keys(match.namedGroups || {}).sort().forEach(function (name) {
            Object.defineProperty(namedGroups, name, { enumerable: true, value: match.namedGroups[name] == null ? null : String(match.namedGroups[name]) });
        });
        return {
            text: String(match.text), index: Number(match.index), endIndex: Number(match.endIndex),
            groups: (match.groups || []).map(function (group) { return { index: Number(group.index), value: group.value == null ? null : String(group.value) }; }),
            namedGroups: namedGroups,
            indices: (match.indices || []).map(function (entry) { return entry ? { start: Number(entry.start), end: Number(entry.end) } : null; })
        };
    }

    function normalizeRuleKit(value) {
        const src = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
        if (!src || src.schemaVersion !== 1 || src.engine !== 'JavaScript') throw new Error('只支持格式版本 1 的 JavaScript 规则包');
        function text(value, max, label) {
            if (typeof value !== 'string' || value.length > max) throw new Error(label + '格式错误或超出上限');
            return value;
        }
        const pattern = text(src.pattern, RULE_KIT_LIMITS.maxPatternChars, '表达式');
        if (!pattern) throw new Error('表达式不能为空，请先配置规则');
        const flags = sanitizeFlags(text(src.flags, 8, 'flags'));
        try { new RegExp(pattern, flags); } catch (error) { throw new Error('此浏览器不支持该 JavaScript 表达式：' + error.message); }
        const ruleVersion = text(src.ruleVersion, 64, '规则版本').trim();
        if (!ruleVersion) throw new Error('规则版本不能为空');
        const description = text(src.description || '', 2000, '说明');
        if (!Array.isArray(src.cases) || src.cases.length > RULE_KIT_LIMITS.maxCases) throw new Error('最多导入 32 个样例');
        let total = 0;
        let expectedBytes = 0;
        function countExpected(value) {
            expectedBytes += new TextEncoder().encode(value == null ? '' : String(value)).length;
            if (expectedBytes > RULE_KIT_LIMITS.maxBytes) throw new Error('精确预期超过 512KB，请减少捕获组或样例');
        }
        const cases = src.cases.map(function (entry, caseIndex) {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('样例格式错误');
            const input = text(entry.text, RULE_KIT_LIMITS.maxCaseChars, '样例正文');
            total += input.length;
            if (typeof entry.expectMatch !== 'boolean') throw new Error('每个样例必须明确应匹配或不应匹配');
            const name = text(entry.name || '样例 ' + (caseIndex + 1), 100, '样例名称');
            let expectedMatches = null;
            if (entry.expectedMatches != null) {
                if (!Array.isArray(entry.expectedMatches) || entry.expectedMatches.length > RULE_KIT_LIMITS.maxMatches) throw new Error('精确预期最多 400 条匹配');
                expectedMatches = entry.expectedMatches.map(function (match) {
                    if (!match || typeof match !== 'object' || !Number.isInteger(match.index) || !Number.isInteger(match.endIndex) || match.index < 0 || match.endIndex < match.index || match.endIndex > input.length || typeof match.text !== 'string' || match.text !== input.slice(match.index, match.endIndex)) throw new Error('精确预期的匹配正文或位置错误');
                    countExpected(match.text);
                    if (!Array.isArray(match.groups) || match.groups.length > 100 || !match.namedGroups || typeof match.namedGroups !== 'object' || Array.isArray(match.namedGroups) || Object.keys(match.namedGroups).length > 100) throw new Error('精确预期的捕获组格式错误或超限');
                    match.groups.forEach(function (group, i) { if (!group || group.index !== i + 1 || (group.value !== null && typeof group.value !== 'string') || (group.value && group.value.length > RULE_KIT_LIMITS.maxCaseChars)) throw new Error('精确预期的捕获组值错误'); countExpected(group.value); });
                    Object.entries(match.namedGroups).forEach(function (pair) { if (pair[0].length > 100 || (pair[1] !== null && typeof pair[1] !== 'string') || (pair[1] && pair[1].length > RULE_KIT_LIMITS.maxCaseChars)) throw new Error('精确预期的命名组值错误'); countExpected(pair[0]); countExpected(pair[1]); });
                    if (match.indices != null) {
                        if (!Array.isArray(match.indices) || match.indices.length > 101) throw new Error('精确预期的分组位置超限');
                        match.indices.forEach(function (entry) { if (entry !== null && (!entry || !Number.isInteger(entry.start) || !Number.isInteger(entry.end) || entry.start < 0 || entry.end < entry.start || entry.end > input.length)) throw new Error('精确预期的分组位置错误'); });
                    }
                    return matchSignature(match);
                });
                if ((expectedMatches.length > 0) !== entry.expectMatch) throw new Error('精确匹配结果与应匹配/不应匹配的预期矛盾');
            }
            return { name: name, text: input, expectMatch: entry.expectMatch, expectedMatches: expectedMatches };
        });
        if (total > RULE_KIT_LIMITS.maxTotalChars) throw new Error('样例正文合计上限为 100,000 字符');
        return { schemaVersion: 1, engine: 'JavaScript', ruleVersion: ruleVersion, pattern: pattern, flags: flags, description: description, logicSemantics: 'AND 表示顺序连接；OR 表示任选其一', cases: cases };
    }

    function serializeRuleKit(value) {
        const json = JSON.stringify(normalizeRuleKit(value), null, 2);
        if (new TextEncoder().encode(json).length > RULE_KIT_LIMITS.maxBytes) throw new Error('规则包超过 512KB，请减少样例或精确预期');
        return json;
    }

    function parseRuleKit(json) {
        if (typeof json !== 'string' || new TextEncoder().encode(json).length > RULE_KIT_LIMITS.maxBytes) throw new Error('规则包上限为 512KB');
        let value;
        try { value = JSON.parse(json); } catch (error) { throw new Error('规则包不是有效 JSON 文件'); }
        return normalizeRuleKit(value);
    }

    function checkRuleCase(entry, evaluation) {
        if (!evaluation || !evaluation.isValid || evaluation.status === 'truncated') return { passed: false, complete: false, message: evaluation && evaluation.message || '样例计算失败或已截断，不能证明通过' };
        const observed = evaluation.matches.map(matchSignature);
        const booleanPass = (observed.length > 0) === entry.expectMatch;
        const exactPass = entry.expectedMatches == null || JSON.stringify(observed) === JSON.stringify(entry.expectedMatches.map(matchSignature));
        return { passed: booleanPass && exactPass, complete: true, observed: observed, message: !booleanPass ? (entry.expectMatch ? '预期应匹配，实际没有匹配' : '预期不应匹配，实际发现匹配') : !exactPass ? '匹配内容、位置或分组与精确预期不同' : '符合预期' };
    }

    return {
        VALID_FLAGS: VALID_FLAGS,
        DEFAULT_FLAGS: DEFAULT_FLAGS,
        DEFAULT_BUDGETS: DEFAULT_BUDGETS,
        MESSAGES: MESSAGES,
        formatMsg: formatMsg,
        normalizeBudgets: normalizeBudgets,
        escapeHtml: escapeHtml,
        parseRegexLiteral: parseRegexLiteral,
        compileLogicExpression: compileLogicExpression,
        evaluateRegex: evaluateRegex,
        explainPattern: explainPattern,
        buildHighlightSegments: buildHighlightSegments,
        buildHighlightedText: buildHighlightedText,
        collectMatches: collectMatches,
        sliceMatchesForDisplay: sliceMatchesForDisplay,
        shouldIgnoreStaleResult: shouldIgnoreStaleResult,
        shouldEvaluateInput: shouldEvaluateInput,
        handleWorkerMessage: handleWorkerMessage,
        createWorkerRequest: createWorkerRequest,
        createWorkerBootstrapSource: createWorkerBootstrapSource,
        RULE_KIT_LIMITS: RULE_KIT_LIMITS,
        matchSignature: matchSignature,
        normalizeRuleKit: normalizeRuleKit,
        serializeRuleKit: serializeRuleKit,
        parseRuleKit: parseRuleKit,
        checkRuleCase: checkRuleCase
    };
}));
