# Image Processor Preview Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 图片处理四标签预览铺满窗口剩余高度，左右两栏横向占满页面，上传图按比例完整放大显示。

**Architecture:** 只改 `items/ImageProcessor.html` 的页面壳（flex 全宽全高）和预览 CSS；裁切用 `ResizeObserver` 调用已有 `fitCropperCanvas`。算法、导出、localStorage 不动。

**Tech Stack:** 原生 HTML/CSS/JS、已有 Cropper.js、Node `node:assert/strict` 页面回归。

## Global Constraints

- 对照 spec：`docs/superpowers/specs/2026-08-20-image-processor-preview-layout-design.md`
- 版本 **2.16.5**，日期 **2026-08-20**
- Welcome 工具数仍为 19；不要改 `items/Welcome/` 草稿页
- 不引入新库；不改 `js/image-processor-core.js`
- 导出仍按原图像素；预览只用 CSS `object-fit: contain`
- 桌面 `overflow: hidden` + `100vh`；`max-width: 900px` 改为可滚动、预览 `min-height: 50vh`
- History 只加「逻辑改动与优化」，不要空的「新功能」分类

## File map

| 文件 | 职责 |
| --- | --- |
| `items/ImageProcessor.html` | 全宽全高 flex、预览自适应、裁切 ResizeObserver |
| `regression-tests/image-processor-page.mjs` | 锁住布局 CSS 与 2.16.5 |
| `regression-tests/qrcode-page.mjs` | 当前版本断言升到 2.16.5 |
| `items/History.html`、`js/version.js`、`items/Welcome.html` | 版本 2.16.5 |

---

### Task 1: 回归测试先锁住布局与 2.16.5

**Files:**
- Modify: `regression-tests/image-processor-page.mjs`
- Modify: `regression-tests/qrcode-page.mjs`
- Test: `regression-tests/image-processor-page.mjs`

**Interfaces:**
- Consumes: 现有页面字符串断言风格
- Produces: 失败的布局/版本断言，供 Task 2 变绿

- [ ] **Step 1: Write the failing test**

在 `regression-tests/image-processor-page.mjs` 里，把所有 `2.16.4` 当前版本断言改成同时保留历史 2.16.4、新增 2.16.5。具体替换：

```js
assert.match(welcome, /v2\.16\.5/);
assert.match(history, /<!-- 版本 2\.16\.5 -->/);
assert.match(history, /版本 2\.16\.5/);
assert.match(history, /2026-08-20/);
assert.match(history, /图片处理预览铺满窗口/);
assert.match(history, /<!-- 版本 2\.16\.4 -->/);
assert.match(history, /版本 2\.16\.4/);
assert.match(version, /2\.16\.5/);
assert.equal(version.includes('2.16.4'), false);
```

并在 `assert.match(page, /function fitCropperCanvas/);` 之后追加：

```js
assert.equal(page.includes('max-width: 1280px'), false);
assert.equal(page.includes('max-height: 420px'), false);
assert.equal(page.includes('height: 480px'), false);
assert.match(page, /height:\s*100vh/);
assert.match(page, /object-fit:\s*contain/);
assert.match(page, /ResizeObserver/);
assert.match(page, /min-height:\s*50vh/);
```

`regression-tests/qrcode-page.mjs` 同样：`v2.16.4` → `v2.16.5`，History 增加 2.16.5 断言并保留 2.16.4，`version` 匹配 `2.16.5` 且 `includes('2.16.4') === false`。

- [ ] **Step 2: Run tests to verify they fail**

Run: `node regression-tests/image-processor-page.mjs`

Expected: FAIL，缺少 `2.16.5` / `object-fit: contain` / `100vh` 等。

- [ ] **Step 3: Implement versions and History (needed for version assertions)**

`items/History.html` 在 `<!-- 版本 2.16.4 -->` 之前插入：

```html
            <!-- 版本 2.16.5 -->
            <div class="version-entry">
                <div class="version-dot"></div>
                <div class="version-header">
                    <div class="version-number">版本 2.16.5</div>
                    <div class="version-date">2026-08-20</div>
                </div>
                <div class="update-list">
                    <div class="feature-category">逻辑改动与优化</div>
                    <ul>
                        <li><span class="tag improved">优化</span>图片处理：预览铺满窗口，上传后的图按比例放大，便于精细操作</li>
                    </ul>
                </div>
            </div>
```

`js/version.js`：`@version` 与全部失败回退 `'2.16.4'` 改为 `'2.16.5'`。

`items/Welcome.html`：`v2.16.4` → `v2.16.5`。

- [ ] **Step 4: Re-run**

Run: `node regression-tests/image-processor-page.mjs`

Expected: 仍 FAIL 在布局断言（版本应变绿），直到 Task 2。

---

### Task 2: 全宽全高预览与裁切跟窗

**Files:**
- Modify: `items/ImageProcessor.html` 的 `<style>` 与标签切换 / Cropper 初始化附近
- Test: `regression-tests/image-processor-page.mjs`、`regression-tests/qrcode-page.mjs`

**Interfaces:**
- Consumes: 已有 `fitCropperCanvas()`、`state.crop.cropper`
- Produces: `observeCropDropResize()`；页面 CSS 满足 Task 1 断言

- [ ] **Step 1: Replace the layout CSS block**

把 `html, body` 到 `@media (max-width: 900px)` 换成与优惠计算器同结构的全宽全高（保留其余按钮/表单样式）。关键规则必须包含：

```css
html, body { margin: 0; height: 100vh; width: 100%; overflow: hidden; background: var(--background-primary); color: var(--text-primary); font-family: var(--font-family); }
.page { display: flex; flex-direction: column; height: 100vh; padding: var(--spacing-lg); box-sizing: border-box; }
h1 { margin: 0 0 var(--spacing-md); text-align: center; display: flex; align-items: center; justify-content: center; gap: var(--spacing-sm); font-size: 28px; flex-shrink: 0; }
.tabs { display: flex; gap: 8px; justify-content: center; margin-bottom: var(--spacing-md); flex-shrink: 0; }
.tab-panel { display: none; }
.tab-panel.active { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.layout { display: flex; flex: 1; gap: var(--spacing-lg); min-height: 0; }
.preview-pane, .control-pane { background: var(--background-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--spacing-lg); box-shadow: var(--shadow-sm); min-height: 0; }
.preview-pane { flex: 1.2; min-width: 0; display: flex; flex-direction: column; }
.control-pane { flex: 0.8; min-width: 260px; overflow-y: auto; }
.dropzone { flex: 1; min-height: 200px; width: 100%; border: 1px dashed var(--border-color); border-radius: var(--radius-md); display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--background-primary); cursor: pointer; position: relative; overflow: hidden; padding: var(--spacing-lg); box-sizing: border-box; }
.dropzone:hover { border-color: var(--border-focus); }
.dropzone.has-image { border-style: solid; }
#cropDrop.has-image { cursor: default; overflow: hidden; padding: 0; }
.preview-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-md); flex-shrink: 0; }
.thumbs { display: flex; gap: 8px; overflow-x: auto; margin-top: 12px; flex-shrink: 0; }
#wmCanvas:not([hidden]), #cpPreview:not([hidden]), #rdCanvas:not([hidden]) { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; margin: 0 auto; }
#rdCanvas { touch-action: none; }
#rdDrop.has-image { cursor: crosshair; padding: var(--spacing-lg); }
#cropWrap:not([hidden]) { width: 100%; height: 100%; overflow: hidden; }
#cropWrap .cropper-container { width: 100% !important; height: 100% !important; }
@media (max-width: 900px) {
    html, body { height: auto; min-height: 100vh; overflow: auto; }
    .page { height: auto; }
    .layout { flex-direction: column; }
    .tab-panel.active { flex: none; }
    .dropzone { min-height: 50vh; }
    .control-pane { min-width: 0; }
}
```

禁止再出现：`.page { max-width: 1280px }`、`max-height: 420px`、`#cropWrap`/`#cropDrop` 的 `480px` 高度。

保留其余原有规则（`.pick-btn`、`.form-group`、`.pos-grid`、toast 等），不要删掉 `[hidden]`。

- [ ] **Step 2: Add crop ResizeObserver and tab refresh**

在 `fitCropperCanvas` 后增加：

```js
function refreshCropperLayout() {
    const cropper = state.crop.cropper;
    if (!cropper) return;
    cropper.resize();
    fitCropperCanvas();
}

function observeCropDropResize() {
    const drop = document.getElementById('cropDrop');
    if (!drop || typeof ResizeObserver === 'undefined') return;
    new ResizeObserver(() => refreshCropperLayout()).observe(drop);
}
```

标签切换在加 `active` 之后：

```js
if (btn.dataset.tab === 'crop') requestAnimationFrame(refreshCropperLayout);
```

在 `initCropUi();` 之后调用 `observeCropDropResize();`。

- [ ] **Step 3: Run tests**

Run:

```bash
node regression-tests/image-processor-page.mjs
node regression-tests/qrcode-page.mjs
node regression-tests/image-processor-core.mjs
```

Expected: 三个都打印 passed。

- [ ] **Step 4: Manual check**

打开图片处理：四标签左右栏贴窗口边；上传图明显大于旧 420px 上限；拉窗口时图跟着变；裁切切标签后再回来框仍在；打码拖矩形仍对准图。
