(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../vendor/relationship/1.2.9/relationship.min.js'));
    } else {
        root.KinshipCore = factory(root.relationship);
    }
})(typeof window !== 'undefined' ? window : globalThis, function (relationship) {
    'use strict';

    const MAX_LENGTH = 48;
    const MAX_DEPTH = 6;
    const MAX_BRANCHES = 64;
    const STEPS = ['爸爸', '妈妈', '老公', '老婆', '哥哥', '弟弟', '姐姐', '妹妹', '儿子', '女儿'];
    const COMMON = ['我', ...STEPS, '爷爷', '奶奶', '外公', '外婆', '伯父', '叔叔', '姑姑', '舅舅', '姨妈',
        '堂哥', '堂弟', '堂姐', '堂妹', '表哥', '表弟', '表姐', '表妹', '侄子', '侄女', '外甥', '外甥女'];
    const EXAMPLES = [
        { label: '女儿与表弟', a: '女儿', b: '表弟', sex: 1 },
        { label: '儿子与姐姐', a: '儿子', b: '姐姐', sex: 1 },
        { label: '我与外婆', a: '我', b: '外婆', sex: 0 }
    ];

    function normalize(value) {
        return String(value == null ? '' : value).replace(/\s+/g, '').replace(/^我的/, '')
            .replace(/^(?:我|自己|本人)$/, '');
    }
    function display(value) {
        return value ? '我的' + value : '我';
    }
    function validate(value, label) {
        if (value.length > MAX_LENGTH) return { error: label + '的关系不超过 ' + MAX_LENGTH + ' 个字' };
        if (!value) return { branches: 1 };
        const segments = value.split('的');
        if (segments.length > MAX_DEPTH) return { error: label + '的关系最多连接 ' + MAX_DEPTH + ' 层，请缩短关系链' };
        let branches = 1, depth = 0;
        for (const segment of segments) {
            if (!segment) return { error: label + '的关系有空白环节，请用“爸爸的姐姐”这样的写法' };
            const chains = relationship({ text: segment, type: 'chain' });
            if (!chains.length) return { error: '无法识别' + label + '的“' + segment + '”，请使用常用称呼或关系按钮' };
            branches *= chains.length;
            depth += Math.max(...chains.map(chain => chain.split('的').length));
            if (branches > MAX_BRANCHES || depth > MAX_DEPTH) {
                return { error: label + '的关系过于复杂，请缩短关系链或明确家庭支系' };
            }
        }
        return { branches };
    }
    function commonName(name) {
        const suffixes = { 哥: '表哥', 兄: '表哥', 弟: '表弟', 姐: '表姐', 姊: '表姐', 妹: '表妹', 叔父: '表叔', 伯父: '表伯', 舅父: '表舅', 姑母: '表姑', 姨母: '表姨',
            侄子: '表侄子', 侄女: '表侄女', 甥男: '表外甥', 甥女: '表外甥女' };
        const match = name.match(/^(?:(?:姑|舅|姨)表|姨(?=[哥弟姐妹]$))(.+)$/);
        return match && suffixes[match[1]] || name;
    }
    function result(names) {
        const precise = Array.from(new Set(names));
        return { names: Array.from(new Set(precise.map(commonName))), precise };
    }
    const chainWords = { f: '爸爸', m: '妈妈', h: '老公', w: '老婆', ob: '哥哥', lb: '弟弟', xb: '兄弟', os: '姐姐', ls: '妹妹', xs: '姐妹', s: '儿子', d: '女儿' };
    let conditionIndex;
    function chainParts(chain) {
        return chain.replace(/^\((?:男性|女性)\)/, '').split('的');
    }
    function compatibleChain(candidate, actual) {
        const left = chainParts(candidate), right = chainParts(actual);
        return left.length === right.length && left.every((word, index) => {
            const other = right[index];
            return word === other || (word === '兄弟' && ['哥哥', '弟弟'].includes(other)) ||
                (other === '兄弟' && ['哥哥', '弟弟'].includes(word)) ||
                (word === '姐妹' && ['姐姐', '妹妹'].includes(other)) ||
                (other === '姐妹' && ['姐姐', '妹妹'].includes(word));
        });
    }
    function selectorCondition(selector, source, actual) {
        const tokens = selector ? selector.split(',') : [];
        let gender = '';
        if (/^[01]$/.test(tokens[0])) gender = tokens.shift() === '0' ? '女性' : '男性';
        const codes = tokens.map(token => token.split('&')[0]);
        if (codes.some(code => !chainWords[code])) return null;
        const words = codes.map(code => chainWords[code]);
        const chain = (gender ? '(' + gender + ')' : '') + words.join('的');
        if (actual) chainParts(actual).forEach((word, index) => {
            if (words[index] === '兄弟' && ['哥哥', '弟弟'].includes(word) || words[index] === '姐妹' && ['姐姐', '妹妹'].includes(word)) words[index] = word;
        });
        let generation = 0;
        const explained = words.map((word, index) => {
            const code = codes[index];
            generation += code === 'f' || code === 'm' ? 1 : code === 's' || code === 'd' ? -1 : 0;
            const age = tokens[index].split('&')[1];
            if (!age) return word;
            // 堂表亲的年龄参照在同一代：表哥对本人，表伯对父亲；姻亲先以配偶为参照。
            const spouse = codes[0] === 'h' || codes[0] === 'w' ? 1 : 0;
            const ancestors = codes.slice(spouse, spouse + generation);
            if (generation < 0 || ancestors.length !== generation || ancestors.some(item => item !== 'f' && item !== 'm')) return word + '（具体称谓中的长幼）';
            const referenceParts = [...codes.slice(0, spouse), ...ancestors].map(item => chainWords[item]);
            const reference = source + (referenceParts.length ? ' 的' + referenceParts.join('的') : '');
            return word + '（比 ' + reference + (age === 'o' ? ' 年长' : ' 年幼') + '）';
        });
        return { chain, description: source + ' 的' + explained.join('的') + (gender ? '（' + source + ' 为' + gender + '）' : '') };
    }
    function possibilities(value, chains, source, target) {
        // 数据表是库提供的公开属性；索引只建一次，保留 chain 查询省略的 &o / &l 标记。
        if (!conditionIndex) {
            conditionIndex = new Map();
            relationship.data.forEach((names, selector) => {
                if (selector.includes('[') || selector.split(',').length > MAX_DEPTH * 2 + 1) return;
                if (!conditionIndex.has(names[0])) conditionIndex.set(names[0], []);
                conditionIndex.get(names[0]).push(selector);
            });
        }
        return value.names.map(name => {
            const conditions = new Set();
            value.precise.filter(precise => commonName(precise) === name).forEach(precise => {
                if (precise === '自己') { conditions.add('A 和 B 的关系链指向同一个人'); return; }
                const selectors = conditionIndex.get(precise) || [];
                let explained = false;
                selectors.forEach(selector => {
                    const condition = selectorCondition(selector, source);
                    if (!condition) return;
                    const actual = chains.find(chain => compatibleChain(condition.chain, chain));
                    if (actual) {
                        conditions.add(target + ' 是 ' + selectorCondition(selector, source, actual).description);
                        explained = true;
                    }
                });
                if (!explained) {
                    relationship({ text: precise, type: 'chain' }).filter(chain => chains.some(actual => compatibleChain(chain, actual))).forEach(chain => {
                        conditions.add(target + ' 是 ' + source + ' 的' + chain + '（具体称谓：' + precise + '）');
                    });
                }
            });
            return { name, conditions: Array.from(conditions) };
        });
    }
    function calculate(input) {
        input = input || {};
        const a = normalize(input.a), b = normalize(input.b);
        const sex = input.sex;
        if (sex !== 0 && sex !== 1) return { ok: false, error: '请选择“我”的性别' };
        if (typeof relationship !== 'function') return { ok: false, error: '亲属称呼库未加载，请刷新页面后重试' };
        try {
            const av = validate(a, 'A'), bv = validate(b, 'B');
            if (av.error || bv.error) return { ok: false, error: av.error || bv.error };
            if (av.branches * bv.branches > MAX_BRANCHES) {
                return { ok: false, error: '两人的关系分支过多，请把堂表亲展开成具体关系链' };
            }
            if (!a && !b) return { ok: true, a, b, sex, forward: result(['自己']), reverse: result(['自己']), roles: { a: ['我'], b: ['我'] }, possibilities: null };
            // 库不接受空 text；被称呼者是本人时交换查询并翻转方向。
            const query = b ? { text: b, target: a, sex } : { text: a, target: b, sex };
            const forward = result(relationship({ ...query, reverse: !b }));
            const reverse = result(relationship({ ...query, reverse: !!b }));
            if (!forward.names.length && !reverse.names.length) {
                return { ok: false, error: '未找到适用称呼，请检查性别、夫妻关系或改用更具体的关系链' };
            }
            const role = text => text ? result(relationship({ text, sex })).names : ['我'];
            const ambiguous = forward.precise.length > 1 || reverse.precise.length > 1;
            const details = ambiguous ? {
                forward: possibilities(forward, relationship({ ...query, reverse: !b, type: 'chain' }), 'A', 'B'),
                reverse: possibilities(reverse, relationship({ ...query, reverse: !!b, type: 'chain' }), 'B', 'A')
            } : null;
            return { ok: true, a, b, sex, forward, reverse, roles: { a: role(a), b: role(b) }, possibilities: details };
        } catch (error) {
            return { ok: false, error: '这组关系暂时无法计算，请改用更短、更具体的关系链' };
        }
    }
    function append(value, step) {
        const normalized = normalize(value);
        return normalized ? normalized + '的' + step : step;
    }
    function back(value) {
        return normalize(value).split('的').slice(0, -1).join('的');
    }
    function segments(value) {
        const normalized = normalize(value);
        return normalized ? normalized.split('的') : [];
    }
    function replaceSegment(value, index, role) {
        const chain = segments(value);
        if (!Number.isInteger(index) || index < 0 || index > chain.length) {
            return { ok: false, error: '请先选择要更换的关系节点' };
        }
        if (!COMMON.includes(role) || role === '我') {
            return { ok: false, error: '请选择一个亲属角色' };
        }
        chain[index] = role;
        const next = chain.join('的');
        if (chain.length > MAX_DEPTH || next.length > MAX_LENGTH) {
            return { ok: false, error: '关系最多 6 层、48 个字，请先缩短关系链' };
        }
        return { ok: true, value: next };
    }
    function removeSegment(value, index) {
        const chain = segments(value);
        if (!Number.isInteger(index) || index < 0 || index >= chain.length) {
            return { ok: false, error: '请选择要删除的关系节点' };
        }
        chain.splice(index, 1);
        return { ok: true, value: chain.join('的') };
    }
    return { MAX_LENGTH, MAX_DEPTH, MAX_BRANCHES, STEPS, COMMON, EXAMPLES, normalize, display, calculate, append, back, segments, replaceSegment, removeSegment };
});
