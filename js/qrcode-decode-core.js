(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.QRCodeDecodeCore = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';
    const BUDGET = Object.freeze({ fileBytes: 10 * 1024 * 1024, edge: 8192, pixels: 16 * 1024 * 1024, scanPixels: 4 * 1024 * 1024, codes: 8 });
    function validateImage(info, bytes, customBudget) {
        const b = { ...BUDGET, ...(customBudget || {}) };
        if (!info || !info.ok || !['image/png', 'image/jpeg', 'image/webp'].includes(info.mime)) return { ok: false, reason: 'format' };
        if (!Number.isFinite(bytes) || bytes > b.fileBytes || info.width > b.edge || info.height > b.edge || info.width * info.height > b.pixels) return { ok: false, reason: 'budget' };
        const scale = Math.min(1, Math.sqrt(b.scanPixels / (info.width * info.height)));
        return { ok: true, width: Math.max(1, Math.floor(info.width * scale)), height: Math.max(1, Math.floor(info.height * scale)), resized: scale < 1 };
    }
    function maskCode(pixels, width, height, location) {
        const corners = ['topLeftCorner', 'topRightCorner', 'bottomLeftCorner', 'bottomRightCorner'].map(k => location && location[k]);
        if (corners.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return false;
        const x0 = Math.max(0, Math.floor(Math.min(...corners.map(p => p.x))) - 3);
        const y0 = Math.max(0, Math.floor(Math.min(...corners.map(p => p.y))) - 3);
        const x1 = Math.min(width, Math.ceil(Math.max(...corners.map(p => p.x))) + 3);
        const y1 = Math.min(height, Math.ceil(Math.max(...corners.map(p => p.y))) + 3);
        if (x1 <= x0 || y1 <= y0) return false;
        for (let y = y0; y < y1; y++) pixels.fill(255, (y * width + x0) * 4, (y * width + x1) * 4);
        return true;
    }
    async function decodeMultiple(imageData, decoder, yieldTask, maxCodes) {
        const { width, height } = imageData;
        if (typeof decoder !== 'function') return { ok: false, reason: 'unsupported', codes: [] };
        if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width * height > BUDGET.scanPixels || imageData.data.length !== width * height * 4) return { ok: false, reason: 'budget', codes: [] };
        const pixels = new Uint8ClampedArray(imageData.data);
        const codes = [], count = Math.min(BUDGET.codes, Math.max(1, maxCodes || BUDGET.codes));
        // 并排二维码的定位点可能互相干扰。整图后分区重试；遮盖定位区防止重复。
        const regions = [{ x: 0, y: 0, w: width, h: height }];
        for (const [columns, rows] of [[2, 1], [1, 2], [2, 2]]) {
            for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
                const x0 = Math.max(0, Math.floor(x * width / columns - width * 0.04));
                const y0 = Math.max(0, Math.floor(y * height / rows - height * 0.04));
                const x1 = Math.min(width, Math.ceil((x + 1) * width / columns + width * 0.04));
                const y1 = Math.min(height, Math.ceil((y + 1) * height / rows + height * 0.04));
                regions.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
            }
        }
        for (const region of regions) {
            while (codes.length < count) {
                const crop = new Uint8ClampedArray(region.w * region.h * 4);
                for (let y = 0; y < region.h; y++) crop.set(pixels.subarray(((y + region.y) * width + region.x) * 4, ((y + region.y) * width + region.x + region.w) * 4), y * region.w * 4);
                const code = decoder(crop, region.w, region.h, { inversionAttempts: 'attemptBoth' });
                if (!code) break;
                const location = {};
                Object.entries(code.location || {}).forEach(([key, point]) => { location[key] = { x: point.x + region.x, y: point.y + region.y }; });
                codes.push({ data: code.data, location, version: code.version });
                if (!maskCode(pixels, width, height, location)) break;
                if (yieldTask) await yieldTask();
            }
            if (codes.length === count) break;
            if (yieldTask) await yieldTask();
        }
        return { ok: true, codes, limited: codes.length === count };
    }
    return { BUDGET, validateImage, decodeMultiple, maskCode };
});
