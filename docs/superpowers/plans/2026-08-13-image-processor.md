# Image Processor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 17Tools 中新增本地「图片处理」工具，含互不共享状态的文字水印、单张裁切、目标体积/质量联动压缩。

**Architecture:** 可测试的纯函数放在 `js/image-processor-core.js`（UMD，对齐 `js/tire-selector-core.js`）。页面 `items/ImageProcessor.html` 负责上传、预览、Cropper.js 裁切、Canvas 绘制/编码和 JSZip 打包。三个标签各自持有文件列表。压缩通过注入的 `encode` 回调做质量二分，必要时再缩小边长。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Canvas 2D、Cropper.js 1.6.2、JSZip 3.10.1、Node `node:assert/strict` 回归测试。

## Global Constraints

- 图片只在浏览器内处理，不上传服务器。
- 仅接受 `image/jpeg`、`image/png`、`image/webp`（扩展名 `.jpg` / `.jpeg` / `.png` / `.webp`）。
- 单文件上限 20 MB；一次最多 20 张；裁切标签强制 1 张。
- 三个标签互不共享文件；切换标签不清空另一标签。
- 水印/裁切保留原 MIME；压缩输出由用户选 JPEG（默认）或 WebP。
- 导出后缀：`_watermarked` / `_cropped` / `_compressed`。
- CDN 钉死：Cropper.js `1.6.2`、JSZip `3.10.1`。
- `localStorage` 键：`17tools-image-processor`（只存水印参数和压缩输出格式，不存图片）。
- 侧栏「其他工具」中，「图片处理」放在「火星文转换」之后。
- 版本 `2.15.0`，日期 `2026-08-13`；History 只加「新功能」分类，分类名必须是 `新功能`（不要用空的「逻辑改动与优化」）。
- DOM 里的文件名、错误信息一律用 `textContent`，禁止把用户文件名塞进 `innerHTML`。
- 实现对照 spec：`docs/superpowers/specs/2026-08-13-image-processor-design.md`。

---

### Task 1: 文件校验与导出文件名

**Files:**
- Create: `js/image-processor-core.js`
- Create: `regression-tests/image-processor-core.mjs`
- Test: `regression-tests/image-processor-core.mjs`

**Interfaces:**
- Consumes: 无
- Produces: `ImageProcessorCore` UMD 对象，包含：
  - `ACCEPTED_MIMES`: `['image/jpeg', 'image/png', 'image/webp']`
  - `ACCEPTED_EXTENSIONS`: `['.jpg', '.jpeg', '.png', '.webp']`
  - `MAX_FILE_BYTES`: `20971520`
  - `MAX_BATCH_COUNT`: `20`
  - `validateFile({ name, type, size })` → `{ ok: true }` 或 `{ ok: false, reason: 'type' | 'size' }`
  - `resolveMime(name, type)` → `'image/jpeg' | 'image/png' | 'image/webp'`
  - `buildExportName(originalName, suffix, mime)` → `string`

- [ ] **Step 1: Write the failing test**

Create `regression-tests/image-processor-core.mjs`:

```js
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../js/image-processor-core.js');

assert.deepEqual(core.ACCEPTED_MIMES, ['image/jpeg', 'image/png', 'image/webp']);
assert.equal(core.MAX_FILE_BYTES, 20 * 1024 * 1024);
assert.equal(core.MAX_BATCH_COUNT, 20);

assert.deepEqual(core.validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 100 }), { ok: true });
assert.deepEqual(core.validateFile({ name: 'a.png', type: 'image/png', size: 100 }), { ok: true });
assert.deepEqual(core.validateFile({ name: 'a.webp', type: 'image/webp', size: 100 }), { ok: true });
assert.deepEqual(core.validateFile({ name: 'a.gif', type: 'image/gif', size: 100 }), { ok: false, reason: 'type' });
assert.deepEqual(core.validateFile({ name: 'a.jpg', type: 'image/jpeg', size: core.MAX_FILE_BYTES + 1 }), { ok: false, reason: 'size' });
assert.equal(core.validateFile({ name: 'photo.JPG', type: '', size: 10 }).ok, true);

assert.equal(core.resolveMime('a.png', ''), 'image/png');
assert.equal(core.resolveMime('a.jpg', 'image/jpeg'), 'image/jpeg');
assert.equal(core.resolveMime('a.webp', 'image/webp'), 'image/webp');

assert.equal(core.buildExportName('photo.jpg', 'watermarked', 'image/jpeg'), 'photo_watermarked.jpg');
assert.equal(core.buildExportName('my.photo.png', 'cropped', 'image/png'), 'my.photo_cropped.png');
assert.equal(core.buildExportName('中文.webp', 'compressed', 'image/webp'), '中文_compressed.webp');
assert.equal(core.buildExportName('noext', 'watermarked', 'image/jpeg'), 'noext_watermarked.jpg');

console.log('image-processor-core regression passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/image-processor-core.mjs`

Expected: FAIL with `Cannot find module '../js/image-processor-core.js'`

- [ ] **Step 3: Write minimal implementation**

Create `js/image-processor-core.js`:

```js
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ImageProcessorCore = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const ACCEPTED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
    const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
    const MAX_FILE_BYTES = 20 * 1024 * 1024;
    const MAX_BATCH_COUNT = 20;
    const MIME_TO_EXT = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
    };

    function getExtension(name) {
        const idx = String(name || '').lastIndexOf('.');
        return idx === -1 ? '' : String(name).slice(idx).toLowerCase();
    }

    function getStem(name) {
        const raw = String(name || 'image');
        const idx = raw.lastIndexOf('.');
        const stem = idx === -1 ? raw : raw.slice(0, idx);
        return stem || 'image';
    }

    function validateFile({ name, type, size }) {
        const ext = getExtension(name);
        const mimeOk = ACCEPTED_MIMES.includes(type);
        const extOk = ACCEPTED_EXTENSIONS.includes(ext);
        if (!mimeOk && !extOk) {
            return { ok: false, reason: 'type' };
        }
        if (typeof size === 'number' && size > MAX_FILE_BYTES) {
            return { ok: false, reason: 'size' };
        }
        return { ok: true };
    }

    function resolveMime(name, type) {
        if (ACCEPTED_MIMES.includes(type)) {
            return type;
        }
        const ext = getExtension(name);
        if (ext === '.png') return 'image/png';
        if (ext === '.webp') return 'image/webp';
        return 'image/jpeg';
    }

    function buildExportName(originalName, suffix, mime) {
        const stem = getStem(originalName);
        const ext = MIME_TO_EXT[mime] || 'jpg';
        return `${stem}_${suffix}.${ext}`;
    }

    return {
        ACCEPTED_MIMES,
        ACCEPTED_EXTENSIONS,
        MAX_FILE_BYTES,
        MAX_BATCH_COUNT,
        validateFile,
        resolveMime,
        buildExportName
    };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node regression-tests/image-processor-core.mjs`

Expected: `image-processor-core regression passed`

- [ ] **Step 5: Commit**

```bash
git add -- js/image-processor-core.js regression-tests/image-processor-core.mjs
git commit --only -m "$(cat <<'EOF'
test: add image processor file validation core

EOF
)" -- js/image-processor-core.js regression-tests/image-processor-core.mjs
```

---

### Task 2: 水印几何与体积/质量换算

**Files:**
- Modify: `js/image-processor-core.js`
- Modify: `regression-tests/image-processor-core.mjs`
- Test: `regression-tests/image-processor-core.mjs`

**Interfaces:**
- Consumes: Task 1 的 UMD 骨架
- Produces: 追加
  - `POSITIONS`: `['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br']`
  - `computeFontPx(minSide, percent)` → `number`（percent 钳制到 1–20）
  - `computeMargin(minSide)` → `minSide * 0.03`
  - `computeAnchor(width, height, position, margin)` → `{ x, y, textAlign, textBaseline }`
    - `textAlign`: `'left' | 'center' | 'right'`
    - `textBaseline`: `'top' | 'middle' | 'bottom'`
    - 未知 position 视为 `'br'`
  - `computeTileOrigins({ width, height, spacing })` → `Array<{ x, y }>`，从 `spacing/2` 起步长 `spacing`
  - `parseTargetSize(value, unit)` → 字节数或 `null`；`unit` 只能是 `'KB'` 或 `'MB'`
  - `formatByteSize(bytes)` → `{ value, unit: 'KB' | 'MB', text }`
  - `qualityToCanvas(qualityInt)` → `1–100` 映射为 `0.01–1`
  - `canvasToQuality(q)` → `0.01–1` 映射为 `1–100`

- [ ] **Step 1: Append failing tests before the final `console.log`**

```js
assert.deepEqual(core.POSITIONS, ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br']);
assert.equal(core.computeFontPx(1000, 5), 50);
assert.equal(core.computeFontPx(1000, 1), 10);
assert.equal(core.computeFontPx(1000, 20), 200);
assert.equal(core.computeFontPx(1000, 0), 10);
assert.equal(core.computeMargin(1000), 30);

assert.deepEqual(core.computeAnchor(1000, 800, 'br', 30), {
    x: 970, y: 770, textAlign: 'right', textBaseline: 'bottom'
});
assert.deepEqual(core.computeAnchor(1000, 800, 'tl', 30), {
    x: 30, y: 30, textAlign: 'left', textBaseline: 'top'
});
assert.deepEqual(core.computeAnchor(1000, 800, 'c', 30), {
    x: 500, y: 400, textAlign: 'center', textBaseline: 'middle'
});
assert.deepEqual(core.computeAnchor(1000, 800, 't', 30), {
    x: 500, y: 30, textAlign: 'center', textBaseline: 'top'
});
assert.deepEqual(core.computeAnchor(1000, 800, 'l', 30), {
    x: 30, y: 400, textAlign: 'left', textBaseline: 'middle'
});
assert.equal(core.computeAnchor(1000, 800, 'unknown', 30).textAlign, 'right');

assert.deepEqual(core.computeTileOrigins({ width: 100, height: 100, spacing: 50 }), [
    { x: 25, y: 25 }, { x: 75, y: 25 }, { x: 25, y: 75 }, { x: 75, y: 75 }
]);

assert.equal(core.parseTargetSize('200', 'KB'), 200 * 1024);
assert.equal(core.parseTargetSize('1', 'MB'), 1024 * 1024);
assert.equal(core.parseTargetSize('0', 'KB'), null);
assert.equal(core.parseTargetSize('abc', 'KB'), null);
assert.equal(core.parseTargetSize('1', 'GB'), null);

assert.deepEqual(core.formatByteSize(2048), { value: 2, unit: 'KB', text: '2 KB' });
assert.deepEqual(core.formatByteSize(1536), { value: 1.5, unit: 'KB', text: '1.5 KB' });
assert.deepEqual(core.formatByteSize(1048576), { value: 1, unit: 'MB', text: '1 MB' });

assert.equal(core.qualityToCanvas(80), 0.8);
assert.equal(core.qualityToCanvas(1), 0.01);
assert.equal(core.qualityToCanvas(100), 1);
assert.equal(core.canvasToQuality(0.8), 80);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/image-processor-core.mjs`

Expected: FAIL because `core.computeFontPx` is not a function.

- [ ] **Step 3: Add the helpers to the factory before `return`**

```js
    const POSITIONS = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'];

    function computeFontPx(minSide, percent) {
        const p = Math.min(20, Math.max(1, Number(percent) || 5));
        return Math.max(1, (Number(minSide) * p) / 100);
    }

    function computeMargin(minSide) {
        return Number(minSide) * 0.03;
    }

    function computeAnchor(width, height, position, margin) {
        const pos = POSITIONS.includes(position) ? position : 'br';
        const horizontal = pos === 'l' || pos.endsWith('l') ? 'left'
            : pos === 'r' || pos.endsWith('r') ? 'right'
            : 'center';
        const vertical = pos === 't' || pos.startsWith('t') ? 'top'
            : pos === 'b' || pos.startsWith('b') ? 'bottom'
            : 'middle';
        const x = horizontal === 'left' ? margin
            : horizontal === 'right' ? width - margin
            : width / 2;
        const y = vertical === 'top' ? margin
            : vertical === 'bottom' ? height - margin
            : height / 2;
        return {
            x,
            y,
            textAlign: horizontal,
            textBaseline: vertical
        };
    }

    function computeTileOrigins({ width, height, spacing }) {
        const step = Math.max(1, Number(spacing) || 1);
        const origins = [];
        for (let y = step / 2; y <= height; y += step) {
            for (let x = step / 2; x <= width; x += step) {
                origins.push({ x, y });
            }
        }
        return origins;
    }

    function parseTargetSize(value, unit) {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return null;
        if (unit === 'KB') return Math.round(n * 1024);
        if (unit === 'MB') return Math.round(n * 1024 * 1024);
        return null;
    }

    function formatByteSize(bytes) {
        if (!Number.isFinite(bytes) || bytes < 0) {
            return { value: 0, unit: 'KB', text: '0 KB' };
        }
        if (bytes >= 1024 * 1024) {
            const value = Math.round((bytes / (1024 * 1024)) * 100) / 100;
            return { value, unit: 'MB', text: `${value} MB` };
        }
        const value = Math.round((bytes / 1024) * 10) / 10;
        return { value, unit: 'KB', text: `${value} KB` };
    }

    function qualityToCanvas(qualityInt) {
        const q = Math.min(100, Math.max(1, Math.round(Number(qualityInt) || 1)));
        return q / 100;
    }

    function canvasToQuality(q) {
        return Math.min(100, Math.max(1, Math.round((Number(q) || 0) * 100)));
    }
```

Export them on the returned object next to the Task 1 exports.

- [ ] **Step 4: Run test to verify it passes**

Run: `node regression-tests/image-processor-core.mjs`

Expected: `image-processor-core regression passed`

- [ ] **Step 5: Commit**

```bash
git add -- js/image-processor-core.js regression-tests/image-processor-core.mjs
git commit --only -m "$(cat <<'EOF'
feat: add image processor watermark and size helpers

EOF
)" -- js/image-processor-core.js regression-tests/image-processor-core.mjs
```

---

### Task 3: 压缩策略（质量二分 + 必要时缩放）

**Files:**
- Modify: `js/image-processor-core.js`
- Modify: `regression-tests/image-processor-core.mjs`
- Test: `regression-tests/image-processor-core.mjs`

**Interfaces:**
- Consumes: Task 2 helpers
- Produces:
  - `SEARCH_MIN_QUALITY`: `0.3`
  - `nextScaleSize(width, height, originalShort)` → `{ width, height } | null`
    - 边长乘 `0.9` 后四舍五入
    - 短边下限 `min(256, originalShort)`，达不到则返回 `null`
    - 从不放大
  - `async compressToTarget({ sourceWidth, sourceHeight, sourceBytes, targetBytes, controlMode, quality, encode })`
    - `controlMode`: `'quality' | 'size'`
    - `quality`: `0.01–1`，仅 `controlMode === 'quality'` 时使用
    - `encode`: `async ({ width, height, quality }) => number`（字节数）
    - 返回 `{ width, height, quality, byteLength, passthrough: boolean, hitTarget: boolean }`
    - size 模式且 `targetBytes >= sourceBytes`：不调用 `encode`，`passthrough: true`，`byteLength: sourceBytes`
    - size 模式：先在原尺寸对质量 `[0.3, 1]` 二分 8 次，取不超过目标的最高质量；若 0.3 仍超标则反复 `nextScaleSize` 后再二分
    - 质量模式：原尺寸按给定 quality 编码一次，`hitTarget: true`，`passthrough: false`

- [ ] **Step 1: Append failing tests**

```js
assert.equal(core.SEARCH_MIN_QUALITY, 0.3);
assert.deepEqual(core.nextScaleSize(1000, 800, 800), { width: 900, height: 720 });
assert.equal(core.nextScaleSize(260, 260, 800), null);
assert.equal(core.nextScaleSize(200, 200, 200), null);

async function fakeEncode({ width, height, quality }) {
    return Math.round(width * height * quality);
}

const passthrough = await core.compressToTarget({
    sourceWidth: 100, sourceHeight: 80, sourceBytes: 1000, targetBytes: 2000,
    controlMode: 'size', quality: 0.8, encode: async () => {
        throw new Error('encode should not run for passthrough');
    }
});
assert.equal(passthrough.passthrough, true);
assert.equal(passthrough.hitTarget, true);
assert.equal(passthrough.byteLength, 1000);

const qualityMode = await core.compressToTarget({
    sourceWidth: 1000, sourceHeight: 800, sourceBytes: 900000, targetBytes: 100,
    controlMode: 'quality', quality: 0.8, encode: fakeEncode
});
assert.equal(qualityMode.width, 1000);
assert.equal(qualityMode.height, 800);
assert.equal(qualityMode.quality, 0.8);
assert.equal(qualityMode.passthrough, false);
assert.equal(qualityMode.byteLength, Math.round(1000 * 800 * 0.8));

const byQuality = await core.compressToTarget({
    sourceWidth: 1000, sourceHeight: 800, sourceBytes: 900000, targetBytes: 400000,
    controlMode: 'size', quality: 1, encode: fakeEncode
});
assert.equal(byQuality.width, 1000);
assert.equal(byQuality.height, 800);
assert.equal(byQuality.passthrough, false);
assert.equal(byQuality.hitTarget, true);
assert.ok(byQuality.byteLength <= 400000);
assert.ok(byQuality.quality >= 0.45 && byQuality.quality <= 0.5);

const scaled = await core.compressToTarget({
    sourceWidth: 1000, sourceHeight: 800, sourceBytes: 900000, targetBytes: 50000,
    controlMode: 'size', quality: 1, encode: fakeEncode
});
assert.ok(scaled.width < 1000);
assert.equal(scaled.hitTarget, true);
assert.ok(scaled.byteLength <= 50000);

const missed = await core.compressToTarget({
    sourceWidth: 1000, sourceHeight: 800, sourceBytes: 900000, targetBytes: 1,
    controlMode: 'size', quality: 1, encode: fakeEncode
});
assert.equal(missed.hitTarget, false);
assert.ok(Math.min(missed.width, missed.height) <= 256);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/image-processor-core.mjs`

Expected: FAIL because `core.compressToTarget` is not a function.

- [ ] **Step 3: Implement strategy functions**

```js
    const SEARCH_MIN_QUALITY = 0.3;
    const SCALE_STEP = 0.9;
    const MIN_SHORT_SIDE_CAP = 256;
    const BINARY_SEARCH_ITERS = 8;

    function nextScaleSize(width, height, originalShort) {
        const minShort = Math.min(MIN_SHORT_SIDE_CAP, originalShort);
        const nextW = Math.max(1, Math.round(width * SCALE_STEP));
        const nextH = Math.max(1, Math.round(height * SCALE_STEP));
        if (Math.min(nextW, nextH) < minShort) return null;
        if (nextW === width && nextH === height) return null;
        return { width: nextW, height: nextH };
    }

    async function compressToTarget(options) {
        const {
            sourceWidth,
            sourceHeight,
            sourceBytes,
            targetBytes,
            controlMode,
            quality,
            encode
        } = options;

        if (controlMode === 'quality') {
            const byteLength = await encode({
                width: sourceWidth,
                height: sourceHeight,
                quality
            });
            return {
                width: sourceWidth,
                height: sourceHeight,
                quality,
                byteLength,
                passthrough: false,
                hitTarget: true
            };
        }

        if (targetBytes >= sourceBytes) {
            return {
                width: sourceWidth,
                height: sourceHeight,
                quality: 1,
                byteLength: sourceBytes,
                passthrough: true,
                hitTarget: true
            };
        }

        async function searchAt(width, height) {
            const atMax = await encode({ width, height, quality: 1 });
            if (atMax <= targetBytes) {
                return { quality: 1, byteLength: atMax, hit: true };
            }
            const atMin = await encode({ width, height, quality: SEARCH_MIN_QUALITY });
            if (atMin > targetBytes) {
                return { quality: SEARCH_MIN_QUALITY, byteLength: atMin, hit: false };
            }
            let lo = SEARCH_MIN_QUALITY;
            let hi = 1;
            let bestQ = SEARCH_MIN_QUALITY;
            let bestBytes = atMin;
            for (let i = 0; i < BINARY_SEARCH_ITERS; i += 1) {
                const mid = (lo + hi) / 2;
                const bytes = await encode({ width, height, quality: mid });
                if (bytes <= targetBytes) {
                    bestQ = mid;
                    bestBytes = bytes;
                    lo = mid;
                } else {
                    hi = mid;
                }
            }
            return { quality: bestQ, byteLength: bestBytes, hit: true };
        }

        let width = sourceWidth;
        let height = sourceHeight;
        const originalShort = Math.min(sourceWidth, sourceHeight);
        let result = await searchAt(width, height);
        if (result.hit) {
            return {
                width,
                height,
                quality: result.quality,
                byteLength: result.byteLength,
                passthrough: false,
                hitTarget: true
            };
        }

        let scaled = nextScaleSize(width, height, originalShort);
        while (scaled) {
            width = scaled.width;
            height = scaled.height;
            result = await searchAt(width, height);
            if (result.hit) {
                return {
                    width,
                    height,
                    quality: result.quality,
                    byteLength: result.byteLength,
                    passthrough: false,
                    hitTarget: true
                };
            }
            scaled = nextScaleSize(width, height, originalShort);
        }

        return {
            width,
            height,
            quality: result.quality,
            byteLength: result.byteLength,
            passthrough: false,
            hitTarget: false
        };
    }
```

Export `SEARCH_MIN_QUALITY`, `nextScaleSize`, `compressToTarget`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node regression-tests/image-processor-core.mjs`

Expected: `image-processor-core regression passed`

- [ ] **Step 5: Commit**

```bash
git add -- js/image-processor-core.js regression-tests/image-processor-core.mjs
git commit --only -m "$(cat <<'EOF'
feat: add image processor compression planner

EOF
)" -- js/image-processor-core.js regression-tests/image-processor-core.mjs
```

---

### Task 4: 图片处理页面（三标签）

**Files:**
- Create: `items/ImageProcessor.html`
- Create: `regression-tests/image-processor-page.mjs`
- Test: `regression-tests/image-processor-page.mjs`

**Interfaces:**
- Consumes: `window.ImageProcessorCore` 的 Task 1–3 API；CDN Cropper.js 1.6.2；CDN JSZip 3.10.1；`../js/theme.js`
- Produces: 可在 iframe 中打开的完整工具页

- [ ] **Step 1: Write the page structure regression**

Create `regression-tests/image-processor-page.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('items/ImageProcessor.html', 'utf8');

assert.match(page, /data-tab="watermark"/);
assert.match(page, /data-tab="crop"/);
assert.match(page, /data-tab="compress"/);
assert.match(page, /cropperjs\/1\.6\.2\/cropper\.min\.css/);
assert.match(page, /cropperjs\/1\.6\.2\/cropper\.min\.js/);
assert.match(page, /jszip\/3\.10\.1\/jszip\.min\.js/);
assert.match(page, /image-processor-core\.js/);
assert.match(page, /theme\.js/);
assert.match(page, /17tools-image-processor/);
assert.equal(page.includes('innerHTML = file.name'), false);
assert.match(page, /imageOrientation:\s*['"]from-image['"]/);

console.log('image-processor-page regression passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/image-processor-page.mjs`

Expected: FAIL with `ENOENT` for `items/ImageProcessor.html`.

- [ ] **Step 3: Create `items/ImageProcessor.html`**

把下面内容原样写入 `items/ImageProcessor.html`（不要改 CDN 版本、id、storage key 或 `imageOrientation` 字符串，页面回归测试会检查它们）：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>图片处理</title>
    <link rel="stylesheet" href="../css/theme.css">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css">
    <style>
        html, body { margin: 0; min-height: 100vh; background: var(--background-primary); color: var(--text-primary); font-family: var(--font-family); }
        .page { padding: var(--spacing-lg); max-width: 1280px; margin: 0 auto; }
        h1 { margin: 0 0 var(--spacing-lg); text-align: center; display: flex; align-items: center; justify-content: center; gap: var(--spacing-sm); font-size: 28px; }
        h1 i { color: var(--primary-color); }
        .tabs { display: flex; gap: 8px; justify-content: center; margin-bottom: var(--spacing-lg); }
        .tab-btn { background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); padding: 10px 16px; cursor: pointer; font-size: 15px; font-weight: 600; }
        .tab-btn.active { color: var(--primary-color); border-bottom-color: var(--primary-color); }
        .tab-panel { display: none; }
        .tab-panel.active { display: block; }
        .layout { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: var(--spacing-lg); }
        .preview-pane, .control-pane { background: var(--background-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--spacing-md); }
        .dropzone { min-height: 280px; border: 2px dashed var(--border-color); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; background: var(--background-tertiary); cursor: pointer; position: relative; overflow: hidden; }
        .dropzone.has-image { border-style: solid; }
        .drop-hint { text-align: center; color: var(--text-secondary); pointer-events: none; }
        #wmCanvas, #cpPreview, #cropImage { max-width: 100%; max-height: 420px; display: block; margin: 0 auto; }
        #cropWrap { max-height: 420px; }
        .thumbs { display: flex; gap: 8px; overflow-x: auto; margin-top: 12px; }
        .thumbs button { border: 2px solid transparent; background: var(--background-primary); color: var(--text-secondary); border-radius: 8px; padding: 4px; cursor: pointer; min-width: 72px; }
        .thumbs button.active { border-color: var(--primary-color); }
        .thumbs img { width: 64px; height: 48px; object-fit: cover; display: block; border-radius: 4px; }
        .thumbs span { display: block; max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
        .form-group { margin-bottom: 12px; }
        label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
        input[type="text"], input[type="number"], input[type="range"], select { width: 100%; }
        .pos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .pos-grid button, .ratio-row button, .tool-row button, .size-presets button { border: 1px solid var(--border-color); background: var(--background-primary); color: var(--text-primary); border-radius: 8px; padding: 8px; cursor: pointer; }
        .pos-grid button.active, .ratio-row button.active { background: var(--primary-light); border-color: var(--primary-color); color: var(--primary-color); }
        .ratio-row, .tool-row, .size-presets { display: flex; flex-wrap: wrap; gap: 6px; }
        .pick-btn { margin-bottom: 8px; border: 1px solid var(--border-color); background: var(--background-primary); color: var(--text-primary); border-radius: 8px; padding: 8px 12px; cursor: pointer; }
        .btn-primary { width: 100%; border: none; background: var(--primary-color); color: #fff; border-radius: 8px; padding: 12px; font-weight: 600; cursor: pointer; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .errors { white-space: pre-wrap; color: var(--error-color); font-size: 13px; min-height: 1.4em; margin-top: 8px; }
        .stats { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
        #toastContainer { position: fixed; right: 20px; top: 20px; z-index: 20; display: flex; flex-direction: column; gap: 8px; }
        .toast { background: var(--background-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; display: flex; gap: 8px; align-items: center; box-shadow: var(--shadow-md); }
        .hidden-file { display: none; }
        @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="page">
        <h1><i class="fas fa-image"></i>图片处理</h1>
        <div class="tabs">
            <button class="tab-btn active" data-tab="watermark" type="button">添加水印</button>
            <button class="tab-btn" data-tab="crop" type="button">图片裁切</button>
            <button class="tab-btn" data-tab="compress" type="button">图片压缩</button>
        </div>

        <section class="tab-panel active" data-panel="watermark">
            <div class="layout">
                <div class="preview-pane">
                    <button class="pick-btn" id="wmPick" type="button">选择图片</button>
                    <div class="dropzone" id="wmDrop">
                        <input class="hidden-file" id="wmFile" type="file" accept="image/jpeg,image/png,image/webp" multiple>
                        <div class="drop-hint" id="wmHint"><i class="fas fa-cloud-upload-alt"></i><div>点击或拖拽上传 JPEG / PNG / WebP</div></div>
                        <canvas id="wmCanvas" hidden></canvas>
                    </div>
                    <div class="thumbs" id="wmThumbs"></div>
                </div>
                <div class="control-pane">
                    <div class="form-group"><label for="wmText">水印文字</label><input id="wmText" type="text" placeholder="输入水印文字"></div>
                    <div class="form-group"><label for="wmFont">字号（短边百分比）</label><input id="wmFont" type="range" min="1" max="20" value="5"></div>
                    <div class="form-group"><label for="wmColor">颜色</label><input id="wmColor" type="color" value="#ffffff"></div>
                    <div class="form-group"><label for="wmOpacity">透明度</label><input id="wmOpacity" type="range" min="0" max="100" value="50"></div>
                    <div class="form-group"><label for="wmRotation">旋转</label><input id="wmRotation" type="range" min="-90" max="90" value="0"></div>
                    <div class="form-group"><label>位置</label><div class="pos-grid" id="wmPosition"></div></div>
                    <div class="form-group"><label><input id="wmTiled" type="checkbox"> 对角线平铺</label></div>
                    <div class="form-group"><label for="wmGap">平铺间距（短边百分比）</label><input id="wmGap" type="range" min="8" max="40" value="18"></div>
                    <button class="btn-primary" id="wmExport" type="button" disabled>导出</button>
                    <div class="errors" id="wmErrors"></div>
                </div>
            </div>
        </section>

        <section class="tab-panel" data-panel="crop">
            <div class="layout">
                <div class="preview-pane">
                    <button class="pick-btn" id="cropPick" type="button">选择图片</button>
                    <div class="dropzone" id="cropDrop">
                        <input class="hidden-file" id="cropFile" type="file" accept="image/jpeg,image/png,image/webp">
                        <div class="drop-hint" id="cropHint"><i class="fas fa-crop"></i><div>点击或拖拽上传一张图片</div></div>
                        <div id="cropWrap" hidden><img id="cropImage" alt="裁切预览"></div>
                    </div>
                </div>
                <div class="control-pane">
                    <div class="form-group"><label>比例</label><div class="ratio-row" id="cropRatios"></div></div>
                    <div class="tool-row">
                        <button type="button" id="cropRotateCcw">逆时针 90°</button>
                        <button type="button" id="cropRotateCw">顺时针 90°</button>
                        <button type="button" id="cropFlipH">水平翻转</button>
                        <button type="button" id="cropFlipV">垂直翻转</button>
                        <button type="button" id="cropReset">重置</button>
                    </div>
                    <button class="btn-primary" id="cropExport" type="button" disabled>导出</button>
                    <div class="errors" id="cropErrors"></div>
                </div>
            </div>
        </section>

        <section class="tab-panel" data-panel="compress">
            <div class="layout">
                <div class="preview-pane">
                    <button class="pick-btn" id="cpPick" type="button">选择图片</button>
                    <div class="dropzone" id="cpDrop">
                        <input class="hidden-file" id="cpFile" type="file" accept="image/jpeg,image/png,image/webp" multiple>
                        <div class="drop-hint" id="cpHint"><i class="fas fa-compress"></i><div>点击或拖拽上传 JPEG / PNG / WebP</div></div>
                        <img id="cpPreview" alt="压缩预览" hidden>
                    </div>
                    <div class="thumbs" id="cpThumbs"></div>
                </div>
                <div class="control-pane">
                    <div class="form-group"><label for="cpQuality">质量</label><input id="cpQuality" type="range" min="1" max="100" value="80"></div>
                    <div class="form-group"><label for="cpSize">目标体积</label>
                        <div style="display:flex;gap:8px;">
                            <input id="cpSize" type="number" min="0.1" step="0.1">
                            <select id="cpUnit"><option value="KB">KB</option><option value="MB">MB</option></select>
                        </div>
                    </div>
                    <div class="size-presets">
                        <button type="button" data-kb="200">200 KB</button>
                        <button type="button" data-kb="500">500 KB</button>
                        <button type="button" data-mb="1">1 MB</button>
                    </div>
                    <div class="form-group"><label for="cpFormat">输出格式</label>
                        <select id="cpFormat">
                            <option value="image/jpeg">JPEG</option>
                            <option value="image/webp">WebP</option>
                        </select>
                    </div>
                    <div class="stats" id="cpStats"></div>
                    <button class="btn-primary" id="cpExport" type="button" disabled>导出</button>
                    <div class="errors" id="cpErrors"></div>
                </div>
            </div>
        </section>
    </div>
    <div id="toastContainer"></div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="../js/image-processor-core.js"></script>
    <script>
        const core = window.ImageProcessorCore;
        const STORAGE_KEY = '17tools-image-processor';
        const POS_LABELS = { tl: '左上', t: '上', tr: '右上', l: '左', c: '中', r: '右', bl: '左下', b: '下', br: '右下' };
        const DEFAULTS = {
            watermark: { text: '', fontPercent: 5, color: '#ffffff', opacity: 50, rotation: 0, position: 'br', tiled: false, tileGapPercent: 18 },
            compress: { outputMime: 'image/jpeg' }
        };

        const state = {
            watermark: { items: [], selectedId: null },
            crop: { items: [], selectedId: null, cropper: null, ratio: 'free' },
            compress: { items: [], selectedId: null, controlMode: 'quality', previewUrl: null, lastBlob: null, lastPlan: null }
        };

        function loadSettings() {
            try {
                const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '');
                return {
                    watermark: { ...DEFAULTS.watermark, ...(parsed.watermark || {}) },
                    compress: { ...DEFAULTS.compress, ...(parsed.compress || {}) }
                };
            } catch (error) {
                return { watermark: { ...DEFAULTS.watermark }, compress: { ...DEFAULTS.compress } };
            }
        }

        const settings = loadSettings();
        function saveSettings() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                watermark: readWatermarkSettings(),
                compress: { outputMime: document.getElementById('cpFormat').value }
            }));
        }

        function showToast(message) {
            const box = document.createElement('div');
            box.className = 'toast';
            const icon = document.createElement('i');
            icon.className = 'fas fa-info-circle';
            const span = document.createElement('span');
            span.textContent = message;
            box.append(icon, span);
            document.getElementById('toastContainer').appendChild(box);
            setTimeout(() => box.remove(), 3200);
        }

        function setErrors(id, lines) {
            document.getElementById(id).textContent = lines.join('\n');
        }

        async function loadBitmap(file) {
            if (typeof createImageBitmap === 'function') {
                try {
                    return await createImageBitmap(file, { imageOrientation: 'from-image' });
                } catch (error) { /* fall through */ }
            }
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.src = url;
            await image.decode();
            URL.revokeObjectURL(url);
            return image;
        }

        function revokeItem(item) {
            if (item.url) URL.revokeObjectURL(item.url);
            if (item.bitmap && typeof item.bitmap.close === 'function') item.bitmap.close();
        }

        async function ingestFiles(tab, fileList, single) {
            const files = [...fileList];
            const bucket = state[tab];
            const errors = [];
            if (single && files.length > 1) {
                showToast('裁切一次只能处理一张，已使用第一张');
            }
            let incoming = single ? files.slice(0, 1) : files;
            if (!single && incoming.length > core.MAX_BATCH_COUNT) {
                showToast('一次最多 20 张，已忽略多余文件');
                incoming = incoming.slice(0, core.MAX_BATCH_COUNT);
            }
            const nextItems = single ? [] : bucket.items.slice();
            if (single) bucket.items.forEach(revokeItem);
            for (const file of incoming) {
                const checked = core.validateFile(file);
                if (!checked.ok) {
                    errors.push(file.name + '：' + (checked.reason === 'size' ? '单张不能超过 20 MB' : '仅支持 JPEG / PNG / WebP'));
                    continue;
                }
                try {
                    const bitmap = await loadBitmap(file);
                    const item = {
                        id: `${file.name}-${file.size}-${Math.random()}`,
                        file,
                        name: file.name,
                        mime: core.resolveMime(file.name, file.type),
                        size: file.size,
                        url: URL.createObjectURL(file),
                        bitmap,
                        width: bitmap.width,
                        height: bitmap.height
                    };
                    nextItems.push(item);
                } catch (error) {
                    errors.push(file.name + '：无法读取');
                }
            }
            bucket.items = nextItems.slice(0, core.MAX_BATCH_COUNT);
            bucket.selectedId = bucket.items[0] ? bucket.items[0].id : null;
            setErrors(tab === 'watermark' ? 'wmErrors' : tab === 'crop' ? 'cropErrors' : 'cpErrors', errors);
            if (tab === 'watermark') renderWatermark();
            if (tab === 'crop') renderCrop();
            if (tab === 'compress') renderCompress();
        }

        function selected(tab) {
            return state[tab].items.find((item) => item.id === state[tab].selectedId) || null;
        }

        function bindDrop(dropId, inputId, tab, single) {
            const drop = document.getElementById(dropId);
            const input = document.getElementById(inputId);
            drop.addEventListener('click', (event) => {
                if (event.target.closest('canvas, img, #cropWrap')) return;
                input.click();
            });
            const pick = document.getElementById(dropId.replace('Drop', 'Pick'));
            if (pick) pick.addEventListener('click', () => input.click());
            drop.addEventListener('dragover', (event) => { event.preventDefault(); });
            drop.addEventListener('drop', (event) => {
                event.preventDefault();
                ingestFiles(tab, event.dataTransfer.files, single);
            });
            input.addEventListener('change', () => ingestFiles(tab, input.files, single));
        }

        function renderThumbs(containerId, tab, onSelect) {
            const box = document.getElementById(containerId);
            box.replaceChildren();
            state[tab].items.forEach((item) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                if (item.id === state[tab].selectedId) btn.classList.add('active');
                const img = document.createElement('img');
                img.src = item.url;
                img.alt = item.name;
                const span = document.createElement('span');
                span.textContent = item.name;
                btn.append(img, span);
                btn.addEventListener('click', () => onSelect(item.id));
                box.appendChild(btn);
            });
        }

        function readWatermarkSettings() {
            return {
                text: document.getElementById('wmText').value,
                fontPercent: Number(document.getElementById('wmFont').value),
                color: document.getElementById('wmColor').value,
                opacity: Number(document.getElementById('wmOpacity').value),
                rotation: Number(document.getElementById('wmRotation').value),
                position: document.querySelector('#wmPosition button.active')?.dataset.pos || 'br',
                tiled: document.getElementById('wmTiled').checked,
                tileGapPercent: Number(document.getElementById('wmGap').value)
            };
        }

        function drawWatermark(ctx, item, wm) {
            const { width, height } = item;
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(item.bitmap, 0, 0, width, height);
            const text = wm.text.trim();
            if (!text) return;
            const minSide = Math.min(width, height);
            const fontPx = core.computeFontPx(minSide, wm.fontPercent);
            const margin = core.computeMargin(minSide);
            ctx.save();
            ctx.font = `${fontPx}px "PingFang SC", "Microsoft YaHei", sans-serif`;
            ctx.fillStyle = wm.color;
            ctx.globalAlpha = wm.opacity / 100;
            if (wm.tiled) {
                const spacing = minSide * (wm.tileGapPercent / 100);
                core.computeTileOrigins({ width, height, spacing }).forEach((origin) => {
                    ctx.save();
                    ctx.translate(origin.x, origin.y);
                    ctx.rotate(wm.rotation * Math.PI / 180);
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(text, 0, 0);
                    ctx.restore();
                });
            } else {
                const anchor = core.computeAnchor(width, height, wm.position, margin);
                ctx.translate(anchor.x, anchor.y);
                ctx.rotate(wm.rotation * Math.PI / 180);
                ctx.textAlign = anchor.textAlign;
                ctx.textBaseline = anchor.textBaseline;
                ctx.fillText(text, 0, 0);
            }
            ctx.restore();
        }

        function renderWatermark() {
            const item = selected('watermark');
            const canvas = document.getElementById('wmCanvas');
            const hint = document.getElementById('wmHint');
            const wm = readWatermarkSettings();
            document.getElementById('wmExport').disabled = !item || !wm.text.trim();
            renderThumbs('wmThumbs', 'watermark', (id) => { state.watermark.selectedId = id; renderWatermark(); });
            if (!item) {
                canvas.hidden = true;
                hint.hidden = false;
                document.getElementById('wmDrop').classList.remove('has-image');
                return;
            }
            hint.hidden = true;
            canvas.hidden = false;
            document.getElementById('wmDrop').classList.add('has-image');
            canvas.width = item.width;
            canvas.height = item.height;
            drawWatermark(canvas.getContext('2d'), item, wm);
        }

        function canvasToBlob(canvas, mime, quality) {
            return new Promise((resolve, reject) => {
                canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')), mime, quality);
            });
        }

        function downloadBlob(blob, filename) {
            const a = document.createElement('a');
            const url = URL.createObjectURL(blob);
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }

        async function exportBlobs(files, zipName) {
            if (files.length === 1) {
                downloadBlob(files[0].blob, files[0].name);
                return;
            }
            try {
                const zip = new JSZip();
                files.forEach((file) => zip.file(file.name, file.blob));
                downloadBlob(await zip.generateAsync({ type: 'blob' }), zipName);
            } catch (error) {
                showToast('ZIP 生成失败，改为逐张下载');
                files.forEach((file) => downloadBlob(file.blob, file.name));
            }
        }

        async function exportWatermark() {
            const wm = readWatermarkSettings();
            const lines = [];
            const out = [];
            for (const item of state.watermark.items) {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = item.width;
                    canvas.height = item.height;
                    drawWatermark(canvas.getContext('2d'), item, wm);
                    const quality = item.mime === 'image/png' ? undefined : 0.92;
                    const blob = await canvasToBlob(canvas, item.mime, quality);
                    out.push({ blob, name: core.buildExportName(item.name, 'watermarked', item.mime) });
                } catch (error) {
                    lines.push(item.name + '：无法导出');
                }
            }
            setErrors('wmErrors', lines);
            if (out.length) await exportBlobs(out, 'watermarked.zip');
        }

        function renderCrop() {
            const item = selected('crop');
            const wrap = document.getElementById('cropWrap');
            const hint = document.getElementById('cropHint');
            const image = document.getElementById('cropImage');
            document.getElementById('cropExport').disabled = !item;
            if (state.crop.cropper) {
                state.crop.cropper.destroy();
                state.crop.cropper = null;
            }
            if (!item) {
                wrap.hidden = true;
                hint.hidden = false;
                document.getElementById('cropDrop').classList.remove('has-image');
                return;
            }
            hint.hidden = true;
            wrap.hidden = false;
            document.getElementById('cropDrop').classList.add('has-image');
            image.onload = () => {
                if (state.crop.cropper) {
                    state.crop.cropper.destroy();
                    state.crop.cropper = null;
                }
                state.crop.cropper = new Cropper(image, { viewMode: 1, autoCropArea: 0.8, background: false, responsive: true });
                applyCropRatio();
            };
            image.src = item.url;
        }

        function applyCropRatio() {
            if (!state.crop.cropper) return;
            const value = state.crop.ratio;
            const map = { free: NaN, '1': 1, '4/3': 4 / 3, '16/9': 16 / 9, '3/4': 3 / 4, '9/16': 9 / 16 };
            state.crop.cropper.setAspectRatio(map[value]);
        }

        async function exportCrop() {
            const item = selected('crop');
            if (!item || !state.crop.cropper) return;
            try {
                const canvas = state.crop.cropper.getCroppedCanvas({
                    fillColor: item.mime === 'image/jpeg' ? '#ffffff' : undefined
                });
                if (!canvas) throw new Error('empty');
                const blob = await canvasToBlob(canvas, item.mime, item.mime === 'image/png' ? undefined : 0.92);
                downloadBlob(blob, core.buildExportName(item.name, 'cropped', item.mime));
                setErrors('cropErrors', []);
            } catch (error) {
                setErrors('cropErrors', ['裁切失败，请重新选择区域']);
            }
        }

        function debounce(fn, wait) {
            let timer = 0;
            return (...args) => {
                clearTimeout(timer);
                timer = setTimeout(() => fn(...args), wait);
            };
        }

        async function encodeBitmap(bitmap, width, height, mime, quality) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
            return canvasToBlob(canvas, mime, quality);
        }

        async function planCompress(item) {
            const mime = document.getElementById('cpFormat').value;
            const quality = core.qualityToCanvas(document.getElementById('cpQuality').value);
            const targetBytes = core.parseTargetSize(document.getElementById('cpSize').value, document.getElementById('cpUnit').value);
            const encode = async ({ width, height, quality: q }) => {
                const blob = await encodeBitmap(item.bitmap, width, height, mime, q);
                return blob.size;
            };
            if (state.compress.controlMode === 'quality' || targetBytes == null) {
                return core.compressToTarget({
                    sourceWidth: item.width, sourceHeight: item.height, sourceBytes: item.size,
                    targetBytes: targetBytes || 0, controlMode: 'quality', quality, encode
                });
            }
            return core.compressToTarget({
                sourceWidth: item.width, sourceHeight: item.height, sourceBytes: item.size,
                targetBytes, controlMode: 'size', quality, encode
            });
        }

        async function renderCompress() {
            const item = selected('compress');
            renderThumbs('cpThumbs', 'compress', (id) => { state.compress.selectedId = id; renderCompress(); });
            const preview = document.getElementById('cpPreview');
            const hint = document.getElementById('cpHint');
            document.getElementById('cpExport').disabled = !item;
            if (!item) {
                preview.hidden = true;
                hint.hidden = false;
                document.getElementById('cpStats').textContent = '';
                return;
            }
            hint.hidden = true;
            preview.hidden = false;
            document.getElementById('cpDrop').classList.add('has-image');
            const plan = await planCompress(item);
            state.compress.lastPlan = plan;
            const mime = document.getElementById('cpFormat').value;
            let blob;
            if (plan.passthrough) {
                blob = item.file;
            } else {
                blob = await encodeBitmap(item.bitmap, plan.width, plan.height, mime, plan.quality);
            }
            state.compress.lastBlob = blob;
            if (state.compress.previewUrl) URL.revokeObjectURL(state.compress.previewUrl);
            state.compress.previewUrl = URL.createObjectURL(blob);
            preview.src = state.compress.previewUrl;
            if (state.compress.controlMode === 'size') {
                document.getElementById('cpQuality').value = String(core.canvasToQuality(plan.quality));
            } else {
                const formatted = core.formatByteSize(blob.size);
                document.getElementById('cpSize').value = String(formatted.value);
                document.getElementById('cpUnit').value = formatted.unit;
            }
            const saved = item.size > 0 ? Math.max(0, Math.round((1 - blob.size / item.size) * 100)) : 0;
            const note = plan.passthrough ? ' · 已小于或等于目标，未再压缩' : '';
            document.getElementById('cpStats').textContent = `原体积 ${core.formatByteSize(item.size).text} · 结果 ${core.formatByteSize(blob.size).text} · 节省 ${saved}% · ${plan.width}×${plan.height}${note}`;
        }

        const renderCompressDebounced = debounce(renderCompress, 150);

        async function exportCompress() {
            const mime = document.getElementById('cpFormat').value;
            const lines = [];
            const out = [];
            for (const item of state.compress.items) {
                try {
                    const plan = await planCompress(item);
                    const blob = plan.passthrough
                        ? item.file
                        : await encodeBitmap(item.bitmap, plan.width, plan.height, mime, plan.quality);
                    if (!plan.hitTarget) {
                        lines.push(item.name + '：未达到目标体积，实际 ' + core.formatByteSize(blob.size).text);
                    }
                    out.push({ blob, name: core.buildExportName(item.name, 'compressed', mime) });
                } catch (error) {
                    lines.push(item.name + '：无法读取');
                }
            }
            setErrors('cpErrors', lines);
            if (out.length) await exportBlobs(out, 'compressed.zip');
        }

        function initWatermarkUi() {
            const grid = document.getElementById('wmPosition');
            core.POSITIONS.forEach((pos) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.dataset.pos = pos;
                btn.textContent = POS_LABELS[pos];
                if (pos === settings.watermark.position) btn.classList.add('active');
                btn.addEventListener('click', () => {
                    grid.querySelectorAll('button').forEach((el) => el.classList.remove('active'));
                    btn.classList.add('active');
                    renderWatermark();
                    saveSettings();
                });
                grid.appendChild(btn);
            });
            const wm = settings.watermark;
            document.getElementById('wmText').value = wm.text;
            document.getElementById('wmFont').value = String(wm.fontPercent);
            document.getElementById('wmColor').value = wm.color;
            document.getElementById('wmOpacity').value = String(wm.opacity);
            document.getElementById('wmRotation').value = String(wm.rotation);
            document.getElementById('wmTiled').checked = wm.tiled;
            document.getElementById('wmGap').value = String(wm.tileGapPercent);
            ['wmText', 'wmFont', 'wmColor', 'wmOpacity', 'wmRotation', 'wmGap'].forEach((id) => {
                document.getElementById(id).addEventListener('input', () => { renderWatermark(); saveSettings(); });
            });
            document.getElementById('wmTiled').addEventListener('change', () => {
                if (document.getElementById('wmTiled').checked && Number(document.getElementById('wmRotation').value) === 0) {
                    document.getElementById('wmRotation').value = '-22';
                }
                renderWatermark();
                saveSettings();
            });
            document.getElementById('wmExport').addEventListener('click', exportWatermark);
        }

        function initCropUi() {
            const row = document.getElementById('cropRatios');
            [['free', '自由'], ['1', '1:1'], ['4/3', '4:3'], ['16/9', '16:9'], ['3/4', '3:4'], ['9/16', '9:16']].forEach(([value, label], index) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.dataset.ratio = value;
                btn.textContent = label;
                if (index === 0) btn.classList.add('active');
                btn.addEventListener('click', () => {
                    row.querySelectorAll('button').forEach((el) => el.classList.remove('active'));
                    btn.classList.add('active');
                    state.crop.ratio = value;
                    applyCropRatio();
                });
                row.appendChild(btn);
            });
            document.getElementById('cropRotateCw').addEventListener('click', () => state.crop.cropper?.rotate(90));
            document.getElementById('cropRotateCcw').addEventListener('click', () => state.crop.cropper?.rotate(-90));
            document.getElementById('cropFlipH').addEventListener('click', () => {
                const data = state.crop.cropper?.getImageData();
                if (data) state.crop.cropper.scaleX(-data.scaleX);
            });
            document.getElementById('cropFlipV').addEventListener('click', () => {
                const data = state.crop.cropper?.getImageData();
                if (data) state.crop.cropper.scaleY(-data.scaleY);
            });
            document.getElementById('cropReset').addEventListener('click', () => state.crop.cropper?.reset());
            document.getElementById('cropExport').addEventListener('click', exportCrop);
        }

        function initCompressUi() {
            document.getElementById('cpFormat').value = settings.compress.outputMime;
            document.getElementById('cpQuality').addEventListener('input', () => {
                state.compress.controlMode = 'quality';
                renderCompressDebounced();
            });
            const onSize = () => {
                state.compress.controlMode = 'size';
                renderCompressDebounced();
            };
            document.getElementById('cpSize').addEventListener('input', onSize);
            document.getElementById('cpUnit').addEventListener('change', onSize);
            document.querySelectorAll('.size-presets button').forEach((btn) => {
                btn.addEventListener('click', () => {
                    if (btn.dataset.kb) {
                        document.getElementById('cpSize').value = btn.dataset.kb;
                        document.getElementById('cpUnit').value = 'KB';
                    } else {
                        document.getElementById('cpSize').value = btn.dataset.mb;
                        document.getElementById('cpUnit').value = 'MB';
                    }
                    state.compress.controlMode = 'size';
                    renderCompress();
                });
            });
            document.getElementById('cpFormat').addEventListener('change', () => { saveSettings(); renderCompress(); });
            document.getElementById('cpExport').addEventListener('click', exportCompress);
            const probe = document.createElement('canvas');
            probe.toBlob((blob) => {
                if (!(blob && blob.type === 'image/webp')) {
                    const option = document.querySelector('#cpFormat option[value="image/webp"]');
                    option.disabled = true;
                    option.textContent = 'WebP（当前浏览器不支持）';
                    document.getElementById('cpFormat').value = 'image/jpeg';
                }
            }, 'image/webp');
        }

        document.querySelectorAll('.tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach((el) => el.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach((el) => el.classList.remove('active'));
                btn.classList.add('active');
                document.querySelector(`[data-panel="${btn.dataset.tab}"]`).classList.add('active');
            });
        });

        bindDrop('wmDrop', 'wmFile', 'watermark', false);
        bindDrop('cropDrop', 'cropFile', 'crop', true);
        bindDrop('cpDrop', 'cpFile', 'compress', false);
        initWatermarkUi();
        initCropUi();
        initCompressUi();
        window.addEventListener('beforeunload', () => {
            ['watermark', 'crop', 'compress'].forEach((tab) => state[tab].items.forEach(revokeItem));
            if (state.compress.previewUrl) URL.revokeObjectURL(state.compress.previewUrl);
        });
    </script>
    <script src="../js/theme.js"></script>
</body>
</html>
```

- [ ] **Step 4: Run tests**

Run:

```bash
node regression-tests/image-processor-core.mjs
node regression-tests/image-processor-page.mjs
```

Expected:

```
image-processor-core regression passed
image-processor-page regression passed
```

- [ ] **Step 5: Commit**

```bash
git add -- items/ImageProcessor.html regression-tests/image-processor-page.mjs
git commit --only -m "$(cat <<'EOF'
feat: add local image processor tool page

EOF
)" -- items/ImageProcessor.html regression-tests/image-processor-page.mjs
```

---

### Task 5: 接入导航、版本与说明

**Files:**
- Modify: `index.html`（「火星文转换」`nav-item` 之后）
- Modify: `items/Welcome.html`（`17个实用工具` → `18个实用工具`；`v2.14.1` 回退展示可改为 `v2.15.0`）
- Modify: `items/History.html`（时间线顶部插入 2.15.0）
- Modify: `js/version.js`（所有失败回退 `'2.14.1'` 改为 `'2.15.0'`，文件头 `@version` 同步）
- Modify: `README.md`
- Modify: `regression-tests/image-processor-page.mjs`
- Test: `regression-tests/image-processor-page.mjs`
- Test: `regression-tests/history-layout.mjs`
- Test: `regression-tests/image-processor-core.mjs`

**Interfaces:**
- Consumes: `items/ImageProcessor.html` 已存在
- Produces: 侧栏可打开该工具；版本显示 2.15.0；Welcome 工具数为 18

- [ ] **Step 1: Extend the page regression to cover integration**

Append to `regression-tests/image-processor-page.mjs`:

```js
const index = fs.readFileSync('index.html', 'utf8');
const welcome = fs.readFileSync('items/Welcome.html', 'utf8');
const history = fs.readFileSync('items/History.html', 'utf8');
const version = fs.readFileSync('js/version.js', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');

assert.match(index, /data-file="ImageProcessor.html"/);
assert.match(index, /图片处理/);
const martianIndex = index.indexOf('data-file="MartianText.html"');
const imageIndex = index.indexOf('data-file="ImageProcessor.html"');
assert.ok(martianIndex !== -1 && imageIndex > martianIndex, '图片处理应在火星文转换之后');

assert.match(welcome, /18个实用工具/);
assert.match(history, /<!-- 版本 2\.15\.0 -->/);
assert.match(history, /版本 2\.15\.0/);
assert.match(history, /2026-08-13/);
assert.match(history, /图片处理：新增独立工具页/);
assert.match(version, /2\.15\.0/);
assert.equal(version.includes('2.14.1'), false);
assert.match(readme, /图片处理/);
assert.match(readme, /ImageProcessor\.html/);
assert.match(readme, /image-processor-core\.js/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/image-processor-page.mjs`

Expected: FAIL because `index.html` 还没有 `ImageProcessor.html`。

- [ ] **Step 3: Wire the site files**

In `index.html`, immediately after the MartianText nav item, insert:

```html
                    <div class="nav-item" data-file="ImageProcessor.html">
                        <i class="fas fa-image"></i>
                        <span>图片处理</span>
                    </div>
```

In `items/Welcome.html`, replace `17个实用工具` with `18个实用工具`.

In `items/History.html`, insert this block as the first `.version-entry` inside `.timeline`（放在 `<!-- 版本 2.14.1 -->` 之前）:

```html
            <!-- 版本 2.15.0 -->
            <div class="version-entry">
                <div class="version-dot"></div>
                <div class="version-header">
                    <div class="version-number">版本 2.15.0</div>
                    <div class="version-date">2026-08-13</div>
                </div>
                <div class="update-list">
                    <div class="feature-category">新功能</div>
                    <ul>
                        <li><span class="tag new">新增</span>图片处理：新增独立工具页和侧栏入口，支持文字水印、单张裁切和目标体积/质量联动压缩</li>
                    </ul>
                </div>
            </div>
```

In `js/version.js`, replace every `'2.14.1'` fallback and the `@version 2.14.1` comment with `2.15.0`.

In `README.md`:

- 「当前包含…」那句补上图片处理。
- 「其他工具」增加：`- 图片处理：本地添加文字水印、单张裁切，以及按目标体积或质量压缩图片。`
- 「技术实现」第三方库列表加上 Cropper.js、JSZip。
- 项目结构补上 `js/image-processor-core.js` 和 `items/ImageProcessor.html`（放在 `TireSelector.html` / `MartianText.html` 附近）。

- [ ] **Step 4: Run all related regressions**

Run:

```bash
node regression-tests/image-processor-core.mjs
node regression-tests/image-processor-page.mjs
node regression-tests/history-layout.mjs
```

Expected:

```
image-processor-core regression passed
image-processor-page regression passed
history-layout regression passed (N versions)
```

`N` 会比原来多 1（新增 2.15.0）。若 `history-layout` 因分类名单数失败，检查 2.15.0 是否只用了 `新功能`，且标签是 `tag new`。

手动核对（实现者在浏览器打开 `index.html`）：

1. 侧栏「其他工具」出现「图片处理」，点开三个标签互不串图。
2. 水印：单张预览九宫格与平铺；文字为空时不能导出；多张打 ZIP。
3. 裁切：比例、旋转 90°、翻转、重置后导出。
4. 压缩：拖质量时体积数字更新；填目标体积时滑杆更新；目标过小出现未达提示。
5. 切换深色/浅色，控件和 Cropper 区域仍然可读。

- [ ] **Step 5: Commit**

```bash
git add -- index.html items/Welcome.html items/History.html js/version.js README.md regression-tests/image-processor-page.mjs
git commit --only -m "$(cat <<'EOF'
feat: register image processor in navigation and changelog

EOF
)" -- index.html items/Welcome.html items/History.html js/version.js README.md regression-tests/image-processor-page.mjs
```

---

## Spec coverage

| Spec 条目 | Task |
| --- | --- |
| `image-processor-core.js` 校验/文件名 | 1 |
| 水印几何、体积解析、质量换算 | 2 |
| 压缩策略 passthrough / 二分 / 缩放 / 永不放大 | 3 |
| 三标签页面、Cropper、JSZip、localStorage、EXIF、错误列表 | 4 |
| 导航、Welcome 18、History 2.15.0、version.js、README | 5 |
| 非目标（Logo/盲水印/批量裁切/GIF） | 不实现 |
