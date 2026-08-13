# History Changelog Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformat versions 2.12.0 through 2.14.1 so each version has one update card containing only populated sections from the three-category taxonomy, while consolidating repetitive entries.

**Architecture:** Keep the existing static timeline and CSS unchanged. Add one string-based Node regression test that isolates each target version by its HTML comment, validates card/category structure, and protects representative consolidated content; then replace only the target version blocks in `items/History.html`.

**Tech Stack:** Static HTML/CSS, Node.js ESM, `node:assert/strict`

---

### Task 1: Add a failing changelog structure regression

**Files:**
- Create: `regression-tests/history-layout.mjs`
- Test: `regression-tests/history-layout.mjs`

- [ ] **Step 1: Write the structural regression test**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';

const history = fs.readFileSync('items/History.html', 'utf8');
const targetVersions = ['2.14.1', '2.14.0', '2.13.1', '2.13.0', '2.12.0'];
const expectedCategories = new Map([
    ['2.14.1', ['新功能', '逻辑变更与优化', '缺陷修复']],
    ['2.14.0', ['新功能', '逻辑变更与优化', '缺陷修复']],
    ['2.13.1', ['缺陷修复']],
    ['2.13.0', ['逻辑变更与优化', '缺陷修复']],
    ['2.12.0', ['新功能', '逻辑变更与优化', '缺陷修复']]
]);

function getVersionBlock(version) {
    const startMarker = `<!-- 版本 ${version} -->`;
    const start = history.indexOf(startMarker);
    assert.notEqual(start, -1, `Missing version ${version}`);

    const nextVersion = history.indexOf('<!-- 版本 ', start + startMarker.length);
    return history.slice(start, nextVersion === -1 ? history.length : nextVersion);
}

for (const version of targetVersions) {
    const block = getVersionBlock(version);
    const cards = block.match(/<div class="update-list">/g) ?? [];
    assert.equal(cards.length, 1, `${version} should contain exactly one update-list card`);

    const categories = [...block.matchAll(/<div class="feature-category">([^<]+)<\/div>/g)]
        .map((match) => match[1]);
    assert.deepEqual(categories, expectedCategories.get(version), `${version} categories should match the approved taxonomy`);

    for (let index = 0; index < categories.length; index += 1) {
        const categoryStart = block.indexOf(`<div class="feature-category">${categories[index]}</div>`);
        const nextCategory = index + 1 < categories.length
            ? block.indexOf(`<div class="feature-category">${categories[index + 1]}</div>`, categoryStart)
            : block.length;
        assert.match(block.slice(categoryStart, nextCategory), /<li>/, `${version} ${categories[index]} should not be empty`);
    }
}

for (const text of [
    '新增浏览器回归测试，覆盖 HTML 注入防护',
    '轮胎选择器：新增独立工具页和侧栏入口',
    '侧栏菜单：修复工具分组 DOM 结构错位',
    '主题同步：父窗口监听增加同源和节点有效性判断',
    '接口带宽计算工具：支持 Thunderbolt 3/4/5'
]) {
    assert.ok(history.includes(text), `Missing consolidated changelog content: ${text}`);
}

console.log('history-layout regression passed');
```

- [ ] **Step 2: Run the regression test and confirm the current structure fails**

Run: `node regression-tests/history-layout.mjs`

Expected: FAIL with `2.14.1 should contain exactly one update-list card` because the current version blocks use multiple cards and nonstandard category names.

- [ ] **Step 3: Commit the failing regression without including unrelated staged work**

```bash
git add -- regression-tests/history-layout.mjs
git commit --only -m "test: cover changelog card structure" -- regression-tests/history-layout.mjs
```

### Task 2: Consolidate version cards and entries

**Files:**
- Modify: `items/History.html:306-482`
- Test: `regression-tests/history-layout.mjs`

- [ ] **Step 1: Replace the 2.14.1 categories with one card and the approved consolidated entries**

Use one `.update-list` containing these populated sections in order:

```html
<div class="feature-category">新功能</div>
<ul>
    <li><span class="tag new">新增</span>新增浏览器回归测试，覆盖 HTML 注入防护、链接参数保留、夏令时边界、月末计算和农历转换</li>
</ul>
<div class="feature-category">逻辑变更与优化</div>
<ul>
    <li><span class="tag improved">优化</span>研发工具：输入变化时取消过期的代码生成任务，避免旧结果覆盖最新内容</li>
    <li><span class="tag improved">优化</span>时间计算：自然月和自然年加减采用月末截断规则，并同步应用到批量计算</li>
    <li><span class="tag improved">优化</span>链接清理工具：针对 Amazon 和 YouTube 应用站点专属规则；没有移除参数时保留原始链接文本</li>
</ul>
<div class="feature-category">缺陷修复</div>
<ul>
    <li><span class="tag fixed">修复</span>Markdown 编辑器：加固预览内容净化，递归检查未知标签的后代节点，并完整移除脚本、样式、内嵌页面和 SVG 等危险内容</li>
    <li><span class="tag fixed">修复</span>计算器、代码格式化与研发工具：用户输入、错误信息和代码预览统一按纯文本渲染，防止恶意 HTML 被执行</li>
    <li><span class="tag fixed">修复</span>万年历与时间计算：改用时区无关的自然日基准，避免夏令时造成日期间隔偏差，并确保公历与农历转换结果一致</li>
    <li><span class="tag fixed">修复</span>链接清理工具：收紧追踪参数规则，保留搜索词、商品规格和来源状态等可能影响页面内容的业务参数</li>
</ul>
```

- [ ] **Step 2: Replace the 2.14.0 categories with one card and merge overlapping tool descriptions**

```html
<div class="feature-category">新功能</div>
<ul>
    <li><span class="tag new">新增</span>轮胎选择器：新增独立工具页和侧栏入口，支持胎宽、扁平比和轮毂直径联动选择，并提供规格估算、参数解释、购买参考和匹配度</li>
    <li><span class="tag new">新增</span>火星文转换器：新增非主流火星文转换工具，找回曾经的非主流记忆</li>
</ul>
<div class="feature-category">逻辑变更与优化</div>
<ul>
    <li><span class="tag improved">优化</span>轮胎选择器：按常见量产轮胎规格约束扁平比和轮毂选项，避免明显不合理组合，并将无效组合自动收敛到接近的常见规格</li>
    <li><span class="tag improved">优化</span>轮胎选择器：优化胎宽、轮毂和胎壁指示器视觉，降低突兀感并保持移动端可读</li>
    <li><span class="tag improved">优化</span>火星文转换器：统一使用类似文本替换工具的现代化响应式布局</li>
</ul>
<div class="feature-category">缺陷修复</div>
<ul>
    <li><span class="tag fixed">修复</span>轮胎选择器：修复不同胎宽下轮胎图形被横向拉伸的问题，轮毂尺寸按真实比例显示</li>
    <li><span class="tag fixed">修复</span>轮胎选择器：修复深色主题下选择区背景出现横向异常色带的问题</li>
    <li><span class="tag fixed">修复</span>火星文转换器：修复深色主题下背景色及相关样式不生效的问题</li>
</ul>
```

- [ ] **Step 3: Put the two 2.13.1 fixes in one card with no empty categories**

```html
<div class="feature-category">缺陷修复</div>
<ul>
    <li><span class="tag fixed">修复</span>侧栏菜单：修复工具分组 DOM 结构错位导致分组间距不一致的问题</li>
    <li><span class="tag fixed">修复</span>更新历史：修复连续更新卡片之间缺少间距的问题</li>
</ul>
```

- [ ] **Step 4: Replace the 2.13.0 categories with one card and consolidate related fixes**

```html
<div class="feature-category">逻辑变更与优化</div>
<ul>
    <li><span class="tag improved">优化</span>主题同步：父窗口监听增加同源和节点有效性判断，iframe 消息使用计算后的目标 origin，提升异常环境下的稳定性与安全性</li>
    <li><span class="tag improved">优化</span>代码格式化：输出区滚动同步监听改为初始化时单次绑定，避免多次格式化后重复监听</li>
    <li><span class="tag improved">优化</span>版本与文档：Welcome 页、版本管理、工具数量、README 导航结构和完整工具清单同步到当前版本</li>
    <li><span class="tag improved">优化</span>新增 issues 修复回归检查和修复报告，覆盖安全、日期、时区、主题和文档同步改动</li>
</ul>
<div class="feature-category">缺陷修复</div>
<ul>
    <li><span class="tag fixed">修复</span>Markdown 编辑器：预览、复制和导出 HTML 统一使用净化后的结果，过滤危险标签、事件属性和不安全链接协议</li>
    <li><span class="tag fixed">修复</span>链接清理工具：历史记录改用安全 DOM 节点和文本渲染，复制按钮使用显式事件绑定，避免 HTML 注入及对全局 event 的依赖</li>
    <li><span class="tag fixed">修复</span>世界时间：动态计算当前时区偏移并修正 A/B 时差方向，正确处理夏令时和时区政策变化</li>
    <li><span class="tag fixed">修复</span>万年历：节气改为按年份动态计算，并为农历数据增加 1900–2100 年范围保护</li>
    <li><span class="tag fixed">修复</span>时间计算：纯日期输入改用本地日期解析和格式化，避免 UTC 转换造成跨时区日期偏移</li>
    <li><span class="tag fixed">修复</span>极速计算：使用内置表达式解析器替代动态代码执行，保留括号、小数、正负号、四则运算和幂运算支持</li>
    <li><span class="tag fixed">修复</span>极速计算、WiFi 二维码、优惠计算器和链接清理工具补齐 UTF-8 声明及页面语言，避免独立访问时中文乱码</li>
</ul>
```

- [ ] **Step 5: Replace the 2.12.0 categories with one card and consolidate overlapping capabilities**

```html
<div class="feature-category">新功能</div>
<ul>
    <li><span class="tag new">新增</span>接口带宽计算工具：支持 Thunderbolt 3/4/5、USB4 20/40Gbps、USB4 v2 / USB 80Gbps 等接口标准，提供 TX、RX、PCIe 数据带宽占用评估</li>
    <li><span class="tag new">新增</span>接口带宽计算：支持添加多个负载设备，按显示器、PCIe/eGPU/SSD、网线/网卡、USB/外设和其他类型配置属性、带宽预设并实时计算</li>
    <li><span class="tag new">新增</span>接口带宽计算：显示器负载支持分辨率、刷新率、色深和 DSC 压缩倍率，自动展示计算带宽与公式过程</li>
    <li><span class="tag new">新增</span>接口带宽计算：新增术语科普模块，解释 TX/RX、增强模式、PCIe 纯数据、DSC 压缩、Gbps 和双向负载等概念</li>
</ul>
<div class="feature-category">逻辑变更与优化</div>
<ul>
    <li><span class="tag improved">优化</span>接口带宽计算：将增强模式改为接口标准中的独立选项，选择接口后直接展示模式、TX、RX 和 PCIe 等关键属性</li>
    <li><span class="tag improved">优化</span>接口带宽计算：负载列表改为紧凑表格布局，新增负载在底部追加一行，减少页面占用并保留可编辑属性</li>
    <li><span class="tag improved">优化</span>接口带宽计算：计算摘要、统计条和过程统一放入计算模块，突出发送 TX、接收 RX、PCIe 数据和整体判断</li>
    <li><span class="tag ux">体验</span>接口带宽计算：根据负载类型自动套用默认方向和带宽，例如网线/网卡默认双向 1000M、PCIe 默认接收 RX 32Gbps</li>
    <li><span class="tag ui">界面</span>接口带宽计算：区分固定接口能力与动态负载占用的颜色，放大结果和带宽显示，提升扫描效率</li>
</ul>
<div class="feature-category">缺陷修复</div>
<ul>
    <li><span class="tag fixed">修复</span>接口带宽计算：修复显示器等负载字段在窄布局下显示不全的问题</li>
    <li><span class="tag fixed">修复</span>接口带宽计算：修复负载类型切换后备注不随默认类型更新的问题</li>
</ul>
```

- [ ] **Step 6: Run the focused regression and confirm it passes**

Run: `node regression-tests/history-layout.mjs`

Expected: `history-layout regression passed`

- [ ] **Step 7: Commit only the changelog implementation**

```bash
git add -- items/History.html
git commit --only -m "docs: consolidate recent changelog entries" -- items/History.html
```

### Task 3: Run complete verification

**Files:**
- Verify: `items/History.html`
- Verify: `regression-tests/history-layout.mjs`
- Verify: `tests/issues-audit-regression.mjs`
- Verify: `tests/tire-selector-regression.mjs`
- Verify: `regression-tests/security-date-browser.mjs`

- [ ] **Step 1: Check patch formatting**

Run: `git diff --check && git diff --cached --check`

Expected: exit code 0 with no output.

- [ ] **Step 2: Run static regressions**

```bash
node regression-tests/history-layout.mjs
node tests/issues-audit-regression.mjs
node tests/tire-selector-regression.mjs
```

Expected: all three commands print their `passed` message and exit 0.

- [ ] **Step 3: Run the browser regression**

Run: `PLAYWRIGHT_LOOKUP_PATH='/Users/stevechen/.npm/_npx/31e32ef8478fbf80' node regression-tests/security-date-browser.mjs`

Expected: `security-date-browser regression passed`

- [ ] **Step 4: Inspect the final repository state**

Run: `git status --short --branch && git log -3 --oneline`

Expected: the two focused implementation commits appear at the tip; unrelated pre-existing staged and unstaged changes remain intact.
