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

    const POSITIONS = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'];

    function computeFontPx(minSide, percent) {
        const n = Number(percent);
        const p = Math.min(20, Math.max(1, Number.isFinite(n) ? n : 5));
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

        const minShort = Math.min(MIN_SHORT_SIDE_CAP, originalShort);
        // Proportional clamp closes the gap when discrete 0.9 steps cannot land on the floor.
        if (!result.hit && Math.min(width, height) > minShort) {
            const ratio = minShort / Math.min(width, height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
            result = await searchAt(width, height);
        }

        return {
            width,
            height,
            quality: result.quality,
            byteLength: result.byteLength,
            passthrough: false,
            hitTarget: result.hit
        };
    }

    function clampRect(rect, width, height) {
        let x = Number(rect && rect.x);
        let y = Number(rect && rect.y);
        let w = Number(rect && rect.w);
        let h = Number(rect && rect.h);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
            return null;
        }
        if (w < 0) {
            x += w;
            w = -w;
        }
        if (h < 0) {
            y += h;
            h = -h;
        }
        const left = Math.max(0, Math.round(x));
        const top = Math.max(0, Math.round(y));
        const right = Math.min(width, Math.round(x + w));
        const bottom = Math.min(height, Math.round(y + h));
        const nw = right - left;
        const nh = bottom - top;
        if (nw < 1 || nh < 1) return null;
        return { x: left, y: top, w: nw, h: nh };
    }

    function computeMosaicCells(rect, mosaicSize) {
        const size = Math.min(64, Math.max(8, Math.round(Number(mosaicSize) || 16)));
        const x0 = Math.round(rect.x);
        const y0 = Math.round(rect.y);
        const w = Math.round(rect.w);
        const h = Math.round(rect.h);
        const cells = [];
        for (let y = y0; y < y0 + h; y += size) {
            for (let x = x0; x < x0 + w; x += size) {
                cells.push({
                    x,
                    y,
                    w: Math.max(1, Math.min(size, x0 + w - x)),
                    h: Math.max(1, Math.min(size, y0 + h - y))
                });
            }
        }
        return cells;
    }

    function computeEmojiTiles(rect) {
        const x0 = Math.round(rect.x);
        const y0 = Math.round(rect.y);
        const w = Math.max(0, Math.round(rect.w));
        const h = Math.max(0, Math.round(rect.h));
        const cellSize = Math.min(64, Math.max(1, Math.min(w, h)));
        const tiles = [];
        const cols = Math.floor(w / cellSize);
        const rows = Math.floor(h / cellSize);
        for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
                tiles.push({
                    x: x0 + col * cellSize,
                    y: y0 + row * cellSize,
                    size: cellSize
                });
            }
        }
        return tiles;
    }

    function simplifyPoints(points, minDist) {
        const list = Array.isArray(points) ? points : [];
        const threshold = minDist == null ? 1 : Number(minDist);
        if (list.length <= 1) return list.map((p) => ({ x: p.x, y: p.y }));
        const out = [{ x: list[0].x, y: list[0].y }];
        for (let i = 1; i < list.length - 1; i += 1) {
            const prev = out[out.length - 1];
            const cur = list[i];
            if (Math.hypot(cur.x - prev.x, cur.y - prev.y) >= threshold) {
                out.push({ x: cur.x, y: cur.y });
            }
        }
        const last = list[list.length - 1];
        const tail = out[out.length - 1];
        if (tail.x !== last.x || tail.y !== last.y) {
            out.push({ x: last.x, y: last.y });
        }
        return out;
    }

    function hitTestRect(rect, x, y) {
        return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
    }

    function distToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.hypot(px - ax, py - ay);
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }

    function hitTestStroke(points, radius, x, y) {
        const list = Array.isArray(points) ? points : [];
        const r = Number(radius) || 0;
        if (!list.length) return false;
        if (list.length === 1) {
            return Math.hypot(x - list[0].x, y - list[0].y) <= r;
        }
        for (let i = 1; i < list.length; i += 1) {
            const a = list[i - 1];
            const b = list[i];
            if (distToSegment(x, y, a.x, a.y, b.x, b.y) <= r) return true;
        }
        return false;
    }

    function brushRadiusFromPercent(minSide, percent) {
        const p = Math.min(12, Math.max(1, Number(percent) || 4));
        const diameter = Math.max(4, (Number(minSide) * p) / 100);
        return diameter / 2;
    }

    return {
        ACCEPTED_MIMES,
        ACCEPTED_EXTENSIONS,
        MAX_FILE_BYTES,
        MAX_BATCH_COUNT,
        validateFile,
        resolveMime,
        buildExportName,
        POSITIONS,
        computeFontPx,
        computeMargin,
        computeAnchor,
        computeTileOrigins,
        parseTargetSize,
        formatByteSize,
        qualityToCanvas,
        canvasToQuality,
        SEARCH_MIN_QUALITY,
        nextScaleSize,
        compressToTarget,
        clampRect,
        computeMosaicCells,
        computeEmojiTiles,
        simplifyPoints,
        hitTestRect,
        hitTestStroke,
        brushRadiusFromPercent
    };
});
