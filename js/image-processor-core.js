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
        compressToTarget
    };
});
