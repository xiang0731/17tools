(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./regex-tool-core.js'));
    } else {
        root.RegexGeneratorCore = factory(root.RegexToolCore);
    }
}(typeof self !== 'undefined' ? self : this, function (regexCore) {
    'use strict';

    const MAX_COUNT = 20000;
    const ANY = '[\\s\\S]';
    const STRICT_END = '$(?![\\s\\S])';

    function escapeText(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function readCount(value, label, minimum, emptyValue) {
        const text = String(value == null ? '' : value).trim();
        if (!text && emptyValue !== undefined) return emptyValue;
        if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < minimum || Number(text) > MAX_COUNT) {
            throw new Error(label + '必须是 ' + minimum + ' 到 ' + MAX_COUNT + ' 之间的整数。');
        }
        return Number(text);
    }

    function compileSegment(segment) {
        const seg = segment || {};
        const excluded = seg.status === 'exclude';
        const text = String(seg.customValue == null ? '' : seg.customValue);
        if (text.length > MAX_COUNT) throw new Error('自定义内容最多 ' + MAX_COUNT + ' 个字符。');
        const types = {
            digit: ['\\d', '\\D', '数字字符 (0-9)', '非数字字符'],
            lower: ['[a-z]', '[^a-z]', '小写英文字母 (a-z)', '非小写英文字母'],
            upper: ['[A-Z]', '[^A-Z]', '大写英文字母 (A-Z)', '非大写英文字母'],
            letter: ['[a-zA-Z]', '[^a-zA-Z]', '英文字母 (a-zA-Z)', '非英文字母'],
            alphanumeric: ['[a-zA-Z0-9]', '[^a-zA-Z0-9]', '英文字母或数字', '非英文字母及数字'],
            whitespace: ['\\s', '\\S', '空白字符 (空格/制表符/换行)', '非空白字符'],
            any: ['.', '', '任意单个字符 (除了换行符)', '']
        };
        let base;
        let contentDesc;
        let group = false;
        if (seg.type === 'custom') {
            if (!text) throw new Error('请填写自定义文本。');
            base = excluded ? '[^' + text.replace(/[\\\]\-^]/g, '\\$&') + ']' : escapeText(text);
            contentDesc = excluded ? '不在 "' + text + '" 中的单个字符' : '字面量文本 "' + text + '"';
            group = !excluded && text.length > 1;
        } else if (seg.type === 'regex') {
            if (!text) throw new Error('请填写自定义正则。');
            try { new RegExp(text); }
            catch (error) { throw new Error('自定义正则语法错误：' + error.message); }
            base = excluded ? '(?!(?:' + text + '))' + ANY : text;
            contentDesc = excluded ? '当前位置不以正则模式 "' + text + '" 开头的单个字符' : '正则模式 "' + text + '"';
            group = true;
        } else if (Object.hasOwn(types, seg.type)) {
            const type = types[seg.type];
            if (excluded && seg.type === 'any') throw new Error('排除任意字符不会留下可匹配内容，请选择具体字符类型。');
            base = type[excluded ? 1 : 0];
            contentDesc = type[excluded ? 3 : 2];
        } else {
            throw new Error('请选择有效的片段类型。');
        }

        let suffix = '';
        let qDesc;
        switch (seg.quantifier || 'exactly') {
            case 'exactly': qDesc = '，出现正好 1 次'; break;
            case 'optional': suffix = '?'; qDesc = '，出现 0 次或 1 次（可选）'; break;
            case 'one-or-more': suffix = '+'; qDesc = '，出现 1 次或多次（至少 1 次）'; break;
            case 'zero-or-more': suffix = '*'; qDesc = '，出现 0 次或多次'; break;
            case 'n-times': {
                const n = readCount(seg.nValue, '出现次数', 1);
                suffix = '{' + n + '}'; qDesc = '，出现正好 ' + n + ' 次'; break;
            }
            case 'range': {
                const min = readCount(seg.minValue, '最少出现次数', 0, 0);
                const max = readCount(seg.maxValue, '最多出现次数', 0, '');
                if (max !== '' && min > max) throw new Error('最少出现次数不能大于最多出现次数。');
                suffix = '{' + min + ',' + max + '}';
                qDesc = max === '' ? '，出现至少 ' + min + ' 次' : '，出现 ' + min + ' 到 ' + max + ' 次';
                break;
            }
            default: throw new Error('请选择有效的出现次数。');
        }
        // Raw regex is always a complete operand, even with no quantifier.
        const pattern = (group ? '(?:' + base + ')' : base) + suffix;
        return { pattern: pattern, contentDesc: contentDesc, qDesc: qDesc };
    }

    function supportsWholeConstraints(anchorMode, flags) {
        return anchorMode === 'both' && !String(flags || '').includes('m');
    }

    function toLiteral(pattern, flags) {
        return new RegExp(String(pattern), String(flags || '')).toString();
    }

    function generate(config) {
        const input = config || {};
        const flags = input.flags == null ? 'g' : String(input.flags);
        const anchor = input.anchorMode || 'both';
        if (!['none', 'start', 'end', 'both'].includes(anchor)) throw new Error('请选择有效的匹配位置。');
        if (!Array.isArray(input.segments) || !input.segments.length) throw new Error('请添加至少一个规则片段。');
        const segments = input.segments.map(function (seg, index) {
            try { return compileSegment(seg); }
            catch (error) { throw new Error('规则片段 ' + (index + 1) + ' 配置错误：' + error.message); }
        });
        const body = regexCore.compileLogicExpression(input.logic || '', segments.map(function (seg) { return seg.pattern; }));
        let constraints = '';
        const whole = supportsWholeConstraints(anchor, flags);
        if (whole) {
            if (input.limitLength) {
                const min = readCount(input.minLength, '最少字符数', 0, 0);
                const max = readCount(input.maxLength, '最多字符数', 0, '');
                if (max !== '' && min > max) throw new Error('最少字符数不能大于最多字符数。');
                constraints += '(?=' + ANY + '{' + min + ',' + max + '}' + STRICT_END + ')';
            }
            if (input.requireDigit) constraints += '(?=' + ANY + '*\\d)';
            if (input.requireLetter) constraints += '(?=' + ANY + '*[a-zA-Z])';
            if (String(input.forbiddenText || '').length > MAX_COUNT) throw new Error('不包含文本最多 ' + MAX_COUNT + ' 个字符。');
            if (input.forbiddenText) constraints += '(?!' + ANY + '*' + escapeText(input.forbiddenText) + ')';
        }
        const end = flags.includes('m') ? '$' : STRICT_END;
        let pattern = constraints + body;
        if (anchor === 'both') pattern = '^' + pattern + end;
        if (anchor === 'start') pattern = '^' + pattern;
        if (anchor === 'end') pattern += end;
        if (pattern.length > MAX_COUNT) throw new Error('生成规则过长，请减少片段或自定义内容；最多 ' + MAX_COUNT + ' 个字符。');
        // Compile only. Matching always remains in the interruptible Worker.
        pattern = new RegExp(pattern, flags).source;
        return { pattern: pattern, flags: flags, segments: segments, wholeConstraintsApplied: whole };
    }

    function segment(type, quantifier, customValue, extras) {
        return Object.assign({ status: 'include', type: type, quantifier: quantifier || 'exactly', customValue: customValue || '' }, extras || {});
    }
    function preset(name, desc, test, segments, anchorMode, replacement) {
        const config = { anchorMode: anchorMode || 'both', flags: 'g', segments: segments, logic: '' };
        const result = generate(config);
        return Object.freeze({ name: name, desc: desc, test: test, pattern: result.pattern, flags: result.flags, config: config, replacement: replacement });
    }

    const octet = '(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)';
    const month = '(?:0[1-9]|1[0-2])';
    const day = '(?:0[1-9]|[12]\\d|3[01])';
    const PRESETS = Object.freeze([
        preset('手机号码', '匹配中国大陆 11 位手机号格式，支持 13–19 开头；不检查号码是否已分配。', '13812345678\n18900001111\n12345678901', [segment('custom', 'exactly', '1'), segment('regex', 'exactly', '[3-9]'), segment('digit', 'n-times', '', { nValue: 9 })]),
        preset('电子邮箱', '匹配常见电子邮箱地址格式，包括二级域名；不是完整邮件标准或可投递性校验。', 'hello@world.com\nuser.name+tag@company.co.uk\ninvalid_email@domain', [segment('regex', 'one-or-more', '[a-zA-Z0-9._%+-]'), segment('custom', 'exactly', '@'), segment('regex', 'one-or-more', '[a-zA-Z0-9.-]'), segment('custom', 'exactly', '.'), segment('letter', 'range', '', { minValue: 2, maxValue: '' })]),
        preset('身份证号 (18位)', '只检查 18 位身份证格式和月、日字段范围，支持 x/X；不核验真实日期、行政区划或校验码。', '110101199003072345\n11010119951231888X\n110101199003072', [segment('regex', 'exactly', '[1-9]'), segment('digit', 'n-times', '', { nValue: 5 }), segment('regex', 'exactly', '(?:18|19|20)'), segment('digit', 'n-times', '', { nValue: 2 }), segment('regex', 'exactly', month), segment('regex', 'exactly', day), segment('digit', 'n-times', '', { nValue: 3 }), segment('regex', 'exactly', '[\\dxX]')]),
        preset('IP 地址 (IPv4)', '匹配 0–255 的四段 IPv4 地址，不接受多余前导零。', '192.168.1.1\n8.8.8.8\n256.0.0.1', [segment('regex', 'n-times', octet + '\\.', { nValue: 3 }), segment('regex', 'exactly', octet)]),
        preset('日期 (YYYY-MM-DD)', '检查 YYYY-MM-DD 格式，月份 01–12、日期字段 01–31；不检查月份天数或闰年。', '2026-10-11\n2020-12-31\n2025-13-45', [segment('digit', 'n-times', '', { nValue: 4 }), segment('custom', 'exactly', '-'), segment('regex', 'exactly', month), segment('custom', 'exactly', '-'), segment('regex', 'exactly', day)]),
        preset('纯数字', '匹配一个或多个数字，不包含负号、小数点或换行。', '123456789\n0\nabc123\n99.9', [segment('digit', 'one-or-more')]),
        preset('只筛选数字', '从混合文本中提取连续数字片段。', '订单 A-1024，共 3 件\n手机号：13812345678', [segment('digit', 'one-or-more')], 'none'),
        preset('只筛选字母', '从混合文本中提取连续英文字母，不包含数字、中文和符号。', 'abc123\nOpenAI 2026\n正则Regex工具', [segment('letter', 'one-or-more')], 'none'),
        preset('移除空格', '匹配连续空白字符；在自由测试与替换中替换为空，可移除空格、制表符与换行。', 'Hello World\n正 则 工 具\t17 Tools', [segment('whitespace', 'one-or-more')], 'none', ''),
        preset('中文字符', '匹配常用汉字，不包含数字、字母、标点或扩展区汉字。', '你好世界\nHello世界\n测试数据123', [segment('regex', 'one-or-more', '[\\u4e00-\\u9fff]')]),
        preset('URL 网址', '匹配常见 HTTP(S) 域名网址格式，支持长后缀、端口和路径；不检查可访问性，不覆盖所有 URL 类型。', 'https://example.technology\nhttps://www.example.com:8080/path?q=1#top\nftp://invalid.example.com', [segment('regex', 'exactly', 'https?'), segment('custom', 'exactly', '://'), segment('regex', 'one-or-more', '[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.'), segment('letter', 'range', '', { minValue: 2, maxValue: 63 }), segment('regex', 'optional', ':\\d{1,5}'), segment('regex', 'optional', '[/?#][^\\s]*')])
    ]);

    return { MAX_COUNT: MAX_COUNT, generate: generate, compileSegment: compileSegment, supportsWholeConstraints: supportsWholeConstraints, toLiteral: toLiteral, PRESETS: PRESETS };
}));
