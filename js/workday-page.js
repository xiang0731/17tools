(function () {
    'use strict';
    const core = window.WorkdayCore;
    if (!core) return;
    const make = (tag, text, props) => { const node = document.createElement(tag); if (text != null) node.textContent = text; Object.assign(node, props || {}); return node; };
    function mount(container, index) {
        const prefix = 'workday-' + index + '-', controls = {};
        container.classList.add('workday-panel');
        const heading = make('h2', '工作日计算');
        const note = make('p', '按公历日计算，不把节日名称当作放假。规则与自定义日期只留在本次页面，不上传或默认保存。', { className: 'workday-note' });
        const form = make('div', null, { className: 'workday-form' });
        function field(key, title, tag, props) {
            const wrap = make('div', null, { className: 'workday-field' });
            const id = prefix + key, label = make('label', title, { htmlFor: id });
            const node = make(tag || 'input', null, { id, className: 'form-input', ...(props || {}) });
            controls[key] = node;
            const error = make('p', '', { id: id + '-error', className: 'workday-error' });
            node.setAttribute('aria-describedby', error.id); wrap.append(label, node, error); form.append(wrap); return node;
        }
        const mode = field('mode', '计算方式', 'select');
        mode.append(make('option', '偏移 N 个工作日', { value: 'offset' }), make('option', '区间工作日计数', { value: 'count' }));
        const local = new Date(), today = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
        field('start', '起始日期', 'input', { type: 'date', min: '1900-01-01', max: '2100-12-31', value: today });
        field('amount', '工作日数量（整数，可为负）', 'input', { type: 'text', inputMode: 'numeric', value: '5' });
        const end = field('end', '结束日期', 'input', { type: 'date', min: '1900-01-01', max: '2100-12-31', value: today });
        const weekendWrap = make('fieldset', null, { className: 'workday-weekend' }); weekendWrap.append(make('legend', '通常休息的星期（可多选）'));
        ['日', '一', '二', '三', '四', '五', '六'].forEach((name, day) => {
            const input = make('input', null, { type: 'checkbox', value: String(day), checked: day === 0 || day === 6 });
            input.dataset.workdayWeekend = String(day);
            const label = make('label'); label.append(input, document.createTextNode('周' + name)); weekendWrap.append(label);
        });
        form.append(weekendWrap);
        function check(key, text, checked) { const label = make('label', null, { className: 'workday-check' }); const input = make('input', null, { type: 'checkbox', checked }); controls[key] = input; label.append(input, document.createTextNode(text)); form.append(label); return input; }
        check('official', '使用已核验的中国法定放假/补班数据', true);
        check('includeStart', '包含起始日（若是工作日，算作第 1 天）', false);
        check('includeEnd', '区间包含结束日', true);
        field('rest', '自定义休息日期（YYYY-MM-DD，以空格或逗号分隔）', 'textarea', { rows: 2 });
        field('work', '自定义补班日期（同样格式，不能和休息重复）', 'textarea', { rows: 2 });
        const provenance = make('p', '', { className: 'workday-note' });
        const actions = make('div', null, { className: 'workday-actions' });
        const calculate = make('button', '计算工作日', { type: 'button', className: 'btn btn-primary' });
        const clear = make('button', '清空自定义例外', { type: 'button', className: 'btn btn-secondary' }); actions.append(calculate, clear);
        const result = make('div', '', { className: 'workday-result' }); result.setAttribute('role', 'status');
        function readRules() {
            return { weekend: [...weekendWrap.querySelectorAll('input:checked')].map(el => Number(el.value)), rest: controls.rest.value, work: controls.work.value, official: controls.official.checked, includeStart: controls.includeStart.checked, includeEnd: controls.includeEnd.checked };
        }
        function sourceSummary() {
            provenance.replaceChildren();
            if (!controls.official.checked) { provenance.textContent = '当前仅按所选周末和自定义例外估算，未使用法定调休数据。'; return; }
            const known = Object.keys(core.official).join('、');
            provenance.append(document.createTextNode(`已核验年份：${known || '无'}；其余年份仅按周末及自定义例外估算，不猜调休。来源：`));
            Object.entries(core.official).forEach(([year, record], i) => {
                if (i) provenance.append(document.createTextNode('；'));
                const link = make('a', `${year} 年国务院通知（核验 ${record.verified}）`, { href: record.source, target: '_blank', rel: 'noopener noreferrer' }); provenance.append(link);
            });
        }
        function clearErrors() { form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid')); form.querySelectorAll('.workday-error').forEach(el => { el.textContent = ''; }); }
        function showError(message, key) { result.textContent = message; const input = controls[key]; if (input) { input.setAttribute('aria-invalid', 'true'); const error = document.getElementById(input.id + '-error'); if (error) error.textContent = message; input.focus(); } }
        function calculateNow() {
            clearErrors(); const config = readRules(); let computed;
            if (core.parseDate(controls.start.value) == null) { showError('请输入有效起始日期（1900–2100）。', 'start'); return; }
            if (mode.value === 'count') {
                if (core.parseDate(end.value) == null) { showError('请输入有效结束日期（1900–2100）。', 'end'); return; }
                computed = core.count(controls.start.value, end.value, config);
            } else {
                const raw = controls.amount.value.trim(), amount = Number(raw);
                if (!/^[+-]?\d+$/.test(raw) || !Number.isSafeInteger(amount)) { showError('工作日数量必须是完整整数，不能截断小数。', 'amount'); return; }
                computed = core.offset(controls.start.value, amount, config);
            }
            if (!computed.ok) { showError(computed.message, computed.field || 'amount'); return; }
            result.textContent = mode.value === 'count'
                ? `${controls.start.value} 至 ${end.value}：${computed.absoluteCount} 个工作日（方向计数 ${computed.count}），纳入 ${computed.calendarDays} 个公历日。`
                : `${controls.start.value} ${computed.amount >= 0 ? '向后' : '向前'} ${Math.abs(computed.amount)} 个工作日：${computed.date}。${config.includeStart ? '已包含符合规则的起始日。' : '未把起始日算作第1天。'}`;
            if (computed.missingYears.length) result.append(document.createTextNode(` ${computed.missingYears.join('、')} 年未载入法定调休，仅按周末及自定义例外估算。`));
            else result.append(document.createTextNode(' 涉及年份均已载入核验的法定调休，单位/个人安排请用自定义例外覆盖。'));
        }
        function syncMode() { controls.amount.parentElement.hidden = mode.value === 'count'; end.parentElement.hidden = mode.value !== 'count'; controls.includeEnd.parentElement.hidden = mode.value !== 'count'; }
        mode.addEventListener('change', () => { controls.includeStart.checked = mode.value === 'count'; syncMode(); result.textContent = ''; });
        calculate.addEventListener('click', calculateNow);
        clear.addEventListener('click', () => { controls.rest.value = controls.work.value = ''; clearErrors(); result.textContent = '自定义例外已清空。'; container.dispatchEvent(new CustomEvent('workday-rules-change', { detail: readRules() })); });
        form.addEventListener('input', () => { clearErrors(); result.textContent = '规则或输入已更改，请重新计算。'; sourceSummary(); container.dispatchEvent(new CustomEvent('workday-rules-change', { detail: readRules() })); });
        container.append(heading, note, form, provenance, actions, result);
        container.workdayApi = { readRules, setStart(date) { controls.start.value = date; result.textContent = '已使用万年历选中日期，请计算。'; }, calculate: calculateNow };
        syncMode(); sourceSummary();
    }
    const init = () => document.querySelectorAll('[data-workday-panel]').forEach(mount);
    // 页脚运行时占位区已解析；先填默认控件，再让离开保护采集初始基线。
    if (document.querySelector('[data-workday-panel]')) init();
    else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
})();
