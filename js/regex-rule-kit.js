(function () {
    'use strict';
    const core = window.RegexToolCore;
    const card = document.getElementById('rule-kit');
    if (!core || !card) return;
    const fields = { pattern: document.getElementById('kit-pattern'), flags: document.getElementById('kit-flags'), ruleVersion: document.getElementById('kit-version'), description: document.getElementById('kit-description') };
    const casesElement = document.getElementById('kit-cases');
    const status = document.getElementById('kit-status');
    const output = document.getElementById('kit-results');
    const runButton = document.getElementById('kit-run');
    const session = window.RegexToolUi.createValidationSession();
    let cases = [{ name: '应匹配样例', text: '123', expectMatch: true, expectedMatches: null }, { name: '不应匹配样例', text: 'abc', expectMatch: false, expectedMatches: null }];
    let token = 0;
    let running = false;
    let lastResults = null;
    let lastSnapshot = '';

    function setStatus(text) { status.textContent = text; }
    function setRunning(value) { running = value; runButton.textContent = value ? '取消校验' : '校验全部样例'; runButton.setAttribute('aria-busy', String(value)); }
    function invalidate() {
        token += 1;
        session.cancel();
        setRunning(false);
        lastResults = null;
        lastSnapshot = '';
        output.replaceChildren();
        setStatus('规则或样例已变化，请重新校验；正文仅在本次页面，未保存到浏览器');
    }
    function currentKit() {
        return core.normalizeRuleKit({ schemaVersion: 1, engine: 'JavaScript', pattern: fields.pattern.value, flags: fields.flags.value, ruleVersion: fields.ruleVersion.value, description: fields.description.value, cases: cases });
    }
    function makeControl(labelText, element, id) {
        const wrap = document.createElement('div');
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = labelText;
        element.id = id;
        element.className = element.tagName === 'SELECT' ? 'form-select' : 'form-input';
        wrap.append(label, element);
        return wrap;
    }
    function renderCases() {
        casesElement.replaceChildren();
        cases.forEach(function (entry, index) {
            const row = document.createElement('div');
            row.className = 'kit-case';
            const name = document.createElement('input');
            name.value = entry.name;
            name.maxLength = 100;
            name.addEventListener('input', function () { entry.name = name.value; invalidate(); });
            const text = document.createElement('textarea');
            text.value = entry.text;
            text.rows = 3;
            text.maxLength = core.RULE_KIT_LIMITS.maxCaseChars;
            text.addEventListener('input', function () { entry.text = text.value; entry.expectedMatches = null; baseline.textContent = '预期：是否匹配（尚未确认精确内容）'; invalidate(); });
            const expect = document.createElement('select');
            [[true, '应该找到匹配'], [false, '不应找到匹配']].forEach(function (pair) { const option = document.createElement('option'); option.value = String(pair[0]); option.textContent = pair[1]; expect.appendChild(option); });
            expect.value = String(entry.expectMatch);
            expect.addEventListener('change', function () { entry.expectMatch = expect.value === 'true'; entry.expectedMatches = null; baseline.textContent = '预期：是否匹配（尚未确认精确内容）'; invalidate(); });
            const baseline = document.createElement('p');
            baseline.className = 'kit-baseline';
            baseline.textContent = entry.expectedMatches == null ? '预期：是否匹配（尚未确认精确内容）' : '已确认精确预期：' + entry.expectedMatches.length + ' 条，包含内容、位置与捕获组';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'btn-action-reset';
            remove.textContent = '删除样例';
            remove.setAttribute('aria-label', '删除样例 ' + (index + 1));
            remove.addEventListener('click', function () { cases.splice(index, 1); invalidate(); renderCases(); });
            row.append(makeControl('样例 ' + (index + 1) + ' 名称', name, 'kit-name-' + index), makeControl('完整测试正文（可以留空）', text, 'kit-text-' + index), makeControl('我预期的结果', expect, 'kit-expect-' + index), baseline, remove);
            if (entry.expectedMatches != null) {
                const clear = document.createElement('button');
                clear.type = 'button';
                clear.className = 'btn-action-reset';
                clear.textContent = '改为仅判断是否匹配';
                clear.addEventListener('click', function () { entry.expectedMatches = null; invalidate(); renderCases(); });
                row.appendChild(clear);
            }
            casesElement.appendChild(row);
        });
    }
    async function run() {
        if (running) { invalidate(); setStatus('已取消校验；当前规则与样例仍保留'); return; }
        let kit;
        try { kit = currentKit(); } catch (error) { setStatus(error.message); return; }
        if (!kit.cases.length) { setStatus('请先添加至少一个样例再校验'); return; }
        const myToken = ++token;
        session.cancel();
        setRunning(true);
        output.replaceChildren();
        const results = [];
        try {
            for (let i = 0; i < kit.cases.length; i += 1) {
                setStatus('正在校验样例 ' + (i + 1) + ' / ' + kit.cases.length + '（JavaScript，flags: ' + (kit.flags || '无') + '）');
                const outcome = await session.evaluateAsync({ rawRegex: '/' + kit.pattern + '/' + kit.flags, flags: kit.flags, testText: kit.cases[i].text, replacement: '' });
                if (myToken !== token) return;
                const result = outcome.kind === 'result' ? core.checkRuleCase(kit.cases[i], outcome.result) : { passed: false, complete: false, message: outcome.message || '后台未能完成，不能判为通过' };
                results.push(result);
                const item = document.createElement('li');
                item.textContent = kit.cases[i].name + '：' + (result.passed ? '通过' : result.complete ? '未通过' : '未完成') + '；' + result.message;
                output.appendChild(item);
            }
            lastResults = results;
            lastSnapshot = JSON.stringify(kit);
            setStatus('校验完成：' + results.filter(function (item) { return item.passed; }).length + ' / ' + results.length + ' 通过；观察结果需要你确认，才可作为精确预期');
        } catch (error) { if (myToken === token) setStatus('校验失败：' + error.message); }
        finally { if (myToken === token) setRunning(false); }
    }
    function importText(json) {
        const kit = core.parseRuleKit(json);
        // Parsing and all bounds complete before any current input changes.
        invalidate();
        Object.keys(fields).forEach(function (key) { fields[key].value = kit[key]; });
        cases = kit.cases;
        renderCases();
        setStatus('已导入 JavaScript 规则版本 ' + kit.ruleVersion + ' 与 ' + cases.length + ' 个样例；请点击校验，未写入本机存储');
        return kit;
    }
    Object.values(fields).forEach(function (element) { element.addEventListener('input', invalidate); });
    runButton.addEventListener('click', run);
    document.getElementById('kit-add').addEventListener('click', function () {
        if (cases.length >= core.RULE_KIT_LIMITS.maxCases) { setStatus('最多添加 32 个样例'); return; }
        cases.push({ name: '样例 ' + (cases.length + 1), text: '', expectMatch: true, expectedMatches: null });
        invalidate(); renderCases();
    });
    document.getElementById('kit-capture').addEventListener('click', function () {
        try {
            if (!lastResults || lastSnapshot !== JSON.stringify(currentKit()) || !lastResults.length || !lastResults.every(function (result) { return result.complete && result.passed; })) throw new Error('请先校验，并让每个样例符合你选择的应匹配/不应匹配预期；未完成或失败的观察不能作精确预期');
            const nextCases = cases.map(function (entry, i) { return Object.assign({}, entry, { expectedMatches: lastResults[i].observed }); });
            core.serializeRuleKit(Object.assign({}, currentKit(), { cases: nextCases }));
            cases = nextCases;
            invalidate(); renderCases();
            setStatus('已按你的确认采用完整匹配内容、位置及分组作精确预期；修改规则后可用这些样例检查变化');
        } catch (error) { setStatus(error.message); }
    });
    function readCurrent(source) {
        try {
            let parsed;
            if (source === 'visual') parsed = { pattern: document.getElementById('resultRegexInput').value, flags: document.getElementById('resultRegexFlags').textContent };
            else parsed = core.parseRegexLiteral(document.getElementById('regexInput').value, Array.from(document.querySelectorAll('#flagsPanel [data-flag]:checked')).map(function (input) { return input.dataset.flag; }).join(''));
            if (!parsed.pattern || parsed.pattern === '...') throw new Error('请先配置一个有效的表达式');
            new RegExp(parsed.pattern, parsed.flags);
            invalidate();
            fields.pattern.value = parsed.pattern;
            fields.flags.value = parsed.flags;
            fields.description.value = source === 'visual' ? document.getElementById('explanationContent').textContent.slice(0, 2000) : core.explainPattern(parsed.pattern).map(function (item) { return item.description; }).join('；').slice(0, 2000);
            setStatus('已读取' + (source === 'visual' ? '生成器' : '自由测试') + '的 JavaScript 规则；flags: ' + (parsed.flags || '无') + '，请重新校验样例');
        } catch (error) { setStatus('读取失败：' + error.message); }
    }
    document.getElementById('kit-from-visual').addEventListener('click', function () { readCurrent('visual'); });
    document.getElementById('kit-from-manual').addEventListener('click', function () { readCurrent('manual'); });
    document.getElementById('kit-export').addEventListener('click', function () {
        try {
            const json = core.serializeRuleKit(currentKit());
            const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'javascript-regex-rule-kit.json';
            link.click();
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
            setStatus('已导出当前规则与预期样例；未确认精确内容的样例仅断言是否匹配');
        } catch (error) { setStatus('无法导出：' + error.message); }
    });
    const importInput = document.getElementById('kit-import-file');
    document.getElementById('kit-import').addEventListener('click', function () { importInput.click(); });
    importInput.addEventListener('change', async function () {
        const file = importInput.files[0];
        importInput.value = '';
        if (!file) return;
        if (file.size > core.RULE_KIT_LIMITS.maxBytes) { setStatus('导入失败：文件上限为 512KB；当前输入未改变'); return; }
        const readToken = token;
        try {
            const json = await file.text();
            if (readToken !== token) throw new Error('读取文件期间当前内容已变化，请重新导入');
            importText(json);
        } catch (error) { setStatus('导入失败：' + error.message + '；当前输入未改变'); }
    });
    window.addEventListener('pagehide', function () { token += 1; session.cancel(); });
    window.RegexRuleKitUi = { importText: importText, currentKit: currentKit, run: run };
    renderCases();
}());
