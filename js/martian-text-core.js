(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./text-budget-core.js'));
    else root.MartianTextCore = factory(root.TextBudgetCore);
}(typeof self !== 'undefined' ? self : this, function (budget) {
    'use strict';
        // 火星文字典映射
        const martianMap = {
            '我': '硪', '的': '啲', '爱': '僾', '你': '伱', '是': '媞', '不': '吥', '了': 'ㄋ', '在': '恠',
            '好': '恏', '说': '説', '想': '厢', '很': '狠', '真': '眞', '这': '这', '吗': '嘛', '会': '哙',
            '有': '囿', '就': '僦', '都': '嘟', '对': '怼', '起': '唘', '什': '什', '么': '庅', '大': '汏',
            '家': '傢', '太': '冭', '小': '尐', '没': '莈', '还': '遦', '走': '赱', '看': '阭', '见': '笕',
            '到': '菿', '得': '嘚', '啊': '吖', '哦': '喔', '哈': '铪', '和': '啝', '那': '那', '些': '些',
            '人': '亾', '个': '个', '天': '兲', '心': '杺', '里': '哩', '生': '泩', '为': '沩', '来': '唻',
            '去': '厾', '能': '螚', '做': '莋', '事': '倳', '如': '侞', '果': '淉', '被': '被', '要': '崾',
            '把': '妑', '让': '让', '只': '呮', '可': '苛', '以': '苡', '之': '之', '所': '所', '一': '①',
            '二': '②', '三': '③', '四': '④', '五': '⑤', '六': '⑥', '七': '⑦', '八': '⑧', '九': '⑨',
            '十': '⑩', '男': '莮', '女': '囡', '泪': '汨', '伤': '殇', '悲': '棑', '痛': '嗵', '死': '屍',
            '忘': '莣', '记': '汜', '亲': '儭', '宝': '寳', '贝': '唄', '最': '蕞', '懂': '董', '错': '諎',
            '别': '莂', '欢': '飌', '笑': '咲', '哭': '梪', '觉': '灚', '梦': '儚', '多': '哆', '少': '仯',
            '远': '逺', '近': '迬', '明': '朙', '暗': '闇', '星': '猩', '月': '刖', '云': '囩', '风': '颩',
            '雨': '傴', '雪': '膤', '花': '婲', '草': '愺', '树': '樹', '山': '屾', '水': '氺', '火': '焱',
            '光': '灮', '影': '巛', '黑': '潶', '白': '皌', '红': '荭', '绿': '淥', '蓝': '嚲', '黄': '騜',
            '她': '咃', '他': '祂', '它': '牠', '们': '扪', '给': '給', '等': '僜', '谁': '誰', '哪': '哪',
            '快': '加快', '乐': '泺', '痛': '痌', '苦': '楛', '爱': '璦', '情': '凊', '友': '叐', '谊': '誼'
        };

        const specialSymbols = ['灬', '丶', '丿', 'oοΟ', '°', '·', '≈', '╬', '╭ァ', 'ゞ', '☆', '★', '○', '●'];


    function* fallbackGraphemes(text) {
        var group = '', previous = '', regional = 0;
        for (var char of text) {
            var ri = /[\u{1F1E6}-\u{1F1FF}]/u.test(char);
            var joins = /\p{Mark}|[\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}]/u.test(char) || char === '\u200d' || previous === '\u200d' || (ri && regional % 2 === 1);
            if (group && !joins) { yield group; group = ''; }
            group += char;
            regional = ri ? regional + 1 : 0;
            previous = char;
        }
        if (group) yield group;
    }
    function* graphemes(text, forceFallback) {
        if (!forceFallback && typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
            var segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
            for (var item of segmenter.segment(text)) yield item.segment;
        } else yield* fallbackGraphemes(text);
    }
    function convert(text, options, random) {
        var source = String(text == null ? '' : text), opts = options || {};
        if (budget) { var check = budget.check(source); if (!check.ok) return { ok: false, reason: check.reason, text: '' }; }
        var rate = opts.decorate ? (opts.rate === 0.15 ? 0.15 : 0.05) : 0;
        var rng = typeof random === 'function' ? random : Math.random;
        var result = '';
        for (var char of graphemes(source, opts.forceFallback)) {
            result += martianMap[char] || char;
            if (rate && char.trim() && rng() < rate) {
                var index = Math.max(0, Math.min(specialSymbols.length - 1, Math.floor(rng() * specialSymbols.length)));
                result += specialSymbols[index];
            }
            if (budget && result.length > budget.LIMITS.outputChars) return { ok: false, reason: '结果超过400万字符，请分批处理；原文已保留', text: '' };
        }
        return { ok: true, text: result, reason: '' };
    }
    return { convert: convert, graphemes: graphemes };
}));
