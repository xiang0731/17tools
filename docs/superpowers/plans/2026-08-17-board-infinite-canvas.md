# 智能白板无限画布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把智能白板做成可向外延伸的像素画布：右键平移、Ctrl+滚轮缩放、顶部缩放/复位；JSON 和 PNG 都包含全部已绘制区域。

**Architecture:** 纯函数模块 `js/board-world.js` 负责屏幕↔世界坐标和 1024 分块算术。`WhiteBoard` 用 `Map` 存离屏块，显示层只复合当前视野。笔画写到世界块上；相机 `{ offsetX, offsetY, scale }` 管平移和缩放，不再用 CSS `transform: scale`。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Canvas 2D、UMD 模块、Node `node:assert/strict` 回归测试。

## Global Constraints

- 不改成矢量笔迹；仍是 Canvas 像素。
- 不做中键拖动、空格拖动、双指平移。
- 不改主题同步协议（仍用 `17tools-theme` 与像素反相）。
- 不把 PNG 导出改成「只导出当前窗口」。
- 不在平移或缩放时写入撤销栈。
- 不为导出体积设硬上限（极大包围盒若失败，由浏览器报错）。
- JSON 新文件 `version` 为 `'1.2'`，字段为 `tiles` + `camera`，不再写 `canvas`。
- 空画布导出确认文案：`当前画布是空的，确定仍要导出？`
- 清空确认文案保持：`确定要清空画布吗？此操作不可撤销。`
- 顶部控件 id：`zoom-out`、`zoom-percent`、`zoom-in`、`reset-view`。
- 实现对照 spec：`docs/superpowers/specs/2026-08-17-board-infinite-canvas-design.md`。
- 版本：实现时读取 `items/History.html` 最新 `版本 X.Y.Z` 后补丁 +1。写本计划时工作区最新是 `2.16.2`，因此用 **2.16.3**。不要改动或删除已有的 2.16.2 加载进度条目。
- 不要把无关的 load-progress 未提交文件打进本功能的 commit。
- 执行前若需要隔离工作区，用 `superpowers:using-git-worktrees` 创建 worktree。

## File Structure

| 文件 | 职责 |
| --- | --- |
| `js/board-world.js` | 新增。相机、分块、坐标纯函数，UMD 全局 `BoardWorld` |
| `items/Board.html` | 分块绘制、右键平移、顶部缩放/复位、JSON/PNG/清空/槽位 |
| `regression-tests/board-world.mjs` | 新增。坐标与分块算术 |
| `regression-tests/board-infinite-page.mjs` | 新增。页面交互与保存/导出约定 |
| `regression-tests/board-theme.mjs` | 历史条目改为 `tiles`，其余主题约定保持 |
| `items/History.html`、`js/version.js`、`items/Welcome.html` | `2.16.3` 记录 |
| `README.md` | 白板能力与回归命令 |
| `regression-tests/qrcode-page.mjs`、`regression-tests/image-processor-page.mjs` | 当前版本断言升到 2.16.3（若文件里写死了旧版本） |

---

### Task 1: BoardWorld 坐标与分块算术

**Files:**
- Create: `js/board-world.js`
- Create: `regression-tests/board-world.mjs`
- Test: `regression-tests/board-world.mjs`

**Interfaces:**
- Consumes: 无
- Produces: UMD 模块 `BoardWorld`，导出：
  - `TILE_SIZE: 1024`
  - `MIN_SCALE: 0.5`
  - `MAX_SCALE: 3`
  - `SCALE_STEP: 0.1`
  - `createCamera()` → `{ offsetX: 0, offsetY: 0, scale: 1 }`
  - `clampScale(scale: number)` → `number`
  - `screenToWorld(screenX, screenY, camera)` → `{ x, y }`
  - `worldToScreen(worldX, worldY, camera)` → `{ x, y }`
  - `panByScreenDelta(camera, dx, dy)` → 新 camera（不改入参）
  - `worldToTile(worldX, worldY, tileSize = TILE_SIZE)` → `{ tx, ty }`
  - `tileKey(tx, ty)` → `"tx,ty"`
  - `parseTileKey(key)` → `{ tx, ty }`
  - `tileOrigin(tx, ty, tileSize = TILE_SIZE)` → `{ x, y }`
  - `visibleTiles(camera, viewW, viewH, tileSize = TILE_SIZE)` → `[{ tx, ty, key }, ...]`

- [ ] **Step 1: Write the failing test**

Create `regression-tests/board-world.mjs`:

```js
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BoardWorld = require('../js/board-world.js');

assert.equal(BoardWorld.TILE_SIZE, 1024);
assert.equal(BoardWorld.MIN_SCALE, 0.5);
assert.equal(BoardWorld.MAX_SCALE, 3);
assert.equal(BoardWorld.SCALE_STEP, 0.1);

const origin = BoardWorld.createCamera();
assert.deepEqual(origin, { offsetX: 0, offsetY: 0, scale: 1 });

assert.deepEqual(
    BoardWorld.screenToWorld(0, 0, origin),
    { x: 0, y: 0 }
);
assert.deepEqual(
    BoardWorld.worldToScreen(0, 0, origin),
    { x: 0, y: 0 }
);

const zoomed = { offsetX: 10, offsetY: 20, scale: 2 };
assert.deepEqual(BoardWorld.screenToWorld(10, 10, zoomed), { x: 15, y: 25 });
assert.deepEqual(BoardWorld.worldToScreen(15, 25, zoomed), { x: 10, y: 10 });

const panned = BoardWorld.panByScreenDelta(zoomed, 10, 0);
assert.equal(panned.offsetX, 5);
assert.equal(panned.offsetY, 20);
assert.equal(panned.scale, 2);
assert.equal(zoomed.offsetX, 10);

assert.equal(BoardWorld.clampScale(0.1), 0.5);
assert.equal(BoardWorld.clampScale(9), 3);
assert.equal(BoardWorld.clampScale(1.2), 1.2);

assert.deepEqual(BoardWorld.worldToTile(-1, -1), { tx: -1, ty: -1 });
assert.deepEqual(BoardWorld.worldToTile(0, 0), { tx: 0, ty: 0 });
assert.deepEqual(BoardWorld.worldToTile(1023, 1023), { tx: 0, ty: 0 });
assert.deepEqual(BoardWorld.worldToTile(1024, 1024), { tx: 1, ty: 1 });

assert.equal(BoardWorld.tileKey(-1, 2), '-1,2');
assert.deepEqual(BoardWorld.parseTileKey('-1,2'), { tx: -1, ty: 2 });
assert.deepEqual(BoardWorld.tileOrigin(-1, 2), { x: -1024, y: 2048 });

const vis0 = BoardWorld.visibleTiles(origin, 800, 600);
assert.equal(vis0.some((t) => t.key === '0,0'), true);
assert.equal(vis0.some((t) => t.key === '-1,-1'), false);

const visPan = BoardWorld.visibleTiles(
    { offsetX: -100, offsetY: -100, scale: 1 },
    800,
    600
);
assert.equal(visPan.some((t) => t.key === '0,0'), true);
assert.equal(visPan.some((t) => t.key === '-1,-1'), true);

console.log('board-world regression passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/board-world.mjs`

Expected: FAIL，`Cannot find module '../js/board-world.js'`。

- [ ] **Step 3: Write `js/board-world.js`**

```js
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.BoardWorld = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const TILE_SIZE = 1024;
    const MIN_SCALE = 0.5;
    const MAX_SCALE = 3;
    const SCALE_STEP = 0.1;

    function createCamera() {
        return { offsetX: 0, offsetY: 0, scale: 1 };
    }

    function clampScale(scale) {
        const n = Number(scale);
        if (!Number.isFinite(n)) {
            return 1;
        }
        return Math.min(Math.max(n, MIN_SCALE), MAX_SCALE);
    }

    function screenToWorld(screenX, screenY, camera) {
        const scale = camera.scale || 1;
        return {
            x: screenX / scale + camera.offsetX,
            y: screenY / scale + camera.offsetY
        };
    }

    function worldToScreen(worldX, worldY, camera) {
        const scale = camera.scale || 1;
        return {
            x: (worldX - camera.offsetX) * scale,
            y: (worldY - camera.offsetY) * scale
        };
    }

    function panByScreenDelta(camera, dx, dy) {
        const scale = camera.scale || 1;
        return {
            offsetX: camera.offsetX - dx / scale,
            offsetY: camera.offsetY - dy / scale,
            scale: camera.scale
        };
    }

    function worldToTile(worldX, worldY, tileSize) {
        const size = tileSize || TILE_SIZE;
        return {
            tx: Math.floor(worldX / size),
            ty: Math.floor(worldY / size)
        };
    }

    function tileKey(tx, ty) {
        return tx + ',' + ty;
    }

    function parseTileKey(key) {
        const parts = String(key).split(',');
        return { tx: Number(parts[0]), ty: Number(parts[1]) };
    }

    function tileOrigin(tx, ty, tileSize) {
        const size = tileSize || TILE_SIZE;
        return { x: tx * size, y: ty * size };
    }

    function visibleTiles(camera, viewW, viewH, tileSize) {
        const size = tileSize || TILE_SIZE;
        const a = screenToWorld(0, 0, camera);
        const b = screenToWorld(viewW, viewH, camera);
        const minTx = Math.floor(Math.min(a.x, b.x) / size);
        const minTy = Math.floor(Math.min(a.y, b.y) / size);
        const maxTx = Math.floor(Math.max(a.x, b.x) / size);
        const maxTy = Math.floor(Math.max(a.y, b.y) / size);
        const tiles = [];
        for (let ty = minTy; ty <= maxTy; ty++) {
            for (let tx = minTx; tx <= maxTx; tx++) {
                tiles.push({ tx: tx, ty: ty, key: tileKey(tx, ty) });
            }
        }
        return tiles;
    }

    return {
        TILE_SIZE: TILE_SIZE,
        MIN_SCALE: MIN_SCALE,
        MAX_SCALE: MAX_SCALE,
        SCALE_STEP: SCALE_STEP,
        createCamera: createCamera,
        clampScale: clampScale,
        screenToWorld: screenToWorld,
        worldToScreen: worldToScreen,
        panByScreenDelta: panByScreenDelta,
        worldToTile: worldToTile,
        tileKey: tileKey,
        parseTileKey: parseTileKey,
        tileOrigin: tileOrigin,
        visibleTiles: visibleTiles
    };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node regression-tests/board-world.mjs`

Expected: `board-world regression passed`

- [ ] **Step 5: Commit**

```bash
git add -- js/board-world.js regression-tests/board-world.mjs
git commit -m "$(cat <<'EOF'
feat: add whiteboard world-coordinate helpers

EOF
)"
```

---

### Task 2: 顶部缩放/复位与 Ctrl+滚轮壳子

**Files:**
- Create: `regression-tests/board-infinite-page.mjs`
- Modify: `items/Board.html`（工具栏、状态栏、script 引入、滚轮、右键菜单）
- Test: `regression-tests/board-infinite-page.mjs`
- Test: `regression-tests/board-world.mjs`

**Interfaces:**
- Consumes: Task 1 的 `BoardWorld`（本任务只引入脚本，暂不改绘制）
- Produces: 页面含 `zoom-out` / `zoom-percent` / `zoom-in` / `reset-view`；滚轮缩放只认 `ctrlKey`；容器监听 `contextmenu` 并 `preventDefault`

- [ ] **Step 1: Write the failing test**

Create `regression-tests/board-infinite-page.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('items/Board.html', 'utf8');

assert.match(page, /js\/board-world\.js/);
assert.match(page, /id="zoom-out"/);
assert.match(page, /id="zoom-percent"/);
assert.match(page, /id="zoom-in"/);
assert.match(page, /id="reset-view"/);
assert.match(page, /Ctrl\+滚轮缩放/);
assert.match(page, /右键拖动平移/);
assert.match(page, /contextmenu/);
assert.match(page, /preventDefault\(\)/);
assert.match(page, /e\.ctrlKey/);
assert.equal(/wheel[\s\S]{0,400}e\.shiftKey/.test(page), false);
assert.equal(page.includes('Shift+滚轮缩放'), false);

console.log('board-infinite-page regression passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/board-infinite-page.mjs`

Expected: FAIL，缺少 `zoom-out` / `board-world.js`，且仍有 `Shift+滚轮缩放`。

- [ ] **Step 3: Patch `items/Board.html` chrome**

1. 在 `unsaved-guard.js` 后增加：

```html
    <script src="../js/board-world.js"></script>
```

2. 在清空按钮那一组 `</div>` 之后、槽位组之前插入：

```html
            <div class="toolbar-group">
                <button class="tool-btn tooltip" id="zoom-out" data-tooltip="缩小 (Ctrl+-)">
                    <i class="fas fa-minus"></i>
                </button>
                <button class="tool-btn tooltip" id="zoom-percent" data-tooltip="重置缩放到 100%">100%</button>
                <button class="tool-btn tooltip" id="zoom-in" data-tooltip="放大 (Ctrl++)">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="tool-btn tooltip" id="reset-view" data-tooltip="复位到原点">
                    <i class="fas fa-crosshairs"></i>
                    复位
                </button>
            </div>
```

3. 状态栏左侧缩放那一行去掉 `status-action`、`id="reset-zoom"` 和 `data-tooltip="点击重置缩放"`，保留只读 `#zoom-level`：

```html
                <span>缩放: <span id="zoom-level">100%</span></span>
```

4. 右侧提示改为：

```html
                <span style="font-size: 10px; opacity: 0.7;">Ctrl+滚轮缩放 · 右键拖动平移</span>
```

5. 滚轮监听改成只认 Ctrl（删除 `e.shiftKey ||`）：

```js
                this.container.addEventListener('wheel', (e) => {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        const delta = e.deltaY > 0 ? -0.1 : 0.1;
                        this.updateZoom(delta);
                    }
                }, { passive: false });
```

6. 在 `bindEvents` 里给容器加右键菜单拦截，并绑顶部按钮（本任务先接到现有 `updateZoom` / `setZoom`；复位暂把 `offset` 字段准备上，若字段还不存在就只 `setZoom` 保持可点）：

```js
                this.container.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                });

                document.getElementById('zoom-out').addEventListener('click', () => {
                    this.updateZoom(-BoardWorld.SCALE_STEP);
                });
                document.getElementById('zoom-in').addEventListener('click', () => {
                    this.updateZoom(BoardWorld.SCALE_STEP);
                });
                document.getElementById('zoom-percent').addEventListener('click', () => {
                    this.setZoom(1);
                });
                document.getElementById('reset-view').addEventListener('click', () => {
                    this.resetView();
                });
```

7. 删除原来的 `document.getElementById('reset-zoom').addEventListener(...)`。

8. 给 `WhiteBoard` 加空方法，避免点击报错（Task 3 再填真实平移复位）：

```js
            resetView() {
                this.setZoom(this.scale);
            }
```

`updateZoom` / `setZoom` 暂时仍可走 CSS scale；Task 3 会改掉。`updateZoom` 的 clamp 改用 `BoardWorld.clampScale`：

```js
            updateZoom(delta) {
                this.setZoom(BoardWorld.clampScale(this.scale + delta));
            }
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node regression-tests/board-infinite-page.mjs
node regression-tests/board-world.mjs
node regression-tests/board-theme.mjs
```

Expected: 三行 `passed`。`board-theme.mjs` 必须仍绿。

- [ ] **Step 5: Commit**

```bash
git add -- items/Board.html regression-tests/board-infinite-page.mjs
git commit -m "$(cat <<'EOF'
feat: add whiteboard zoom toolbar and Ctrl+wheel

EOF
)"
```

---

### Task 3: 分块世界、右键平移、绘制与撤销

**Files:**
- Modify: `items/Board.html`（`WhiteBoard` 相机、块 Map、绘制、历史、主题反相）
- Modify: `regression-tests/board-theme.mjs`
- Modify: `regression-tests/board-infinite-page.mjs`
- Test: `regression-tests/board-infinite-page.mjs`
- Test: `regression-tests/board-theme.mjs`
- Test: `regression-tests/board-world.mjs`

**Interfaces:**
- Consumes: `BoardWorld` 全部导出
- Produces:
  - `WhiteBoard` 字段：`offsetX`、`offsetY`、`scale`、`tiles`（`Map<string, { canvas, ctx, tx, ty }>`）、`isPanning`、`panLast`
  - `getCamera()` → `{ offsetX, offsetY, scale }`
  - `resetView()` → `offsetX = 0`、`offsetY = 0`，不改 `scale`，然后 `redrawDisplay()`
  - `setZoom(scale)` → 只改 `scale` 并 `redrawDisplay()`，**不再**给 wrapper 设 `transform: scale`
  - `saveState()` 写入 `{ tiles: { [key]: dataUrl }, theme }`
  - `restoreState(entry)` 按 `entry.tiles` 重建块；无 `tiles` 时忽略
  - `handleThemeChange` 对每个块 `invertPixels(tile.canvas)`，再 `redrawDisplay()`
  - 左键绘画写到块上（世界坐标）；右键拖动调用 `BoardWorld.panByScreenDelta`

- [ ] **Step 1: Extend failing page/theme tests**

Append to `regression-tests/board-infinite-page.mjs` before `console.log`:

```js
assert.match(page, /this\.tiles\s*=\s*new Map/);
assert.match(page, /getCamera\s*\(/);
assert.match(page, /redrawDisplay\s*\(/);
assert.match(page, /panByScreenDelta/);
assert.match(page, /e\.button === 2/);
assert.match(page, /resetView\s*\(/);
assert.match(page, /this\.offsetX\s*=\s*0/);
assert.match(page, /this\.offsetY\s*=\s*0/);
assert.equal(page.includes('wrapper.style.transform = transformValue'), false);
assert.equal(page.includes("const transformValue = `scale(${this.scale})`"), false);
```

In `regression-tests/board-theme.mjs` **replace**:

```js
assert.match(page, /dataUrl:\s*this\.canvas\.toDataURL\(\)/);
```

with:

```js
assert.match(page, /tiles:\s*this\.snapshotTiles\(\)/);
assert.match(page, /invertPixels\(tile\.canvas\)/);
```

Keep `theme: this.getBoardTheme()`、`entry.theme !== this.getBoardTheme()`、`stopDrawing` 等其余断言。

- [ ] **Step 2: Run tests to verify they fail**

Run: `node regression-tests/board-infinite-page.mjs`

Expected: FAIL，没有 `this.tiles = new Map`。

- [ ] **Step 3: Replace zoom/camera/drawing internals in `WhiteBoard`**

构造函数在 `this.scale = 1` 旁增加：

```js
                this.offsetX = 0;
                this.offsetY = 0;
                this.tiles = new Map();
                this.isPanning = false;
                this.panLast = null;
                this.minScale = BoardWorld.MIN_SCALE;
                this.maxScale = BoardWorld.MAX_SCALE;
```

`resizeCanvas` **不要**再 `toDataURL` 回写显示层。只改显示 canvas 尺寸、`setupCanvas`、`redrawDisplay()`：

```js
            resizeCanvas() {
                const container = this.canvas.parentElement;
                const newWidth = container.clientWidth;
                const newHeight = container.clientHeight;
                const dpr = window.devicePixelRatio || 1;
                if (this.canvas.width === newWidth * dpr && this.canvas.height === newHeight * dpr) {
                    this.redrawDisplay();
                    return;
                }
                this.canvas.width = newWidth * dpr;
                this.canvas.height = newHeight * dpr;
                this.canvas.style.width = newWidth + 'px';
                this.canvas.style.height = newHeight + 'px';
                this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                this.setupCanvas();
                this.redrawDisplay();
            }
```

加入这些方法（可放在 `setupCanvas` 之后）：

```js
            getCamera() {
                return { offsetX: this.offsetX, offsetY: this.offsetY, scale: this.scale };
            }

            getDpr() {
                return window.devicePixelRatio || 1;
            }

            ensureTile(tx, ty) {
                const key = BoardWorld.tileKey(tx, ty);
                const existing = this.tiles.get(key);
                if (existing) {
                    return existing;
                }
                const dpr = this.getDpr();
                const size = BoardWorld.TILE_SIZE;
                const canvas = document.createElement('canvas');
                canvas.width = size * dpr;
                canvas.height = size * dpr;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                const tile = { canvas: canvas, ctx: ctx, tx: tx, ty: ty };
                this.tiles.set(key, tile);
                return tile;
            }

            forEachTilesInWorldRect(minX, minY, maxX, maxY, padding, fn) {
                const pad = padding || 0;
                const t0 = BoardWorld.worldToTile(minX - pad, minY - pad);
                const t1 = BoardWorld.worldToTile(maxX + pad, maxY + pad);
                for (let ty = Math.min(t0.ty, t1.ty); ty <= Math.max(t0.ty, t1.ty); ty++) {
                    for (let tx = Math.min(t0.tx, t1.tx); tx <= Math.max(t0.tx, t1.tx); tx++) {
                        fn(this.ensureTile(tx, ty));
                    }
                }
            }

            withWorldCtx(tile, fn) {
                const origin = BoardWorld.tileOrigin(tile.tx, tile.ty);
                tile.ctx.save();
                tile.ctx.translate(-origin.x, -origin.y);
                fn(tile.ctx);
                tile.ctx.restore();
            }

            redrawDisplay() {
                const dpr = this.getDpr();
                const viewW = this.canvas.clientWidth;
                const viewH = this.canvas.clientHeight;
                this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                this.ctx.clearRect(0, 0, viewW, viewH);
                const camera = this.getCamera();
                BoardWorld.visibleTiles(camera, viewW, viewH).forEach((info) => {
                    const tile = this.tiles.get(info.key);
                    if (!tile) {
                        return;
                    }
                    const origin = BoardWorld.tileOrigin(tile.tx, tile.ty);
                    const screen = BoardWorld.worldToScreen(origin.x, origin.y, camera);
                    const drawSize = BoardWorld.TILE_SIZE * camera.scale;
                    this.ctx.drawImage(tile.canvas, screen.x, screen.y, drawSize, drawSize);
                });
                this.syncGrid();
                this.syncZoomUI();
            }

            syncGrid() {
                const background = document.querySelector('.canvas-background');
                const camera = this.getCamera();
                const size = 20 * camera.scale;
                const posX = -camera.offsetX * camera.scale;
                const posY = -camera.offsetY * camera.scale;
                background.style.backgroundSize = size + 'px ' + size + 'px';
                background.style.backgroundPosition = posX + 'px ' + posY + 'px';
                background.style.transform = 'none';
            }

            syncZoomUI() {
                const label = Math.round(this.scale * 100) + '%';
                const top = document.getElementById('zoom-percent');
                const bottom = document.getElementById('zoom-level');
                if (top) {
                    top.textContent = label;
                }
                if (bottom) {
                    bottom.textContent = label;
                }
            }

            snapshotTiles() {
                const tiles = {};
                this.tiles.forEach((tile, key) => {
                    tiles[key] = tile.canvas.toDataURL();
                });
                return tiles;
            }

            restoreTiles(tiles) {
                this.tiles = new Map();
                const entries = tiles || {};
                Object.keys(entries).forEach((key) => {
                    const parsed = BoardWorld.parseTileKey(key);
                    const tile = this.ensureTile(parsed.tx, parsed.ty);
                    const img = new Image();
                    img.onload = () => {
                        const dpr = this.getDpr();
                        tile.ctx.setTransform(1, 0, 0, 1, 0, 0);
                        tile.ctx.clearRect(0, 0, tile.canvas.width, tile.canvas.height);
                        tile.ctx.drawImage(img, 0, 0);
                        tile.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                        this.redrawDisplay();
                    };
                    img.src = entries[key];
                });
                if (Object.keys(entries).length === 0) {
                    this.redrawDisplay();
                }
            }
```

`setZoom` / `resetView` / `getMousePos` 换成：

```js
            setZoom(scale) {
                this.scale = BoardWorld.clampScale(scale);
                this.redrawDisplay();
            }

            resetView() {
                this.offsetX = 0;
                this.offsetY = 0;
                this.redrawDisplay();
            }

            getMousePos(e) {
                const rect = this.container.getBoundingClientRect();
                return BoardWorld.screenToWorld(
                    e.clientX - rect.left,
                    e.clientY - rect.top,
                    this.getCamera()
                );
            }
```

在 `bindEvents` 里用容器（不是 canvas）处理右键平移；`mouseup`/`mousemove` 绑 `window`，以免拖出画布中断：

```js
                this.container.addEventListener('mousedown', (e) => {
                    if (e.button !== 2) {
                        return;
                    }
                    e.preventDefault();
                    this.isPanning = true;
                    this.panLast = { x: e.clientX, y: e.clientY };
                    this.container.style.cursor = 'grabbing';
                });

                window.addEventListener('mousemove', (e) => {
                    if (!this.isPanning || !this.panLast) {
                        return;
                    }
                    const next = BoardWorld.panByScreenDelta(
                        this.getCamera(),
                        e.clientX - this.panLast.x,
                        e.clientY - this.panLast.y
                    );
                    this.offsetX = next.offsetX;
                    this.offsetY = next.offsetY;
                    this.panLast = { x: e.clientX, y: e.clientY };
                    this.redrawDisplay();
                });

                window.addEventListener('mouseup', (e) => {
                    if (e.button === 2 || this.isPanning) {
                        this.isPanning = false;
                        this.panLast = null;
                        this.updateCursor();
                    }
                });
```

`startDrawing` 保持 `e.which !== 1` 则 return。把 `this.snapshot = this.ctx.getImageData(...)` 删掉（形状预览改走 `redrawDisplay`）。

画笔/橡皮：在世界坐标下对碰到的块描边。把 `draw` 的 `pen` / `eraser` 改成写块；形状分支先 `redrawDisplay()` 再在 **显示层** 用屏幕坐标预览（线宽 `this.brushSize * this.scale`）：

笔的核心（`startDrawing` 的 pen 分支不再 `this.ctx.beginPath`，只记 `lastX/lastY`）：

```js
            paintSegment(x0, y0, x1, y1, eraser) {
                const pad = eraser ? this.brushSize * 2 : this.brushSize;
                this.forEachTilesInWorldRect(x0, y0, x1, y1, pad, (tile) => {
                    this.withWorldCtx(tile, (ctx) => {
                        if (eraser) {
                            ctx.globalCompositeOperation = 'destination-out';
                            ctx.beginPath();
                            ctx.arc(x1, y1, this.brushSize * 2, 0, 2 * Math.PI);
                            ctx.fill();
                            ctx.globalCompositeOperation = 'source-over';
                            return;
                        }
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.strokeStyle = this.strokeColor;
                        ctx.lineWidth = this.brushSize;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.beginPath();
                        ctx.moveTo(x0, y0);
                        ctx.lineTo(x1, y1);
                        ctx.stroke();
                    });
                });
            }
```

`draw` 的 pen：距离判断仍用世界坐标；用二次贝塞尔的控制点时，把 `quadraticCurveTo` 同样放到 `withWorldCtx` 里（每个相关块都画同一条世界曲线）。橡皮调用 `paintSegment(..., true)`。每次 pen/eraser 移动后 `redrawDisplay()`。

`stopDrawing` 里形状的最终绘制不要画在 `this.ctx` 上，改为 `commitShape(start, end)`：对包围盒内的块 `withWorldCtx`，用世界坐标画 line/arrow/rect/circle（线宽 `this.brushSize`，颜色 `this.strokeColor`），然后 `redrawDisplay()`、`saveState()`。把现有 `drawArrow` 改成接受 `ctx` 参数：`drawArrow(ctx, fromX, fromY, toX, toY)`。

形状预览（`draw` 的 line/arrow/rect/circle）：

```js
                        this.redrawDisplay();
                        const camera = this.getCamera();
                        const s0 = BoardWorld.worldToScreen(this.startX, this.startY, camera);
                        const s1 = BoardWorld.worldToScreen(pos.x, pos.y, camera);
                        this.ctx.save();
                        this.ctx.globalCompositeOperation = 'source-over';
                        this.ctx.strokeStyle = this.strokeColor;
                        this.ctx.lineWidth = this.brushSize * camera.scale;
                        this.ctx.lineCap = 'round';
                        this.ctx.lineJoin = 'round';
                        this.ctx.beginPath();
                        // 用 s0/s1 画预览，逻辑同现在，只是坐标换成屏幕
                        this.ctx.restore();
```

`saveState` / `restoreState`：

```js
            saveState() {
                this.historyIndex++;
                if (this.historyIndex < this.history.length) {
                    this.history.length = this.historyIndex;
                }
                const previous = this.history[this.historyIndex - 1];
                const tiles = this.snapshotTiles();
                if (previous && previous.tiles) {
                    Object.keys(tiles).forEach((key) => {
                        if (previous.tiles[key] === tiles[key]) {
                            tiles[key] = previous.tiles[key];
                        }
                    });
                }
                this.history.push({
                    tiles: tiles,
                    theme: this.getBoardTheme()
                });
                if (this.history.length > this.maxHistory) {
                    this.history.shift();
                    this.historyIndex--;
                }
            }

            restoreState(entry) {
                if (!entry) {
                    return;
                }
                this.restoreTiles(entry.tiles || {});
                if (entry.theme && entry.theme !== this.getBoardTheme()) {
                    this.tiles.forEach((tile) => {
                        this.invertPixels(tile.canvas);
                    });
                    this.redrawDisplay();
                }
            }
```

注意：`restoreTiles` 是异步 `Image.onload`。主题不一致时的反相应放进 **每张图 onload 之后**（对那一块 invert，再 redraw），不要在 tiles 还是空的时候立刻 invert。实现时把 `needsInvert` 传进 `restoreTiles`。

`handleThemeChange` 把 `this.invertPixels(this.canvas)` 换成：

```js
                this.tiles.forEach((tile) => {
                    this.invertPixels(tile.canvas);
                });
                this.snapshot = null;
                this.redrawDisplay();
```

`switchSlot` 里 `currentData = this.canvas.toDataURL()` 改成存 `tiles: this.snapshotTiles()` 和 `camera: this.getCamera()`（相机恢复放到 Task 4；本任务至少把 snapshot 改成 tiles，否则切槽位会丢视野外笔迹）。本任务切槽位时若还没有 camera 字段，恢复 tiles 即可。

状态栏坐标已经用 `getMousePos`，会自动变成世界坐标。

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node regression-tests/board-world.mjs
node regression-tests/board-infinite-page.mjs
node regression-tests/board-theme.mjs
```

Expected: 三行 `passed`。

手工快速看一眼：左键能画，右键能拖，拖出窗口再画，点复位能回到原点且旧笔迹还在。Ctrl+滚轮缩放，点顶部百分比只恢复 100%。

- [ ] **Step 5: Commit**

```bash
git add -- items/Board.html regression-tests/board-infinite-page.mjs regression-tests/board-theme.mjs
git commit -m "$(cat <<'EOF'
feat: store whiteboard strokes on an infinite tile grid

EOF
)"
```

---

### Task 4: 槽位相机、JSON 1.2、PNG 包围盒、清空复位

**Files:**
- Modify: `items/Board.html`（`switchSlot`、`saveToLocal`、`loadFromData`、`exportImageWithTheme`、`clearCanvas`、图片加载）
- Modify: `regression-tests/board-infinite-page.mjs`
- Test: `regression-tests/board-infinite-page.mjs`
- Test: `regression-tests/board-theme.mjs`
- Test: `regression-tests/board-world.mjs`

**Interfaces:**
- Consumes: Task 3 的 `snapshotTiles` / `restoreTiles` / `getCamera` / `redrawDisplay`
- Produces:
  - 槽位 `{ tiles, camera, history, index }`
  - JSON `{ version: '1.2', tileSize, tiles, camera, settings }`，无 `canvas` 字段
  - `loadFromData` 接受 `data.tiles` 或旧 `data.canvas`（从世界原点铺块）
  - 图片文件贴到当前视野左上角世界坐标
  - `exportImageWithTheme`：有墨则内容包围盒；无墨则 `confirm('当前画布是空的，确定仍要导出？')` 后按窗口尺寸导出
  - `clearCanvas` 确认后清块、`offsetX/offsetY = 0`、`scale = 1`、`saveState()`

- [ ] **Step 1: Extend failing page tests**

Append to `regression-tests/board-infinite-page.mjs` before `console.log`:

```js
assert.match(page, /version:\s*'1\.2'/);
assert.match(page, /tileSize:\s*BoardWorld\.TILE_SIZE/);
assert.match(page, /tiles:\s*this\.snapshotTiles\(\)/);
assert.match(page, /camera:\s*this\.getCamera\(\)/);
assert.match(page, /saveToLocal[\s\S]*?version:\s*'1\.2'/);
assert.equal(/saveToLocal\s*\(\)\s*\{[\s\S]*?canvas:\s*this\.canvas\.toDataURL\(\)/.test(page), false);
assert.match(page, /if \(data\.tiles\)/);
assert.match(page, /data\.canvas/);
assert.match(page, /当前画布是空的，确定仍要导出？/);
assert.match(page, /getContentBounds\s*\(/);
assert.match(page, /clearCanvas[\s\S]*?this\.offsetX\s*=\s*0/);
assert.match(page, /clearCanvas[\s\S]*?this\.offsetY\s*=\s*0/);
assert.match(page, /clearCanvas[\s\S]*?this\.scale\s*=\s*1/);
assert.match(page, /camera:\s*\{\s*offsetX:/);
```

`saveToLocal` 不再写 `canvas:` 的断言用上面的 `saveToLocal` 函数体检查，不要误伤加载旧文件的 `data.canvas`。

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/board-infinite-page.mjs`

Expected: FAIL，JSON 仍是 `version: '1.1'`。

- [ ] **Step 3: Implement persistence and export**

槽位初始值：

```js
                this.slots = {
                    1: { history: [], index: -1, tiles: {}, camera: BoardWorld.createCamera() },
                    2: { history: [], index: -1, tiles: {}, camera: BoardWorld.createCamera() },
                    3: { history: [], index: -1, tiles: {}, camera: BoardWorld.createCamera() }
                };
```

`switchSlot` 保存当前：

```js
                this.slots[this.currentSlot] = {
                    tiles: this.snapshotTiles(),
                    camera: this.getCamera(),
                    history: this.history.slice(),
                    index: this.historyIndex
                };
```

恢复下一槽：写回 `history` / `index`，`applyCamera(nextSlot.camera)`，`restoreTiles(nextSlot.tiles)`。`applyCamera`：

```js
            applyCamera(camera) {
                const next = camera || BoardWorld.createCamera();
                this.offsetX = next.offsetX || 0;
                this.offsetY = next.offsetY || 0;
                this.scale = BoardWorld.clampScale(next.scale == null ? 1 : next.scale);
                this.redrawDisplay();
            }
```

`saveToLocal`：

```js
            saveToLocal() {
                const data = {
                    version: '1.2',
                    timestamp: new Date().toISOString(),
                    tileSize: BoardWorld.TILE_SIZE,
                    tiles: this.snapshotTiles(),
                    camera: this.getCamera(),
                    settings: {
                        strokeColor: this.strokeColor,
                        colorHistory: this.colorHistory,
                        brushSize: this.brushSize
                    }
                };
                const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `whiteboard_${new Date().getTime()}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
```

`stampImageAtWorld(img, worldX, worldY, width, height)`：按图片 CSS 尺寸（缺省 `img.width`/`img.height`）把图拆到覆盖到的块上，`drawImage` 时用世界坐标 + `withWorldCtx`。

`loadFromData`：

```js
            loadFromData(data) {
                if (data.tiles) {
                    this.restoreTiles(data.tiles);
                    this.applyCamera(data.camera);
                    this.history = [];
                    this.historyIndex = -1;
                    this.saveState();
                } else if (data.canvas) {
                    const img = new Image();
                    img.onload = () => {
                        this.tiles = new Map();
                        this.stampImageAtWorld(img, 0, 0, img.width, img.height);
                        this.applyCamera(BoardWorld.createCamera());
                        this.history = [];
                        this.historyIndex = -1;
                        this.saveState();
                        this.redrawDisplay();
                    };
                    img.src = data.canvas;
                }
                // settings 同步保持现有逻辑
            }
```

图片文件加载：不要 `clearRect` 整张显示层。`stampImageAtWorld(img, this.offsetX, this.offsetY, img.width, img.height)` 后 `saveState()` + `redrawDisplay()`。

`getContentBounds`：遍历每块 `getImageData`，`alpha > 0` 的像素换算成世界 CSS 坐标（`origin + pixel / dpr`），得到 `{ minX, minY, maxX, maxY }`；没有任何墨返回 `null`。

`exportImageWithTheme`：

```js
            exportImageWithTheme(targetTheme) {
                const theme = targetTheme === 'dark' ? 'dark' : 'light';
                const bounds = this.getContentBounds();
                const dpr = this.getDpr();
                let widthCss;
                let heightCss;
                let originX = 0;
                let originY = 0;
                if (!bounds) {
                    if (!confirm('当前画布是空的，确定仍要导出？')) {
                        return;
                    }
                    widthCss = this.canvas.clientWidth;
                    heightCss = this.canvas.clientHeight;
                } else {
                    widthCss = Math.max(1, bounds.maxX - bounds.minX);
                    heightCss = Math.max(1, bounds.maxY - bounds.minY);
                    originX = bounds.minX;
                    originY = bounds.minY;
                }
                const strokes = document.createElement('canvas');
                strokes.width = Math.ceil(widthCss * dpr);
                strokes.height = Math.ceil(heightCss * dpr);
                const strokesCtx = strokes.getContext('2d');
                strokesCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
                this.tiles.forEach((tile) => {
                    const origin = BoardWorld.tileOrigin(tile.tx, tile.ty);
                    strokesCtx.drawImage(
                        tile.canvas,
                        origin.x - originX,
                        origin.y - originY,
                        BoardWorld.TILE_SIZE,
                        BoardWorld.TILE_SIZE
                    );
                });
                if (theme !== this.getBoardTheme()) {
                    this.invertPixels(strokes);
                }
                const output = document.createElement('canvas');
                output.width = strokes.width;
                output.height = strokes.height;
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

`clearCanvas`：

```js
            clearCanvas() {
                if (confirm('确定要清空画布吗？此操作不可撤销。')) {
                    this.tiles = new Map();
                    this.offsetX = 0;
                    this.offsetY = 0;
                    this.scale = 1;
                    this.redrawDisplay();
                    this.saveState();
                }
            }
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node regression-tests/board-world.mjs
node regression-tests/board-infinite-page.mjs
node regression-tests/board-theme.mjs
```

Expected: 三行 `passed`。`board-theme.mjs` 里浅/深底色和 `exportImageWithTheme` 仍在。

- [ ] **Step 5: Commit**

```bash
git add -- items/Board.html regression-tests/board-infinite-page.mjs
git commit -m "$(cat <<'EOF'
feat: save and export the full whiteboard drawing

EOF
)"
```

---

### Task 5: 版本记录与 README

**Files:**
- Modify: `items/History.html`（在现有最新版本条目**上方**插入 2.16.3，不改 2.16.2）
- Modify: `js/version.js`（所有失败回退 `'2.16.2'` → `'2.16.3'`）
- Modify: `items/Welcome.html`（`v2.16.2` → `v2.16.3`）
- Modify: `README.md`（白板一句 + 回归命令列表）
- Modify: `regression-tests/qrcode-page.mjs`（当前版本断言从 2.16.2 升到 2.16.3，并保留「历史里仍有 2.16.2」）
- Modify: `regression-tests/image-processor-page.mjs`（若写死了当前版本，同样升到 2.16.3）
- Test: `regression-tests/board-world.mjs`
- Test: `regression-tests/board-infinite-page.mjs`
- Test: `regression-tests/board-theme.mjs`
- Test: `regression-tests/qrcode-page.mjs`
- Test: `regression-tests/history-layout.mjs`

**Interfaces:**
- Consumes: 无运行时接口
- Produces: 站点版本 `2.16.3`；History 一条无限画布记录

- [ ] **Step 1: Write the failing version asserts**

In `regression-tests/qrcode-page.mjs`，把「当前版本」从 `2.16.2` 改成 `2.16.3`，并继续断言 History 里仍有 `2.16.2`：

- `welcome` 匹配 `v2.16.3`
- `history` 匹配 `<!-- 版本 2.16.3 -->` 和 `版本 2.16.3`
- 仍匹配 `<!-- 版本 2.16.2 -->`
- `version.js` 匹配 `2.16.3`，且失败回退不再写 `2.16.2`（`assert.equal(version.includes('2.16.2'), false)` 只适用于 `js/version.js` 源码，不要拿来扫 History）
- `history` 匹配 `智能白板` 与 `无限` 或 `右键`

`regression-tests/board-infinite-page.mjs` 不必断言站点版本。

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/qrcode-page.mjs`

Expected: FAIL，Welcome/History 仍是 2.16.2。

- [ ] **Step 3: Insert changelog and bump fallbacks**

在 `items/History.html` 时间线顶部、`<!-- 版本 2.16.2 -->` **之前**插入：

```html
            <!-- 版本 2.16.3 -->
            <div class="version-entry">
                <div class="version-dot"></div>
                <div class="version-header">
                    <div class="version-number">版本 2.16.3</div>
                    <div class="version-date">2026-08-17</div>
                </div>
                <div class="update-list">
                    <div class="feature-category">新功能</div>
                    <ul>
                        <li><span class="tag new">新增</span>智能白板：无限画布，右键拖动平移，Ctrl+滚轮缩放，顶部提供缩放和复位</li>
                    </ul>
                    <div class="feature-category">逻辑改动与优化</div>
                    <ul>
                        <li><span class="tag improved">优化</span>智能白板：JSON 与 PNG 导出包含全部已绘制区域；清空画布时复位视野</li>
                    </ul>
                </div>
            </div>
```

日期若实现日不是 17 号，改成当天。

`js/version.js` 所有 `'2.16.2'` 默认值改为 `'2.16.3'`。

`items/Welcome.html` 的 `v2.16.2` 改为 `v2.16.3`。

`README.md` 白板那一行改为：

```markdown
- 智能白板：无限画布，画笔、橡皮擦、形状、撤销/重做、右键平移、Ctrl+滚轮缩放、JSON 保存/加载、PNG 导出。
```

回归命令列表加上：

```bash
node regression-tests/board-world.mjs
node regression-tests/board-infinite-page.mjs
```

- [ ] **Step 4: Run the full related suite**

Run:

```bash
node regression-tests/board-world.mjs
node regression-tests/board-infinite-page.mjs
node regression-tests/board-theme.mjs
node regression-tests/qrcode-page.mjs
node regression-tests/history-layout.mjs
```

若 `image-processor-page.mjs` 也写死了当前版本，一并改完再跑。

Expected: 全部 `passed`。

手工冒烟（主站 iframe 打开白板）：

1. 左键画画，右键拖到窗外再画，复位后原笔迹仍在原点，新笔迹在窗外。
2. Ctrl+滚轮缩放，点顶部百分比回到 100%，视野位置不变；点复位只回原点，缩放不变。
3. Shift+滚轮不再缩放。
4. 清空后视野回到原点且 100%；空画布导出弹出「当前画布是空的，确定仍要导出？」。
5. 保存 JSON 再打开：笔迹和视野都在。打开旧版只有 `canvas` 的 JSON：图画在原点，视野在原点 100%。
6. 有笔迹时导出 PNG 覆盖全部墨迹；切主题后笔迹反相；槽位切换恢复对应视野。

- [ ] **Step 5: Commit**

```bash
git add -- items/History.html items/Welcome.html js/version.js README.md regression-tests/qrcode-page.mjs
git commit -m "$(cat <<'EOF'
docs: record infinite whiteboard canvas in 2.16.3

EOF
)"
```

若改了 `image-processor-page.mjs`，一并加入这次 commit。不要 `git add` `js/load-progress.js` 或其它无关文件。
