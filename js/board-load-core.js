(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./local-raster-core.js'));
    } else {
        root.BoardLoadCore = factory(root.LocalRasterCore);
    }
})(typeof window !== 'undefined' ? window : globalThis, function (raster) {
    'use strict';

    const LOAD_ERRORS = {
        'not-json': '不是 JSON，无法加载',
        'missing-fields': '文件缺字段，无法加载',
        'bad-image': '图片坏了，无法加载',
        'unsafe-source': '白板只接受本地内嵌 PNG / JPEG / WebP 图片，已拒绝外部地址',
        'bad-settings': '白板设置不合法，原画板保持不变',
        'bad-coordinates': '白板坐标不合法或超出范围，原画板保持不变',
        'budget': '白板文件或图片超出安全预算，原画板保持不变。请分区保存或缩小图片',
        'timeout': '图片解码超时，原画板保持不变'
    };
    const BUDGET = Object.freeze({ fileBytes: 20 * 1024 * 1024, tiles: 64, edge: 8192, imagePixels: 16 * 1024 * 1024, totalPixels: 32 * 1024 * 1024, stagingBytes: 256 * 1024 * 1024, tileEdge: 4096, tileIndex: 1024, coordinate: 1048576, dpr: 2, exportPixels: 16 * 1024 * 1024, exportBytes: 128 * 1024 * 1024, decodeMs: 10000 });
    const plain = value => value && typeof value === 'object' && !Array.isArray(value);
    const finiteIn = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
    function validateFileSize(file, budget) {
        return file && finiteIn(file.size, 0, (budget || BUDGET).fileBytes) ? { ok: true } : { ok: false, reason: 'budget' };
    }
    function validateSettings(settings) {
        if (settings == null) return true;
        if (!plain(settings)) return false;
        const ranges = { brushSize: [1, 50], fontSize: [12, 72], eraserSize: [8, 64] };
        return Object.keys(settings).every(key => {
            if (key === 'strokeColor') return /^#[\da-f]{6}$/i.test(settings[key]);
            if (key === 'colorHistory') return Array.isArray(settings[key]) && settings[key].length <= 12 && settings[key].every(c => typeof c === 'string' && /^#[\da-f]{6}$/i.test(c));
            return ranges[key] && finiteIn(settings[key], ...ranges[key]);
        });
    }
    function validatePayload(data, customBudget) {
        const budget = { ...BUDGET, ...(customBudget || {}) };
        if (!plain(data) || (!hasTiles(data) && !hasLegacyCanvas(data))) return { ok: false, reason: 'missing-fields' };
        if (data.theme != null && !['dark', 'light'].includes(data.theme)) return { ok: false, reason: 'bad-settings' };
        if ((data.tileSize != null && data.tileSize !== 1024) || !validateSettings(data.settings)) return { ok: false, reason: 'bad-settings' };
        if (data.camera != null && (!plain(data.camera) || !finiteIn(data.camera.offsetX, -budget.coordinate, budget.coordinate) || !finiteIn(data.camera.offsetY, -budget.coordinate, budget.coordinate) || !finiteIn(data.camera.scale, 0.5, 3))) return { ok: false, reason: 'bad-coordinates' };
        const images = hasTiles(data) ? Object.entries(data.tiles) : [['legacy', data.canvas]];
        if (images.length > budget.tiles) return { ok: false, reason: 'budget' };
        let pixels = 0, bytes = 0;
        const inspected = [];
        for (const [key, source] of images) {
            if (key !== 'legacy' && (!/^(?:0|-[1-9]\d*|[1-9]\d*),(?:0|-[1-9]\d*|[1-9]\d*)$/.test(key) || key.split(',').some(n => Math.abs(Number(n)) > budget.tileIndex))) return { ok: false, reason: 'bad-coordinates' };
            const info = raster.inspectDataUrl(source, budget.fileBytes);
            if (!info.ok) return info;
            if (info.width > budget.edge || info.height > budget.edge || info.width * info.height > budget.imagePixels || (key !== 'legacy' && (info.width !== info.height || info.width > budget.tileEdge))) return { ok: false, reason: 'budget' };
            pixels += info.width * info.height; bytes += info.byteLength;
            if (pixels > budget.totalPixels || bytes > budget.fileBytes) return { ok: false, reason: 'budget' };
            inspected.push({ key, source, ...info });
        }
        return { ok: true, data, images: inspected, pixels, bytes };
    }
    function stagingBudget(candidateTiles, decodedPixels, existingPixels, dpr, customBudget) {
        const budget = { ...BUDGET, ...(customBudget || {}) };
        const scale = Math.min(budget.dpr, Math.max(1, Number(dpr) || 1));
        const bytes = (candidateTiles * Math.pow(1024 * scale, 2) + decodedPixels + existingPixels) * 4;
        return { ok: Number.isFinite(bytes) && bytes <= budget.stagingBytes, bytes, reason: 'budget' };
    }
    function exportPlan(rect, scale, dpr, customBudget) {
        const budget = { ...BUDGET, ...(customBudget || {}) };
        const factor = Number(scale) * Math.min(budget.dpr, Math.max(1, Number(dpr) || 1));
        const width = Math.ceil(rect.width * factor), height = Math.ceil(rect.height * factor);
        const bytes = width * height * 4 * 2;
        const ok = finiteIn(width, 1, budget.edge) && finiteIn(height, 1, budget.edge) && width * height <= budget.exportPixels && bytes <= budget.exportBytes;
        return { ok, width, height, factor, bytes, reason: 'budget', rect };
    }

    function loadErrorMessage(reason) {
        return LOAD_ERRORS[reason] || LOAD_ERRORS['not-json'];
    }

    function isJsonBoardFile(file) {
        if (!file) {
            return false;
        }
        const name = String(file.name || '').toLowerCase();
        const type = String(file.type || '').toLowerCase();
        if (name.endsWith('.json')) {
            return true;
        }
        return type === 'application/json' || type === 'text/json';
    }

    function chooseFileReadMode(file) {
        return isJsonBoardFile(file) ? 'text' : 'data-url';
    }

    function hasTiles(data) {
        return Boolean(data)
            && data.tiles !== null
            && typeof data.tiles === 'object'
            && !Array.isArray(data.tiles);
    }

    function hasLegacyCanvas(data) {
        return Boolean(data) && typeof data.canvas === 'string' && data.canvas.length > 0;
    }

    function isValidBoardPayload(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return false;
        }
        return hasTiles(data) || hasLegacyCanvas(data);
    }

    function parseBoardJson(text) {
        const raw = String(text || '').replace(/^\uFEFF/, '');
        let data;
        try {
            data = JSON.parse(raw);
        } catch (error) {
            return { ok: false, reason: 'not-json' };
        }
        return validatePayload(data);
    }

    function needsThemeInvert(savedTheme, currentTheme) {
        return Boolean(savedTheme) && savedTheme !== currentTheme;
    }

    return {
        LOAD_ERRORS: LOAD_ERRORS,
        BUDGET, validateFileSize, validatePayload, validateSettings, stagingBudget, exportPlan,
        loadErrorMessage: loadErrorMessage,
        isJsonBoardFile: isJsonBoardFile,
        chooseFileReadMode: chooseFileReadMode,
        hasTiles: hasTiles,
        hasLegacyCanvas: hasLegacyCanvas,
        isValidBoardPayload: isValidBoardPayload,
        parseBoardJson: parseBoardJson,
        needsThemeInvert: needsThemeInvert
    };
});
