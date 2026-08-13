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
        canvasToQuality
    };
});
