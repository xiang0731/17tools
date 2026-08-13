(function () {
    'use strict';

    const VALID_FLAGS = ['g', 'i', 'm', 's', 'u', 'y', 'd'];
    const DEFAULT_FLAGS = 'g';

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
                throw new SyntaxError(`不支持的 flag: ${flag}`);
            }
            if (seen.has(flag)) {
                throw new SyntaxError(`重复的 flag: ${flag}`);
            }
            seen.add(flag);
        }

        return cleanFlags;
    }

    function parseRegexLiteral(rawRegex, fallbackFlags = DEFAULT_FLAGS) {
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
            flags: sanitizeFlags(fallbackFlags),
            usedLiteralSyntax: false
        };
    }

    function formatMatch(match) {
        const groups = match.slice(1).map((value, index) => ({
            index: index + 1,
            value: value === undefined ? null : value
        }));
        const namedGroups = match.groups ? { ...match.groups } : {};
        const hasIndices = Array.isArray(match.indices);
        const indices = hasIndices
            ? match.indices.map((item) => item ? { start: item[0], end: item[1] } : null)
            : [];

        return {
            text: match[0],
            index: match.index,
            endIndex: match.index + match[0].length,
            groups,
            namedGroups,
            indices
        };
    }

    function collectMatches(regex, testText) {
        const matches = [];
        regex.lastIndex = 0;

        if (!regex.global) {
            const match = regex.exec(testText);
            return match ? [formatMatch(match)] : [];
        }

        let match;
        let guard = 0;
        while ((match = regex.exec(testText)) !== null) {
            matches.push(formatMatch(match));

            if (match[0] === '') {
                regex.lastIndex += 1;
            }
            guard += 1;
            if (guard > 10000) {
                break;
            }
        }

        return matches;
    }

    function evaluateRegex({ rawRegex, testText = '', replacement = '', flags = DEFAULT_FLAGS }) {
        let parsed;
        let regex;

        try {
            parsed = parseRegexLiteral(rawRegex, flags);
            regex = new RegExp(parsed.pattern, parsed.flags);
        } catch (error) {
            return {
                isValid: false,
                error: error.message,
                parsed: null,
                matches: [],
                replacedText: testText
            };
        }

        try {
            const matches = collectMatches(regex, testText);
            const replaceRegex = new RegExp(parsed.pattern, parsed.flags);
            return {
                isValid: true,
                error: '',
                parsed,
                matches,
                replacedText: String(testText).replace(replaceRegex, replacement)
            };
        } catch (error) {
            return {
                isValid: false,
                error: error.message,
                parsed,
                matches: [],
                replacedText: testText
            };
        }
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
        return map[token] || ['转义字符', `按字面量或特殊含义匹配 ${token}。`];
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
            baseDesc = `让前一个 token 精确重复 ${baseToken.slice(1, -1)} 次。`;
        } else if (/^\{\d+,\}$/.test(baseToken)) {
            baseDesc = `让前一个 token 至少重复 ${baseToken.slice(1, -2)} 次。`;
        } else if (/^\{\d+,\d+\}$/.test(baseToken)) {
            const [min, max] = baseToken.slice(1, -1).split(',');
            baseDesc = `让前一个 token 重复 ${min} 到 ${max} 次。`;
        } else {
            baseDesc = '量词语法，用于控制前一个 token 的重复次数。';
        }

        return baseDesc + (isLazy ? ` ${lazyText}` : '');
    }

    function explainPattern(pattern) {
        const explanations = [];
        const source = String(pattern || '');

        for (let i = 0; i < source.length; i += 1) {
            const char = source[i];
            let token = char;
            let label = '普通字符';
            let description = `按字面量匹配字符 ${char}。`;

            if (char === '\\') {
                token = source.slice(i, i + 2);
                [label, description] = describeEscape(token);
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
                token,
                label,
                description,
                index: i - token.length + 1
            });
        }

        return explanations;
    }

    function buildHighlightedText(testText, matches) {
        const source = String(testText || '');
        if (!source) {
            return '<span class="empty-state">输入测试文本后会显示高亮结果</span>';
        }
        if (!matches.length) {
            return escapeHtml(source);
        }

        let cursor = 0;
        let output = '';
        for (const match of matches) {
            if (match.index < cursor) {
                continue;
            }
            output += escapeHtml(source.slice(cursor, match.index));
            if (match.endIndex === match.index) {
                output += '<span class="zero-match" title="零宽匹配"></span>';
                cursor = match.index;
            } else {
                output += `<mark>${escapeHtml(source.slice(match.index, match.endIndex))}</mark>`;
                cursor = match.endIndex;
            }
        }
        output += escapeHtml(source.slice(cursor));
        return output;
    }

    function getSelectedFlags(flagInputs) {
        return Array.from(flagInputs)
            .filter((input) => input.checked)
            .map((input) => input.dataset.flag)
            .join('');
    }

    function setSelectedFlags(flagInputs, flags) {
        Array.from(flagInputs).forEach((input) => {
            input.checked = flags.includes(input.dataset.flag);
        });
    }

    function insertAtCursor(input, text) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        input.value = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;
        input.focus();
        input.selectionStart = input.selectionEnd = start + text.length;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function renderMatches(container, matches) {
        if (!matches.length) {
            container.innerHTML = '<div class="empty-state">暂无匹配结果</div>';
            return;
        }

        container.innerHTML = matches.map((match, index) => {
            const groups = match.groups.length
                ? `<div class="match-groups">${match.groups.map((group) => (
                    `<span>组 ${group.index}: <code>${escapeHtml(group.value ?? '未匹配')}</code></span>`
                )).join('')}</div>`
                : '';
            const namedGroups = Object.keys(match.namedGroups).length
                ? `<div class="match-groups">${Object.entries(match.namedGroups).map(([name, value]) => (
                    `<span>${escapeHtml(name)}: <code>${escapeHtml(value ?? '未匹配')}</code></span>`
                )).join('')}</div>`
                : '';

            return `
                <div class="match-item">
                    <div class="match-item-head">
                        <strong>#${index + 1}</strong>
                        <span>index ${match.index} - ${match.endIndex}</span>
                    </div>
                    <code>${escapeHtml(match.text || '零宽匹配')}</code>
                    ${groups}
                    ${namedGroups}
                </div>
            `;
        }).join('');
    }

    function renderExplanation(container, explanations) {
        if (!explanations.length) {
            container.innerHTML = '<div class="empty-state">输入正则后会生成中文解释</div>';
            return;
        }

        container.innerHTML = explanations.map((item) => `
            <div class="explain-item">
                <code>${escapeHtml(item.token)}</code>
                <div>
                    <strong>${escapeHtml(item.label)}</strong>
                    <p>${escapeHtml(item.description)}</p>
                </div>
            </div>
        `).join('');
    }

    async function writeClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                textarea.remove();
            }
            if (typeof window.showToast === 'function') {
                window.showToast("已成功复制到剪贴板！", "success");
            }
        } catch (err) {
            if (typeof window.showToast === 'function') {
                window.showToast("复制失败，请手动选择复制。", "error");
            }
        }
    }

    let isInitialized = false;

    function initRegexTool() {
        if (isInitialized) return;
        const regexInput = document.getElementById('regexInput');
        if (!regexInput) {
            return;
        }
        isInitialized = true;

        const flagInputs = document.querySelectorAll('[data-flag]');
        const testTextInput = document.getElementById('testTextInput');
        const replaceInput = document.getElementById('replaceInput');
        const replaceOutput = document.getElementById('replaceOutput');
        const matchSummary = document.getElementById('matchSummary');
        const matchList = document.getElementById('matchList');
        const highlightedText = document.getElementById('highlightedText');
        const explanationList = document.getElementById('explanationList');
        const statusText = document.getElementById('statusText');
        const copyRegexBtn = document.getElementById('copyRegexBtn');
        const copyMatchesBtn = document.getElementById('copyMatchesBtn');
        const copyReplaceBtn = document.getElementById('copyReplaceBtn');
        const manualPresetSelect = document.getElementById('manualPresetSelect');

        let lastEvaluation = null;
        let isLoadingPreset = false;

        function evaluateAndRender() {
            if (!isLoadingPreset && manualPresetSelect) {
                manualPresetSelect.value = "";
            }

            const selectedFlags = getSelectedFlags(flagInputs);
            const evaluation = evaluateRegex({
                rawRegex: regexInput.value,
                testText: testTextInput.value,
                replacement: replaceInput.value,
                flags: selectedFlags
            });
            lastEvaluation = evaluation;

            if (!evaluation.isValid) {
                matchSummary.innerHTML = '<strong>表达式错误</strong><span>请检查语法</span>';
                statusText.textContent = evaluation.error;
                statusText.className = 'status-text error';
                highlightedText.innerHTML = escapeHtml(testTextInput.value);
                matchList.innerHTML = `<div class="empty-state error">${escapeHtml(evaluation.error)}</div>`;
                replaceOutput.value = testTextInput.value;
                renderExplanation(explanationList, []);
                return;
            }

            if (evaluation.parsed.usedLiteralSyntax) {
                setSelectedFlags(flagInputs, evaluation.parsed.flags);
            }

            matchSummary.innerHTML = `
                <strong>${evaluation.matches.length}</strong>
                <span>${evaluation.matches.length === 1 ? '个匹配' : '个匹配'} / flags: ${escapeHtml(evaluation.parsed.flags || '无')}</span>
            `;
            statusText.textContent = evaluation.matches.length ? '已实时完成匹配' : '当前没有匹配结果';
            statusText.className = evaluation.matches.length ? 'status-text success' : 'status-text';
            highlightedText.innerHTML = buildHighlightedText(testTextInput.value, evaluation.matches);
            renderMatches(matchList, evaluation.matches);
            replaceOutput.value = evaluation.replacedText;
            renderExplanation(explanationList, explainPattern(evaluation.parsed.pattern));
        }

        [regexInput, testTextInput, replaceInput].forEach((element) => {
            element.addEventListener('input', evaluateAndRender);
        });
        flagInputs.forEach((input) => input.addEventListener('change', evaluateAndRender));

        document.querySelectorAll('[data-insert-token]').forEach((button) => {
            button.addEventListener('click', () => insertAtCursor(regexInput, button.dataset.insertToken));
        });

        if (manualPresetSelect) {
            manualPresetSelect.addEventListener('change', () => {
                const idx = manualPresetSelect.value;
                const presetsList = window.PRESETS || [];
                const preset = presetsList[idx];
                if (!preset) return;

                isLoadingPreset = true;

                regexInput.value = preset.pattern.replace(/^\/|\/[gim]*$/g, ''); // strip outer slashes
                testTextInput.value = preset.test;
                replaceInput.value = preset.replacement ?? '';

                const presetFlags = preset.flags || 'g';
                flagInputs.forEach((input) => {
                    input.checked = presetFlags.includes(input.dataset.flag);
                });

                evaluateAndRender();
                
                isLoadingPreset = false;
                
                if (typeof window.showToast === 'function') {
                    window.showToast(`已成功载入预设：“${preset.name}”`, 'success');
                }
            });
        }

        if (copyRegexBtn) {
            copyRegexBtn.addEventListener('click', () => writeClipboard(regexInput.value));
        }
        if (copyMatchesBtn) {
            copyMatchesBtn.addEventListener('click', () => {
                const text = lastEvaluation && lastEvaluation.matches.length
                    ? lastEvaluation.matches.map((match, index) => `${index + 1}. [${match.index}-${match.endIndex}] ${match.text}`).join('\n')
                    : '';
                writeClipboard(text);
            });
        }
        if (copyReplaceBtn) {
            copyReplaceBtn.addEventListener('click', () => writeClipboard(replaceOutput.value));
        }

        evaluateAndRender();
    }

    window.RegexToolCore = {
        evaluateRegex,
        explainPattern,
        parseRegexLiteral,
        buildHighlightedText,
        escapeHtml
    };

    window.RegexToolUi = {
        initRegexTool
    };

    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', initRegexTool);
    }
})();
