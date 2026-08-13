# 智能白板黑暗模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让智能白板跟随 17Tools 全局主题：黑暗模式下工具栏/画布一起变暗，切主题时反相已有笔迹，导出 PNG 时由用户选择浅色或深色合成。

**Architecture:** 不引入 `theme.js`。在 `items/Board.html` 内用与 Markdown 相同的 `17tools-theme` 通道，把所有来源收成 `applyTheme`。画布仍是透明像素层；切主题时对非透明像素做 RGB 反相，历史快照带 `theme` 标记以便撤销/切槽位后与当前主题对齐。导出在离屏 canvas 上铺底色，不改正在编辑的画布。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Canvas 2D、Node `node:assert/strict` 源码回归测试。

## Global Constraints

- 不把白板接到 `js/theme.js` / `js/theme-injector.js`。
- 不改 `index.html` 的主题协议（仍发送 `{ type: '17tools-theme', theme }`）。
- 画布仍是 Canvas 像素，不改成矢量笔迹。
- 切主题反相不调用 `saveState()`；若正在绘制，先 `stopDrawing` 再反相。
- JSON 保存/加载不做主题转换，按当前像素原样读写。
- 画布不是「永远白纸」：深色模式下 `--background-primary` 变暗，画布透明，透出深色底。
- 导出浅色底 `#ffffff`，深色底 `#111827`；文件名仍是 `whiteboard_{timestamp}.png`。
- 版本 `2.15.2`，日期 `2026-08-13`。
- 实现对照 spec：`docs/superpowers/specs/2026-08-13-board-dark-theme-design.md`。
- 执行前若需要隔离工作区，用 `superpowers:using-git-worktrees` 创建 worktree。

## File Structure

| 文件 | 职责 |
| --- | --- |
| `items/Board.html` | 主题同步、像素/笔色反相、历史 `{ dataUrl, theme }`、导出弹层 |
| `regression-tests/board-theme.mjs` | 源码断言：协议、反相、历史标记、导出选项 |
| `items/History.html` | `2.15.2` 版本条目 |
| `js/version.js` | 失败回退改为 `2.15.2` |
| `items/Welcome.html` | 展示版本 `v2.15.2` |
| `regression-tests/image-processor-page.mjs` | 把「当前版本」断言从 `2.15.1` 升到 `2.15.2` |

---

### Task 1: 主题同步对齐 Markdown

**Files:**
- Create: `regression-tests/board-theme.mjs`
- Modify: `items/Board.html`（文件末尾「主题注入器」一段，约 1439–1494 行）
- Test: `regression-tests/board-theme.mjs`

**Interfaces:**
- Consumes: 主页面已发送 `{ type: '17tools-theme', theme: 'light' | 'dark' }`；父页面 `<html data-theme>`；`localStorage.theme`
- Produces:
  - `getSafeParentDocumentElement()` → `Element | null`
  - `detectTheme()` → `'light' | 'dark'`
  - `applyTheme(theme: string)` → `void`（非法值当 `'light'`；相同主题直接返回；设置 `data-theme`；若 `window.whiteboard` 已存在且有旧主题，调用 `whiteboard.handleThemeChange(theme)`）
  - 页面不再监听 message type `'theme-change'`

- [ ] **Step 1: Write the failing test**

Create `regression-tests/board-theme.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('items/Board.html', 'utf8');

assert.match(page, /function applyTheme\s*\(/);
assert.match(page, /function detectTheme\s*\(/);
assert.match(page, /function getSafeParentDocumentElement\s*\(/);
assert.match(page, /e\.data\.type === '17tools-theme'/);
assert.equal(page.includes("type === 'theme-change'"), false);
assert.match(page, /parentRoot\.getAttribute\('data-theme'\)/);
assert.match(page, /localStorage\.getItem\('theme'\)/);
assert.equal(page.includes('../js/theme.js'), false);
assert.equal(page.includes('theme-injector.js'), false);

console.log('board-theme regression passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/board-theme.mjs`

Expected: FAIL，`applyTheme` / `17tools-theme` 不存在，且源码仍含 `type === 'theme-change'`。

- [ ] **Step 3: Replace the theme bootstrap in `items/Board.html`**

Delete the entire block from `// 主题注入器` through the `observer.observe(...)` call (everything after the `WhiteBoard` class closing `}` and before `</script>`).

Replace with:

```js
        function getSafeParentDocumentElement() {
            try {
                if (window.parent === window) return null;
                const parentDoc = window.parent && window.parent.document;
                const parentRoot = parentDoc && parentDoc.documentElement;
                return parentRoot instanceof Node ? parentRoot : null;
            } catch (e) {
                return null;
            }
        }

        let currentAppliedTheme = null;

        function detectTheme() {
            try {
                const parentRoot = getSafeParentDocumentElement();
                const parentTheme = parentRoot ? parentRoot.getAttribute('data-theme') : null;
                if (parentTheme === 'light' || parentTheme === 'dark') {
                    return parentTheme;
                }
            } catch (e) { }
            try {
                const stored = localStorage.getItem('theme');
                if (stored === 'light' || stored === 'dark') {
                    return stored;
                }
            } catch (e) { }
            return 'light';
        }

        function applyTheme(theme) {
            if (theme !== 'light' && theme !== 'dark') {
                theme = 'light';
            }
            if (theme === currentAppliedTheme) {
                return;
            }
            const previous = currentAppliedTheme;
            currentAppliedTheme = theme;
            document.documentElement.setAttribute('data-theme', theme);
            if (window.whiteboard && previous) {
                window.whiteboard.handleThemeChange(theme);
            }
        }

        applyTheme(detectTheme());

        document.addEventListener('DOMContentLoaded', () => {
            applyTheme(detectTheme());
            setTimeout(() => {
                window.whiteboard = new WhiteBoard();
                document.getElementById('loading').style.display = 'none';
            }, 100);
        });

        window.addEventListener('message', (e) => {
            if (e.data && e.data.type === '17tools-theme') {
                applyTheme(e.data.theme);
            }
        });

        new MutationObserver(() => {
            const theme = document.documentElement.getAttribute('data-theme');
            if (theme) {
                applyTheme(theme);
            }
        }).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });

        try {
            const parentRoot = getSafeParentDocumentElement();
            if (parentRoot) {
                new MutationObserver(() => applyTheme(detectTheme()))
                    .observe(parentRoot, { attributes: true, attributeFilter: ['data-theme'] });
            }
        } catch (e) { }
```

Keep the existing `DOMContentLoaded` handler removed as part of this replacement — there must be only one `DOMContentLoaded` listener, and it must call `applyTheme(detectTheme())` **before** constructing `WhiteBoard`. Do not leave the old `injectTheme()` function.

`applyTheme` 必须先写 `currentAppliedTheme` 再 `setAttribute`，这样自身 MutationObserver 二次进入时会因主题相同而直接返回，避免切一次主题反相两次。

- [ ] **Step 4: Run test to verify it passes**

Run: `node regression-tests/board-theme.mjs`

Expected: `board-theme regression passed`

- [ ] **Step 5: Commit**

```bash
git add -- items/Board.html regression-tests/board-theme.mjs
git commit --only -m "$(cat <<'EOF'
fix: sync whiteboard theme via 17tools-theme

EOF
)" -- items/Board.html regression-tests/board-theme.mjs
```

---

### Task 2: 切主题反相笔迹与历史标记

**Files:**
- Modify: `items/Board.html`（`WhiteBoard`：`handleThemeChange`、`saveState`、`restoreState`、`switchSlot`，并新增 `invertPixels` / `invertHexColor` / `getBoardTheme`）
- Modify: `regression-tests/board-theme.mjs`
- Test: `regression-tests/board-theme.mjs`

**Interfaces:**
- Consumes: Task 1 的 `applyTheme` 在主题真正变化且 `window.whiteboard` 已存在时调用 `handleThemeChange(theme)`
- Produces:
  - `WhiteBoard#getBoardTheme()` → `'light' | 'dark'`
  - `WhiteBoard#invertHexColor(hex: string)` → 6 位 `#rrggbb`（`r/g/b = 255 - r/g/b`）
  - `WhiteBoard#invertPixels(targetCanvas: HTMLCanvasElement)` → `void`（`alpha === 0` 跳过，否则 `255 - r/g/b`，alpha 不变）
  - `WhiteBoard#handleThemeChange(newTheme)` → 若 `isDrawing` 先 `stopDrawing()`；然后 `invertPixels(this.canvas)`；反相 `strokeColor` 与 `colorHistory`；更新颜色选择器和备用色；若当前是橡皮擦则 `setEraserCursor()`；**不**调用 `saveState()`；反相后 `this.snapshot = null`
  - `history` / `slots[n].snapshot` 形状：`{ dataUrl: string, theme: 'light' | 'dark' }`
  - `restoreState(entry)`：画出 `entry.dataUrl` 后，若 `entry.theme !== getBoardTheme()` 再 `invertPixels(this.canvas)`

- [ ] **Step 1: Extend the failing test**

Append these assertions to `regression-tests/board-theme.mjs` **before** the `console.log` line:

```js
assert.match(page, /invertPixels\s*\(/);
assert.match(page, /255 - /);
assert.match(page, /alpha === 0/);
assert.match(page, /invertHexColor\s*\(/);
assert.equal(page.includes("this.strokeColor === '#000000' || this.strokeColor === '#ffffff'"), false);
assert.match(page, /dataUrl:\s*this\.canvas\.toDataURL\(\)/);
assert.match(page, /theme:\s*this\.getBoardTheme\(\)/);
assert.match(page, /restoreState\s*\(/);
assert.match(page, /entry\.theme !== this\.getBoardTheme\(\)/);
assert.match(page, /if \(this\.isDrawing\) \{[\s\S]*?this\.stopDrawing\(\)/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/board-theme.mjs`

Expected: FAIL，旧 `handleThemeChange` 仍是黑白特判，历史仍 `push(this.canvas.toDataURL())`。

- [ ] **Step 3: Add helpers and rewrite theme / history methods**

Inside `class WhiteBoard`, add these methods (place them immediately before `handleThemeChange`):

```js
            getBoardTheme() {
                return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            }

            invertHexColor(hex) {
                const raw = String(hex || '').replace('#', '');
                const full = raw.length === 3
                    ? raw.split('').map((ch) => ch + ch).join('')
                    : raw.padStart(6, '0').slice(0, 6);
                const n = parseInt(full, 16);
                if (Number.isNaN(n)) {
                    return hex;
                }
                const inverted = (0xFFFFFF ^ n) & 0xFFFFFF;
                return '#' + inverted.toString(16).padStart(6, '0');
            }

            invertPixels(targetCanvas) {
                const ctx = targetCanvas.getContext('2d');
                const imageData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const alpha = data[i + 3];
                    if (alpha === 0) {
                        continue;
                    }
                    data[i] = 255 - data[i];
                    data[i + 1] = 255 - data[i + 1];
                    data[i + 2] = 255 - data[i + 2];
                }
                ctx.putImageData(imageData, 0, 0);
            }
```

Replace `handleThemeChange` entirely:

```js
            handleThemeChange(newTheme) {
                if (this.isDrawing) {
                    this.stopDrawing();
                }

                this.invertPixels(this.canvas);
                this.snapshot = null;

                this.strokeColor = this.invertHexColor(this.strokeColor);
                this.colorHistory = this.colorHistory.map((color) => this.invertHexColor(color));
                document.getElementById('stroke-color').value = this.strokeColor;
                this.updatePresetColors();

                if (this.currentTool === 'eraser') {
                    this.setEraserCursor();
                }
            }
```

`newTheme` 仍由 `applyTheme` 传入以保持调用形状；反相不读 `newTheme` 做黑白特判（方向由「切一次就翻一次」保证，`applyTheme` 已跳过重复主题）。

Replace `saveState`:

```js
            saveState() {
                this.historyIndex++;
                if (this.historyIndex < this.history.length) {
                    this.history.length = this.historyIndex;
                }

                this.history.push({
                    dataUrl: this.canvas.toDataURL(),
                    theme: this.getBoardTheme()
                });

                if (this.history.length > this.maxHistory) {
                    this.history.shift();
                    this.historyIndex--;
                }
            }
```

Replace `restoreState`:

```js
            restoreState(entry) {
                if (!entry || !entry.dataUrl) {
                    return;
                }
                const img = new Image();
                img.onload = () => {
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                    this.ctx.drawImage(img, 0, 0);
                    if (entry.theme !== this.getBoardTheme()) {
                        this.invertPixels(this.canvas);
                    }
                };
                img.src = entry.dataUrl;
            }
```

In `switchSlot`, replace the snapshot write:

```js
                const currentData = this.canvas.toDataURL();
                this.slots[this.currentSlot] = {
                    snapshot: {
                        dataUrl: currentData,
                        theme: this.getBoardTheme()
                    },
                    history: [...this.history],
                    index: this.historyIndex
                };
```

Leave `restoreState(nextSlot.snapshot)` as-is — snapshot is now `{ dataUrl, theme }`. JSON `loadFromData` 继续自己 `drawImage`，不要改成走 `restoreState`。

Constructor 里默认笔色逻辑保持不变：

```js
                const currentTheme = document.documentElement.getAttribute('data-theme');
                this.strokeColor = currentTheme === 'dark' ? '#ffffff' : '#000000';
```

启动时不反相备用色。

- [ ] **Step 4: Run test to verify it passes**

Run: `node regression-tests/board-theme.mjs`

Expected: `board-theme regression passed`

- [ ] **Step 5: Commit**

```bash
git add -- items/Board.html regression-tests/board-theme.mjs
git commit --only -m "$(cat <<'EOF'
fix: invert whiteboard strokes when the theme changes

EOF
)" -- items/Board.html regression-tests/board-theme.mjs
```

---

### Task 3: 导出浅色 / 深色 PNG 弹层

**Files:**
- Modify: `items/Board.html`（导出按钮 markup、弹层 CSS、`exportImage` / 新增 `exportImageWithTheme`）
- Modify: `regression-tests/board-theme.mjs`
- Test: `regression-tests/board-theme.mjs`

**Interfaces:**
- Consumes: Task 2 的 `invertPixels`、`getBoardTheme`
- Produces:
  - `#export-popover` 内两个按钮：文案精确为 `导出浅色图片`、`导出深色图片`，`data-export-theme="light"|"dark"`
  - `WhiteBoard#toggleExportPopover()` → 打开则按当前主题给对应选项加 `active`，关闭则 `hidden`
  - `WhiteBoard#closeExportPopover()` → 设 `hidden`，不下载
  - `WhiteBoard#exportImageWithTheme(targetTheme: 'light' | 'dark')` → 离屏拷贝当前画布；若 `targetTheme !== getBoardTheme()` 则对副本 `invertPixels`；再铺底色（浅 `#ffffff` / 深 `#111827`）后下载；**不**改 `this.canvas`
  - 点击 `#export-btn` 调用 `toggleExportPopover`（不再直接下载）
  - 点击选项 → `closeExportPopover` + `exportImageWithTheme`
  - 点击弹层外或按 Escape → `closeExportPopover`，不导出

- [ ] **Step 1: Extend the failing test**

Append before `console.log` in `regression-tests/board-theme.mjs`:

```js
assert.match(page, /id="export-popover"/);
assert.match(page, /导出浅色图片/);
assert.match(page, /导出深色图片/);
assert.match(page, /data-export-theme="light"/);
assert.match(page, /data-export-theme="dark"/);
assert.match(page, /exportImageWithTheme\s*\(/);
assert.match(page, /outputCtx\.fillStyle = theme === 'dark' \? '#111827' : '#ffffff'/);
assert.match(page, /toggleExportPopover\s*\(/);
assert.match(page, /closeExportPopover\s*\(/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/board-theme.mjs`

Expected: FAIL，没有 `export-popover` / `导出浅色图片`。

- [ ] **Step 3: Add popover markup, CSS, and export methods**

In the toolbar group that contains `#export-btn`, wrap the export button:

```html
                <div class="export-wrap">
                    <button class="tool-btn tooltip" id="export-btn" data-tooltip="导出图片">
                        <i class="fas fa-download"></i>
                    </button>
                    <div class="export-popover" id="export-popover" hidden>
                        <button type="button" class="export-option" id="export-light" data-export-theme="light">导出浅色图片</button>
                        <button type="button" class="export-option" id="export-dark" data-export-theme="dark">导出深色图片</button>
                    </div>
                </div>
```

Keep `#save-btn` and `#load-btn` as siblings in the same `.toolbar-group`.

Add CSS before `</style>` (after `.slot-btn:hover:not(.active-slot)`):

```css
        .export-wrap {
            position: relative;
            display: inline-flex;
        }

        .export-popover {
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 148px;
            padding: 8px;
            background: var(--background-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            box-shadow: var(--shadow-medium);
            z-index: 10000;
        }

        .export-popover[hidden] {
            display: none;
        }

        .export-option {
            background: var(--background-primary);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            text-align: left;
        }

        .export-option:hover,
        .export-option.active {
            background-color: var(--primary-color);
            color: white;
            border-color: var(--primary-color);
        }
```

Replace `exportImage` and add the new methods next to it:

```js
            toggleExportPopover() {
                const popover = document.getElementById('export-popover');
                if (!popover.hidden) {
                    this.closeExportPopover();
                    return;
                }
                const current = this.getBoardTheme();
                document.querySelectorAll('.export-option').forEach((btn) => {
                    btn.classList.toggle('active', btn.getAttribute('data-export-theme') === current);
                });
                popover.hidden = false;
            }

            closeExportPopover() {
                document.getElementById('export-popover').hidden = true;
            }

            exportImageWithTheme(targetTheme) {
                const theme = targetTheme === 'dark' ? 'dark' : 'light';
                const src = this.canvas;
                const strokes = document.createElement('canvas');
                strokes.width = src.width;
                strokes.height = src.height;
                const strokesCtx = strokes.getContext('2d');
                strokesCtx.drawImage(src, 0, 0);
                if (theme !== this.getBoardTheme()) {
                    this.invertPixels(strokes);
                }

                const output = document.createElement('canvas');
                output.width = src.width;
                output.height = src.height;
                const outputCtx = output.getContext('2d');
                outputCtx.fillStyle = theme === 'dark' ? '#111827' : '#ffffff';
                outputCtx.fillRect(0, 0, output.width, output.height);
                outputCtx.drawImage(strokes, 0, 0);

                const link = document.createElement('a');
                link.download = `whiteboard_${new Date().getTime()}.png`;
                link.href = output.toDataURL();
                link.click();
            }
```

Delete the old `exportImage` method that called `this.canvas.toDataURL()` directly.

In `bindEvents`, replace the export click binding and add popover / dismiss handlers:

```js
                document.getElementById('export-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleExportPopover();
                });

                document.querySelectorAll('.export-option').forEach((btn) => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const theme = btn.getAttribute('data-export-theme');
                        this.closeExportPopover();
                        this.exportImageWithTheme(theme);
                    });
                });

                document.addEventListener('click', (e) => {
                    const popover = document.getElementById('export-popover');
                    if (popover.hidden) {
                        return;
                    }
                    if (!e.target.closest('.export-wrap')) {
                        this.closeExportPopover();
                    }
                });
```

In the existing `keydown` listener, at the top of the handler (before tool shortcuts), add:

```js
                    if (e.key === 'Escape') {
                        const popover = document.getElementById('export-popover');
                        if (popover && !popover.hidden) {
                            e.preventDefault();
                            this.closeExportPopover();
                            return;
                        }
                    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node regression-tests/board-theme.mjs`

Expected: `board-theme regression passed`

- [ ] **Step 5: Commit**

```bash
git add -- items/Board.html regression-tests/board-theme.mjs
git commit --only -m "$(cat <<'EOF'
feat: let whiteboard PNG export choose light or dark

EOF
)" -- items/Board.html regression-tests/board-theme.mjs
```

---

### Task 4: 版本 2.15.2 与回归绿灯

**Files:**
- Modify: `items/History.html`（时间线顶部插入 2.15.2）
- Modify: `js/version.js`（所有失败回退 `'2.15.1'` 和文件头 `@version` 改为 `2.15.2`）
- Modify: `items/Welcome.html`（`v2.15.1` → `v2.15.2`）
- Modify: `regression-tests/image-processor-page.mjs`（当前版本断言升到 2.15.2，并保留 2.15.1 仍存在）
- Test: `regression-tests/board-theme.mjs`
- Test: `regression-tests/image-processor-page.mjs`
- Test: `regression-tests/history-layout.mjs`

**Interfaces:**
- Consumes: 无新运行时 API
- Produces: History 顶部版本 `2.15.2`，日期 `2026-08-13`；分类顺序只能是「新功能」再「缺陷修复」（不要空的「逻辑改动与优化」）

- [ ] **Step 1: Update version assertions so they fail**

In `regression-tests/image-processor-page.mjs`, change the current-version checks:

```js
assert.match(welcome, /v2\.15\.2/);
assert.match(history, /<!-- 版本 2\.15\.2 -->/);
assert.match(history, /版本 2\.15\.2/);
assert.match(history, /<!-- 版本 2\.15\.1 -->/);
assert.match(history, /版本 2\.15\.1/);
assert.match(history, /<!-- 版本 2\.15\.0 -->/);
assert.match(history, /版本 2\.15\.0/);
assert.match(history, /2026-08-13/);
assert.match(history, /图片处理：新增独立工具页/);
assert.match(history, /智能白板：跟随全局黑暗模式/);
assert.match(history, /智能白板：导出 PNG 时可选择浅色或深色合成/);
assert.match(version, /2\.15\.2/);
assert.equal(version.includes('2.15.1'), false);
assert.equal(version.includes('2.15.0'), false);
assert.equal(version.includes('2.14.1'), false);
```

Keep the existing ImageProcessor / README assertions after this block.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node regression-tests/image-processor-page.mjs
```

Expected: FAIL，Welcome / History / version.js 仍是 `2.15.1`。

- [ ] **Step 3: Insert History 2.15.2 and bump version strings**

At the top of `.timeline` in `items/History.html`, **before** `<!-- 版本 2.15.1 -->`, insert:

```html
            <!-- 版本 2.15.2 -->
            <div class="version-entry">
                <div class="version-dot"></div>
                <div class="version-header">
                    <div class="version-number">版本 2.15.2</div>
                    <div class="version-date">2026-08-13</div>
                </div>
                <div class="update-list">
                    <div class="feature-category">新功能</div>
                    <ul>
                        <li><span class="tag new">新增</span>智能白板：导出 PNG 时可选择浅色或深色合成</li>
                    </ul>
                    <div class="feature-category">缺陷修复</div>
                    <ul>
                        <li><span class="tag fixed">修复</span>智能白板：跟随全局黑暗模式，切换主题时反相已有笔迹</li>
                    </ul>
                </div>
            </div>
```

分类名必须是 `新功能` 和 `缺陷修复`（`history-layout.mjs` 不接受「逻辑变更与优化」这种旧叫法）。不要加空的「逻辑改动与优化」。

In `items/Welcome.html`, change `v2.15.1` to `v2.15.2`.

In `js/version.js`:

- 文件头 `@version 2.15.1` → `@version 2.15.2`
- 每一处失败回退 `'2.15.1'` → `'2.15.2'`（constructor fallback、iframe 解析失败、`extractVersionFromCurrentPage` 两处）

Do not edit `index.html`.

- [ ] **Step 4: Run all related regressions**

Run:

```bash
node regression-tests/board-theme.mjs
node regression-tests/image-processor-page.mjs
node regression-tests/history-layout.mjs
```

Expected:

```
board-theme regression passed
image-processor-page regression passed
history-layout regression passed (N versions)
```

`N` 比原来多 1（新增 2.15.2）。若 `history-layout` 因分类名失败，检查 2.15.2 是否只用了 `新功能` 和 `缺陷修复`，且标签分别是 `tag new` / `tag fixed`。

- [ ] **Step 5: Manual smoke (in the main app iframe, not by opening Board.html standalone)**

1. 打开 `index.html`，切到深色，再点「智能白板」：工具栏、画布、默认笔为白。
2. 切回浅色，画一条黑线和一条红线，再切深色：黑变白、红变青；再切回浅色应恢复。
3. 撤销、重做、槽位 1–3 切换后，笔迹颜色仍与当前主题一致。
4. 深色下选「导出浅色图片」：白底黑/红线。浅色下选「导出深色图片」：深底白/青线。正在编辑的画布不变。
5. 按住画笔绘制时切主题：当前一笔会结束并反相，撤销栈不因「切换主题」多出一步。Escape 和点击弹层外关闭导出选项且不下载。

- [ ] **Step 6: Commit**

```bash
git add -- items/History.html items/Welcome.html js/version.js regression-tests/image-processor-page.mjs
git commit --only -m "$(cat <<'EOF'
docs: record whiteboard dark theme in 2.15.2

EOF
)" -- items/History.html items/Welcome.html js/version.js regression-tests/image-processor-page.mjs
```

---

## Spec coverage

| Spec 要求 | Task |
| --- | --- |
| `17tools-theme` + `detectTheme` + `applyTheme` + 四条通道 | Task 1 |
| 不引入 theme.js；不改 index.html | Task 1 / Global Constraints |
| CSS 变量让 chrome 和画布底一起变暗 | 已有 CSS，Task 1 只接通 `data-theme` |
| 像素 RGB 反相、透明跳过 | Task 2 |
| 笔色与备用色同一套反相；删除黑白特判 | Task 2 |
| 反相不进撤销栈；绘制中先 stopDrawing | Task 2 |
| 历史 `{ dataUrl, theme }`；restore 时按需再反相 | Task 2 |
| JSON 加载不按主题转换 | Task 2 明确不改 `loadFromData` |
| 导出弹层浅/深选项、离屏合成、底色、文件名 | Task 3 |
| `board-theme.mjs` 源码断言 | Task 1–3 |
| History / version / Welcome `2.15.2` | Task 4 |
| 手工冒烟 1–5 | Task 4 Step 5 |
