# PrettyFormat DealHunter Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 代码格式化页去掉外层大卡片，左右输入/结果两栏等宽铺满窗口剩余高度，对齐优惠计算器。

**Architecture:** 只改 `items/PrettyFormat.html` 的页面壳（`.app-container` + `.main-layout` + 等宽 `.code-area`）和相关 CSS。格式化、高亮、复制下载、自动检测的 JS 不动。

**Tech Stack:** 原生 HTML/CSS、已有 Prettier 与 highlight.js、Node `node:assert/strict` 页面回归。

## Global Constraints

- 对照 spec：`docs/superpowers/specs/2026-08-20-prettyformat-dealhunter-layout-design.md`
- 版本 **2.16.6**，日期 **2026-08-20**
- Welcome 工具数仍为 19；不要改 `items/Welcome/` 草稿页
- 不引入新库；不改 Prettier 配置、语言列表、按钮行为
- 两栏比例 1:1（不是图片处理的 1.2 : 0.8）
- 桌面 `overflow: hidden` + `100vh`；`max-width: 768px` 改为可滚动、两栏上下堆叠
- History 只加「逻辑改动与优化」，不要空的「新功能」分类
- 用户 git 规则：未明确要求提交时跳过所有 `git commit` 步骤

## File map

| 文件 | 职责 |
| --- | --- |
| `items/PrettyFormat.html` | 去掉 `.container` 卡片；`.app-container` + `.main-layout` 全宽全高双栏 |
| `regression-tests/prettyformat-page.mjs` | 锁住布局 CSS 与 2.16.6 |
| `regression-tests/image-processor-page.mjs` | 当前版本断言升到 2.16.6 |
| `regression-tests/qrcode-page.mjs` | 当前版本断言升到 2.16.6 |
| `items/History.html`、`js/version.js`、`items/Welcome.html` | 版本 2.16.6 |

---

### Task 1: 回归测试先锁住布局与 2.16.6

**Files:**
- Create: `regression-tests/prettyformat-page.mjs`
- Modify: `regression-tests/image-processor-page.mjs`
- Modify: `regression-tests/qrcode-page.mjs`
- Test: `regression-tests/prettyformat-page.mjs`

**Interfaces:**
- Consumes: 现有页面字符串断言风格（与 `image-processor-page.mjs` 相同：读 HTML 源码，不用浏览器）
- Produces: 失败的布局/版本断言，供 Task 2 变绿

- [ ] **Step 1: Write the failing test**

新建 `regression-tests/prettyformat-page.mjs`，内容必须是：

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('items/PrettyFormat.html', 'utf8');

assert.match(page, /<title>代码格式化工具<\/title>/);
assert.match(page, /id="input-code"/);
assert.match(page, /id="format-btn"/);
assert.match(page, /id="output-code"/);
assert.match(page, /id="language"/);
assert.match(page, /class="app-container"/);
assert.match(page, /class="main-layout"/);
assert.match(page, /height:\s*100vh/);
assert.equal(page.includes('class="container"'), false);
assert.equal(page.includes('editor-container'), false);
assert.equal(page.includes('max-width: 1400px'), false);
assert.equal(page.includes('min-height: 70vh'), false);
assert.equal(page.includes('min-height: 400px'), false);
assert.match(page, /@media \(max-width: 768px\)/);
assert.match(page, /min-height:\s*300px/);

const welcome = fs.readFileSync('items/Welcome.html', 'utf8');
const history = fs.readFileSync('items/History.html', 'utf8');
const version = fs.readFileSync('js/version.js', 'utf8');

assert.match(welcome, /19个实用工具/);
assert.match(welcome, /v2\.16\.6/);
assert.match(history, /<!-- 版本 2\.16\.6 -->/);
assert.match(history, /版本 2\.16\.6/);
assert.match(history, /2026-08-20/);
assert.match(history, /代码格式化去掉外层大框/);
assert.match(history, /<!-- 版本 2\.16\.5 -->/);
assert.match(history, /版本 2\.16\.5/);
assert.match(version, /2\.16\.6/);
assert.equal(version.includes('2.16.5'), false);

console.log('prettyformat-page regression passed');
```

在 `regression-tests/image-processor-page.mjs` 里，把当前版本断言从 2.16.5 升到 2.16.6，并保留历史 2.16.5。把这一段：

```js
assert.match(welcome, /v2\.16\.5/);
assert.match(history, /<!-- 版本 2\.16\.5 -->/);
assert.match(history, /版本 2\.16\.5/);
assert.match(history, /2026-08-20/);
assert.match(history, /图片处理：预览铺满窗口/);
```

换成：

```js
assert.match(welcome, /v2\.16\.6/);
assert.match(history, /<!-- 版本 2\.16\.6 -->/);
assert.match(history, /版本 2\.16\.6/);
assert.match(history, /2026-08-20/);
assert.match(history, /代码格式化去掉外层大框/);
assert.match(history, /<!-- 版本 2\.16\.5 -->/);
assert.match(history, /版本 2\.16\.5/);
assert.match(history, /图片处理：预览铺满窗口/);
```

并把 `assert.match(version, /2\.16\.5/);` 改成 `assert.match(version, /2\.16\.6/);`，在它后面把 `assert.equal(version.includes('2.16.4'), false);` 之前插入：

```js
assert.equal(version.includes('2.16.5'), false);
```

在 `regression-tests/qrcode-page.mjs` 里，把：

```js
assert.match(welcome, /v2\.16\.5/);
assert.match(history, /<!-- 版本 2\.16\.5 -->/);
assert.match(history, /版本 2\.16\.5/);
```

换成：

```js
assert.match(welcome, /v2\.16\.6/);
assert.match(history, /<!-- 版本 2\.16\.6 -->/);
assert.match(history, /版本 2\.16\.6/);
assert.match(history, /<!-- 版本 2\.16\.5 -->/);
assert.match(history, /版本 2\.16\.5/);
```

保留其后已有的 `<!-- 版本 2.16.4 -->` 到 `版本 2.16.0` 断言。把 `assert.match(version, /2\.16\.5/);` 改成 `assert.match(version, /2\.16\.6/);`，并在其后插入 `assert.equal(version.includes('2.16.5'), false);`。

- [ ] **Step 2: Run tests to verify they fail**

Run: `node regression-tests/prettyformat-page.mjs`

Expected: FAIL，缺少 `class="app-container"` / `2.16.6` / 或仍含 `class="container"`。

- [ ] **Step 3: Implement versions and History (needed for version assertions)**

`items/History.html` 在 `<!-- 版本 2.16.5 -->` 之前插入：

```html
            <!-- 版本 2.16.6 -->
            <div class="version-entry">
                <div class="version-dot"></div>
                <div class="version-header">
                    <div class="version-number">版本 2.16.6</div>
                    <div class="version-date">2026-08-20</div>
                </div>
                <div class="update-list">
                    <div class="feature-category">逻辑改动与优化</div>
                    <ul>
                        <li><span class="tag improved">优化</span>代码格式化去掉外层大框，输入与结果铺满窗口（对齐优惠计算器）</li>
                    </ul>
                </div>
            </div>
```

`js/version.js`：文件头 `@version 2.16.5` 以及全部失败回退 `'2.16.5'` 改为 `'2.16.6'`（共 1 处注释 + 5 处字符串）。改完后该文件不得再出现 `2.16.5`。

`items/Welcome.html`：`v2.16.5` → `v2.16.6`。工具数量保持 19。不要改 `items/Welcome/` 下草稿页。

- [ ] **Step 4: Re-run**

Run: `node regression-tests/prettyformat-page.mjs`

Expected: 仍 FAIL 在布局断言（`class="app-container"` / `class="container"` / `max-width: 1400px` 等），版本断言应变绿。

Run: `node regression-tests/history-layout.mjs`

Expected: PASS（2.16.6 只有「逻辑改动与优化」且标签是 `improved`）。

---

### Task 2: 全宽全高等宽双栏

**Files:**
- Modify: `items/PrettyFormat.html` 的 `<style>` 与 `<body>` 壳
- Test: `regression-tests/prettyformat-page.mjs`、`regression-tests/qrcode-page.mjs`、`regression-tests/image-processor-page.mjs`

**Interfaces:**
- Consumes: Task 1 的布局断言与已写入的 2.16.6
- Produces: 页面 CSS/HTML 满足 Task 1 断言；JS 行为不变

- [ ] **Step 1: Replace the layout CSS**

在 `items/PrettyFormat.html` 的 `<style>` 里，把从 `body {` 到 `.editor-container` 的 `@media (max-width: 1024px)` 整段（含 `.container`、`.editor-container`）删掉，换成：

```css
        html,
        body {
            margin: 0;
            padding: 0;
            height: 100vh;
            width: 100%;
            background-color: var(--background-primary);
            color: var(--text-primary);
            font-family: var(--font-family);
            overflow: hidden;
        }

        .app-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            padding: var(--spacing-lg);
            box-sizing: border-box;
        }

        /* 标题样式 */
        h1 {
            text-align: center;
            color: var(--text-primary);
            margin: 0 0 var(--spacing-md) 0;
            font-size: 28px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--spacing-sm);
            flex-shrink: 0;
        }

        .main-layout {
            display: flex;
            flex: 1;
            gap: var(--spacing-lg);
            min-height: 0;
        }
```

把 `.code-area` 改成等宽面板（对齐优惠计算器 `.panel`）：

```css
        .code-area {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            background: var(--background-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            overflow: hidden;
            box-shadow: var(--shadow-sm);
            transition: all var(--transition-fast);
        }
```

把 `.editor-wrapper` 的 `min-height: 400px` 改成 `min-height: 0`：

```css
        .editor-wrapper {
            display: flex;
            flex: 1;
            min-height: 0;
            position: relative;
            overflow: hidden;
        }
```

把 `.empty-state` 的 `min-height: 300px` 改成 `height: 100%`：

```css
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-tertiary);
            text-align: center;
            padding: var(--spacing-xl);
        }
```

保留现有 `@media (max-width: 900px)` 语言工具条换行规则。把 `@media (max-width: 768px)` 扩成与优惠计算器相同的堆叠，保留原有按钮/行号规则：

```css
        @media (max-width: 768px) {
            html,
            body {
                overflow: auto;
                height: auto;
            }

            .app-container {
                height: auto;
            }

            .main-layout {
                flex-direction: column;
                overflow-y: auto;
            }

            .code-area {
                min-height: 300px;
                flex: none;
            }

            .language-controls {
                flex-direction: column;
                align-items: stretch;
                gap: var(--spacing-sm);
            }

            .action-buttons {
                justify-content: center;
            }

            .action-button {
                flex: 1;
                min-width: auto;
            }

            h1 {
                font-size: 24px;
            }

            .line-numbers {
                width: 50px;
            }
        }
```

禁止再出现：`.container`、`.editor-container`、`max-width: 1400px`、`min-height: 70vh`、`.editor-wrapper` 的 `min-height: 400px`、`@media (max-width: 1024px)`。

保留其余原有规则（`.code-header`、`.language-selector`、行号、按钮、select、status-message、hljs、loading）。不要改 `<script>`。

- [ ] **Step 2: Replace the body shell HTML**

把 `<body>` 里标题 + `.container` / `.editor-container` 换成：

```html
<body>
    <div class="app-container">
        <h1>
            <i class="fas fa-code"></i>
            代码格式化工具
        </h1>

        <div class="main-layout">
            <!-- 输入区域 -->
            <div class="code-area">
```

输入区 `.code-area` 内部（header、language-selector、editor-wrapper）原样保留。

两个 `.code-area` 结束、原先 `</div></div>` 关掉 container/editor-container 的地方，改成只关 `.main-layout` 和 `.app-container`：

```html
            </div>
        </div>
    </div>

    <!-- 状态消息容器 -->
    <div id="status-message" class="status-message"></div>
```

`#status-message` 必须留在 `.app-container` 外面。不要再写 `class="container"` 或 `editor-container`。

- [ ] **Step 3: Run tests**

Run:

```bash
node regression-tests/prettyformat-page.mjs
node regression-tests/image-processor-page.mjs
node regression-tests/qrcode-page.mjs
node regression-tests/history-layout.mjs
```

Expected: 四个都打印 passed。

- [ ] **Step 4: Manual check**

打开代码格式化：无外层大卡片；左右两栏贴窗口边并吃满标题以下高度；拉大窗口编辑区跟着长；语言选择和按钮仍在各自面板工具条；格式化、行号、复制下载仍可用。缩到约 768px 宽时两栏上下堆叠，页面可滚动。
