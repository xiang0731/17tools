(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./local-raster-core.js'));
    } else {
        root.ImageProcessorCore = factory(root.LocalRasterCore);
    }
})(typeof window !== 'undefined' ? window : globalThis, function (raster) {
    'use strict';

    const ACCEPTED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
    const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
    const MAX_FILE_BYTES = 20 * 1024 * 1024;
    const MAX_BATCH_COUNT = 20;
    const MAX_IMAGE_EDGE = 8192;
    const MAX_IMAGE_PIXELS = 4096 * 4096;
    const MAX_PREVIEW_EDGE = 1600;
    const MAX_PREVIEW_PIXELS = 1920 * 1080;
    const MAX_PREVIEW_DPR = 2;
    const BATCH_CONCURRENCY = 1;
    const MAX_ZIP_INPUT_BYTES = 100 * 1024 * 1024;
    const MIME_TO_EXT = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
    };
    const HEIC_EXTENSIONS = ['.heic', '.heif', '.heics', '.heifs'];
    const HEIC_MIMES = [
        'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'
    ];
    const HEIF_BRANDS = {
        heic: true, heix: true, heif: true, heis: true, heim: true,
        hevc: true, hevx: true, mif1: true, msf1: true
    };
    const AVIF_BRANDS = { avif: true, avis: true };
    const REJECTED_FILE_MESSAGES = {
        heic: '不支持 HEIC。请改用 JPEG / PNG / WebP。iPhone 可先在相册中「导出兼容照片」再上传。',
        gif: '不支持 GIF。请改用 JPEG / PNG / WebP。',
        type: '仅支持 JPEG / PNG / WebP。iPhone 拍摄的 HEIC 可先「导出兼容照片」。',
        size: '单张不能超过 20 MB'
    };

    // 用途转换不修改用户的区域记录；切回效果模式或撤销仍能恢复原效果。
    function privacyRegion(region) {
        const color = /^#[0-9a-f]{6}$/i.test(String(region.solidColor || '')) ? region.solidColor : '#000000';
        if (region.kind === 'rect') {
            const x = Math.floor(region.x) - 1, y = Math.floor(region.y) - 1;
            return { ...region, effect: 'solid', solidColor: color, x, y, w: Math.ceil(region.x + region.w) + 1 - x, h: Math.ceil(region.y + region.h) + 1 - y, privacy: true };
        }
        return { ...region, effect: 'solid', solidColor: color, brushRadius: (region.brushRadius || 1) + 2, privacy: true };
    }
    function inspectMetadata(bytes) {
        const info = raster.inspect(bytes);
        return { ok: info.ok, format: info.mime, fields: info.metadata, scope: 'JPEG EXIF/XMP/IPTC/注释，PNG EXIF/文字块，WebP EXIF/XMP' };
    }

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

    function asBytes(input) {
        if (!input) return new Uint8Array(0);
        if (input instanceof Uint8Array) return input;
        if (typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) {
            return new Uint8Array(input);
        }
        return new Uint8Array(0);
    }

    function fourcc(bytes, offset) {
        if (offset + 4 > bytes.length) return '';
        return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    }

    function sniffImageFormat(input) {
        const bytes = asBytes(input);
        if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
            return 'jpeg';
        }
        if (
            bytes.length >= 8
            && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
            && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
        ) {
            return 'png';
        }
        if (
            bytes.length >= 12
            && fourcc(bytes, 0) === 'RIFF'
            && fourcc(bytes, 8) === 'WEBP'
        ) {
            return 'webp';
        }
        if (
            bytes.length >= 6
            && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38
            && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
        ) {
            return 'gif';
        }
        if (bytes.length >= 12 && fourcc(bytes, 4) === 'ftyp') {
            const major = fourcc(bytes, 8);
            if (AVIF_BRANDS[major]) return 'avif';
            const boxSize = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
            const end = Math.min(bytes.length, boxSize > 0 ? boxSize : bytes.length);
            if (HEIF_BRANDS[major]) return 'heic';
            for (let offset = 16; offset + 4 <= end; offset += 4) {
                const brand = fourcc(bytes, offset);
                if (AVIF_BRANDS[brand]) return 'avif';
                if (HEIF_BRANDS[brand]) return 'heic';
            }
        }
        return 'unknown';
    }

    function classifyRejectedType(name, type) {
        const ext = getExtension(name);
        const mime = String(type || '').toLowerCase();
        if (HEIC_EXTENSIONS.includes(ext) || HEIC_MIMES.includes(mime)) return 'heic';
        if (ext === '.gif' || mime === 'image/gif') return 'gif';
        return 'type';
    }

    function rejectedFileMessage(reason) {
        return REJECTED_FILE_MESSAGES[reason] || REJECTED_FILE_MESSAGES.type;
    }

    function rejectedFormatReason(format) {
        if (format === 'heic' || format === 'gif') return format;
        if (format === 'jpeg' || format === 'png' || format === 'webp' || format === 'unknown') return null;
        return 'type';
    }

    function validateFile({ name, type, size }) {
        const ext = getExtension(name);
        const mimeOk = ACCEPTED_MIMES.includes(type);
        const extOk = ACCEPTED_EXTENSIONS.includes(ext);
        const rejected = classifyRejectedType(name, type);
        if (rejected === 'heic' || rejected === 'gif') {
            return { ok: false, reason: rejected };
        }
        if (!mimeOk && !extOk) {
            return { ok: false, reason: 'type' };
        }
        if (typeof size === 'number' && size > MAX_FILE_BYTES) {
            return { ok: false, reason: 'size' };
        }
        return { ok: true };
    }

    function u16(bytes, offset, littleEndian) {
        return littleEndian
            ? bytes[offset] | (bytes[offset + 1] << 8)
            : (bytes[offset] << 8) | bytes[offset + 1];
    }

    function u32(bytes, offset, littleEndian) {
        return littleEndian
            ? (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
            : ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    }

    function parseExifOrientation(payload) {
        if (!payload || payload.length < 14) return null;
        if (!(
            payload[0] === 0x45 && payload[1] === 0x78 && payload[2] === 0x69 && payload[3] === 0x66
            && payload[4] === 0 && payload[5] === 0
        )) {
            return null;
        }
        const tiff = 6;
        const littleEndian = payload[tiff] === 0x49 && payload[tiff + 1] === 0x49;
        const bigEndian = payload[tiff] === 0x4D && payload[tiff + 1] === 0x4D;
        if (!littleEndian && !bigEndian) return null;
        if (u16(payload, tiff + 2, littleEndian) !== 0x002A) return null;
        const ifd0 = tiff + u32(payload, tiff + 4, littleEndian);
        if (ifd0 < tiff || ifd0 + 2 > payload.length) return null;
        const count = u16(payload, ifd0, littleEndian);
        for (let index = 0; index < count; index += 1) {
            const entry = ifd0 + 2 + index * 12;
            if (entry + 12 > payload.length) break;
            if (u16(payload, entry, littleEndian) !== 0x0112) continue;
            const type = u16(payload, entry + 2, littleEndian);
            const valueCount = u32(payload, entry + 4, littleEndian);
            if (valueCount !== 1) continue;
            const value = type === 3
                ? u16(payload, entry + 8, littleEndian)
                : type === 4
                    ? u32(payload, entry + 8, littleEndian)
                    : 0;
            if (value >= 1 && value <= 8) return value;
        }
        return null;
    }

    function readJpegLayout(input) {
        const bytes = asBytes(input);
        const result = { orientation: 1, encodedWidth: 0, encodedHeight: 0 };
        if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
            return result;
        }
        let offset = 2;
        let sawOrientation = false;
        while (offset + 3 < bytes.length) {
            if (bytes[offset] !== 0xFF) {
                offset += 1;
                continue;
            }
            const marker = bytes[offset + 1];
            if (marker === 0xFF) {
                offset += 1;
                continue;
            }
            if (marker === 0xD9 || marker === 0xDA) break;
            if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
                offset += 2;
                continue;
            }
            const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
            if (length < 2) break;
            const dataStart = offset + 4;
            const dataEnd = offset + 2 + length;
            if (dataEnd > bytes.length) break;
            if (marker === 0xE1 && !sawOrientation) {
                const parsed = parseExifOrientation(bytes.subarray(dataStart, dataEnd));
                if (parsed) {
                    result.orientation = parsed;
                    sawOrientation = true;
                }
            }
            if (
                marker >= 0xC0 && marker <= 0xCF
                && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC
                && dataStart + 5 <= dataEnd
                && result.encodedWidth === 0
            ) {
                result.encodedHeight = (bytes[dataStart + 1] << 8) | bytes[dataStart + 2];
                result.encodedWidth = (bytes[dataStart + 3] << 8) | bytes[dataStart + 4];
            }
            offset = dataEnd;
        }
        return result;
    }

    function orientationSwapsSize(orientation) {
        const value = Number(orientation);
        return value >= 5 && value <= 8;
    }

    function orientedSize(width, height, orientation) {
        const w = Math.max(0, Math.floor(Number(width) || 0));
        const h = Math.max(0, Math.floor(Number(height) || 0));
        if (orientationSwapsSize(orientation)) {
            return { width: h, height: w };
        }
        return { width: w, height: h };
    }

    function exifOrientationTransform(orientation, sourceWidth, sourceHeight) {
        const width = Number(sourceWidth) || 0;
        const height = Number(sourceHeight) || 0;
        switch (Number(orientation)) {
            case 2: return { a: -1, b: 0, c: 0, d: 1, e: width, f: 0 };
            case 3: return { a: -1, b: 0, c: 0, d: -1, e: width, f: height };
            case 4: return { a: 1, b: 0, c: 0, d: -1, e: 0, f: height };
            case 5: return { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0 };
            case 6: return { a: 0, b: 1, c: -1, d: 0, e: height, f: 0 };
            case 7: return { a: 0, b: -1, c: -1, d: 0, e: height, f: width };
            case 8: return { a: 0, b: -1, c: 1, d: 0, e: 0, f: width };
            default: return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        }
    }

    function decideOrientationAction(options) {
        const orientation = Math.round(Number(options && options.orientation) || 1);
        if (orientation <= 1) return { action: 'none', orientation: 1 };
        const encodedWidth = Math.floor(Number(options && options.encodedWidth) || 0);
        const encodedHeight = Math.floor(Number(options && options.encodedHeight) || 0);
        const decodedWidth = Math.floor(Number(options && options.decodedWidth) || 0);
        const decodedHeight = Math.floor(Number(options && options.decodedHeight) || 0);
        const encodedKnown = encodedWidth > 0 && encodedHeight > 0;
        const matchesEncoded = encodedKnown
            && decodedWidth === encodedWidth && decodedHeight === encodedHeight;
        const matchesOriented = encodedKnown
            && decodedWidth === encodedHeight && decodedHeight === encodedWidth;
        if (orientationSwapsSize(orientation)) {
            if (matchesEncoded) return { action: 'apply', orientation };
            if (matchesOriented) return { action: 'none', orientation };
            return { action: 'fail', orientation };
        }
        if (options && options.requestedNone) {
            return { action: 'apply', orientation };
        }
        return { action: 'fail', orientation };
    }

    function validateImageDimensions(width, height, limits = {}) {
        const w = Math.floor(Number(width));
        const h = Math.floor(Number(height));
        const maxEdge = Number(limits.maxEdge) || MAX_IMAGE_EDGE;
        const maxPixels = Number(limits.maxPixels) || MAX_IMAGE_PIXELS;
        if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
            return { ok: false, reason: 'dimensions', width: w, height: h, pixels: 0 };
        }
        const pixels = w * h;
        if (w > maxEdge || h > maxEdge) {
            return { ok: false, reason: 'edge', width: w, height: h, pixels };
        }
        if (!Number.isSafeInteger(pixels) || pixels > maxPixels) {
            return { ok: false, reason: 'pixels', width: w, height: h, pixels };
        }
        return { ok: true, width: w, height: h, pixels };
    }

    function computePreviewSize(options) {
        const sourceWidth = Math.max(1, Math.floor(Number(options && options.sourceWidth) || 1));
        const sourceHeight = Math.max(1, Math.floor(Number(options && options.sourceHeight) || 1));
        const containerWidth = Math.max(1, Number(options && options.containerWidth) || 960);
        const containerHeight = Math.max(1, Number(options && options.containerHeight) || 720);
        const dpr = Math.min(MAX_PREVIEW_DPR, Math.max(1, Number(options && options.dpr) || 1));
        const maxEdge = Math.max(1, Number(options && options.maxEdge) || MAX_PREVIEW_EDGE);
        const maxPixels = Math.max(1, Number(options && options.maxPixels) || MAX_PREVIEW_PIXELS);
        const sourcePixels = sourceWidth * sourceHeight;
        const scale = Math.min(
            1,
            (containerWidth * dpr) / sourceWidth,
            (containerHeight * dpr) / sourceHeight,
            maxEdge / sourceWidth,
            maxEdge / sourceHeight,
            Math.sqrt(maxPixels / sourcePixels)
        );
        const width = Math.max(1, Math.floor(sourceWidth * scale));
        const height = Math.max(1, Math.floor(sourceHeight * scale));
        return {
            width,
            height,
            scale: Math.min(width / sourceWidth, height / sourceHeight),
            pixels: width * height
        };
    }

    function scaleRedactRegion(region, scaleX, scaleY) {
        const sx = Number.isFinite(Number(scaleX)) ? Number(scaleX) : 1;
        const sy = Number.isFinite(Number(scaleY)) ? Number(scaleY) : sx;
        const radiusScale = Math.min(Math.abs(sx), Math.abs(sy));
        const scaled = {
            ...region,
            x: Number(region.x) * sx,
            y: Number(region.y) * sy,
            w: Number(region.w) * sx,
            h: Number(region.h) * sy,
            brushRadius: region.brushRadius == null ? null : Number(region.brushRadius) * radiusScale,
            mosaicSize: region.mosaicSize == null ? null : Math.max(1, Number(region.mosaicSize) * radiusScale)
        };
        if (Array.isArray(region.points)) {
            scaled.points = region.points.map((point) => ({
                x: Number(point.x) * sx,
                y: Number(point.y) * sy
            }));
        }
        return scaled;
    }

    const BATCH_TRANSITIONS = Object.freeze({
        queued: Object.freeze({ start: 'running', cancel: 'cancelled' }),
        running: Object.freeze({ resolve: 'success', reject: 'error' }),
        success: Object.freeze({}),
        error: Object.freeze({}),
        cancelled: Object.freeze({})
    });

    function transitionBatchStatus(current, event) {
        const next = BATCH_TRANSITIONS[current] && BATCH_TRANSITIONS[current][event];
        if (!next) {
            const error = new Error(`Invalid batch transition: ${current} -> ${event}`);
            error.code = 'invalid-batch-transition';
            throw error;
        }
        return next;
    }

    function summarizeBatch(records) {
        const counts = { queued: 0, running: 0, success: 0, error: 0, cancelled: 0 };
        (Array.isArray(records) ? records : []).forEach((record) => {
            if (Object.prototype.hasOwnProperty.call(counts, record.status)) counts[record.status] += 1;
        });
        const completed = counts.success + counts.error + counts.cancelled;
        return { ...counts, completed, total: Array.isArray(records) ? records.length : 0 };
    }

    async function runControlledBatch(items, worker, options = {}) {
        const list = Array.isArray(items) ? items : [];
        const concurrency = Math.max(1, Math.min(
            list.length || 1,
            Math.floor(Number(options.concurrency) || BATCH_CONCURRENCY)
        ));
        const shouldCancel = typeof options.shouldCancel === 'function' ? options.shouldCancel : () => false;
        const onUpdate = typeof options.onUpdate === 'function' ? options.onUpdate : () => {};
        const records = list.map((item, index) => ({
            item,
            index,
            status: 'queued',
            result: null,
            error: null
        }));
        let cursor = 0;
        let cancellationApplied = false;

        function notify(record, current) {
            onUpdate({ record, records, current, total: records.length, summary: summarizeBatch(records) });
        }

        function cancelQueued() {
            if (cancellationApplied) return;
            cancellationApplied = true;
            records.forEach((record) => {
                if (record.status !== 'queued') return;
                record.status = transitionBatchStatus(record.status, 'cancel');
                notify(record, null);
            });
        }

        async function runner() {
            while (cursor < records.length) {
                if (shouldCancel()) {
                    cancelQueued();
                    return;
                }
                const recordIndex = cursor;
                cursor += 1;
                const record = records[recordIndex];
                if (record.status !== 'queued') continue;
                record.status = transitionBatchStatus(record.status, 'start');
                notify(record, recordIndex + 1);
                try {
                    record.result = await worker(record.item, recordIndex, record);
                    record.status = transitionBatchStatus(record.status, 'resolve');
                } catch (error) {
                    record.error = error;
                    record.status = transitionBatchStatus(record.status, 'reject');
                }
                notify(record, recordIndex + 1);
            }
        }

        await Promise.all(Array.from({ length: concurrency }, () => runner()));
        if (shouldCancel()) cancelQueued();
        return records;
    }

    const CLEANUP_REASONS = Object.freeze(['replace', 'delete', 'reset', 'tab-switch', 'page-leave']);

    function resourceCleanupDecision(reason) {
        if (!CLEANUP_REASONS.includes(reason)) {
            return {
                releaseItems: false,
                releasePreviews: false,
                revokeItemUrls: false,
                revokeTransientUrls: false,
                releaseCanvases: false,
                releaseBlobs: false,
                cancelQueued: false,
                discardResults: false
            };
        }
        const releaseItems = reason !== 'tab-switch';
        return {
            releaseItems,
            releasePreviews: true,
            revokeItemUrls: releaseItems,
            revokeTransientUrls: true,
            releaseCanvases: true,
            releaseBlobs: true,
            cancelQueued: true,
            discardResults: true
        };
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

    const WATERMARK_PRESETS = {
        display: { fontPercent: 5, opacity: 45, rotation: -22, tileGapPercent: 22,
            style: 'fill', tiled: true, randomized: false, mainEnabled: false, mainOpaque: false, bold: false },
        enhanced: { fontPercent: 5, opacity: 70, rotation: -25, tileGapPercent: 16,
            style: 'fill', tiled: true, randomized: true, mainEnabled: true, mainOpaque: true, bold: true }
    };
    const MAX_WATERMARK_TILES = 600;

    function watermarkIsVisible(wm) {
        return !!String(wm.text || '').trim()
            && (Number(wm.opacity) > 0 || (wm.style !== 'banner' && !!wm.mainEnabled && !!wm.mainOpaque));
    }

    function watermarkOutputSize(width, height, maxSide) {
        const limit = [960, 1280, 1920].includes(Number(maxSide)) ? Number(maxSide) : 0;
        const scale = limit ? Math.min(1, limit / Math.max(width, height)) : 1;
        return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
    }

    // Coordinates and random draws are independent of preview/output resolution.
    function computeWatermarkTiles({ width, height, spacing, textWidth = 0, fontPx = 1, rotation = 0, randomized = false, seed = 1 }) {
        if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) return [];
        let randomState = Number(seed) >>> 0;
        const random = () => {
            randomState = (randomState + 0x6D2B79F5) >>> 0;
            let n = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
            n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
            return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
        };
        const angle = Number(rotation) * Math.PI / 180;
        const step = Math.max(1, Number(spacing) || 1);
        let stepX = Math.max(step, Math.abs(Math.cos(angle)) * textWidth * 1.1 + fontPx);
        let stepY = Math.max(step, Math.abs(Math.sin(angle)) * textWidth * 1.1 + fontPx);
        // Bound both tile count and allocation for very narrow / tall images.
        while (Math.ceil(width / stepX) * Math.ceil(height / stepY) > MAX_WATERMARK_TILES) {
            stepX *= 1.15;
            stepY *= 1.15;
        }
        const columns = Math.max(1, Math.floor(width / stepX));
        const rows = Math.max(1, Math.floor(height / stepY));
        stepX = width / columns;
        stepY = height / rows;
        const tiles = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columns; col++) {
                let x = (col + 0.5) * stepX;
                let y = (row + 0.5) * stepY;
                if (randomized && row % 2) x = ((col + 1) * stepX) % width;
                const jitterX = randomized ? (random() * 2 - 1) * stepX * 0.08 : 0;
                const jitterY = randomized ? (random() * 2 - 1) * stepY * 0.08 : 0;
                tiles.push({
                    x: Math.min(width, Math.max(0, x + jitterX)),
                    y: Math.min(height, Math.max(0, y + jitterY)),
                    rotation: Number(rotation) + (randomized ? (random() * 2 - 1) * 6 : 0),
                    fontScale: randomized ? 0.9 + random() * 0.2 : 1,
                    opacityScale: randomized ? 0.92 + random() * 0.16 : 1
                });
            }
        }
        return tiles;
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

    function nextFlipScale(current) {
        const n = Number(current);
        const base = Number.isFinite(n) && n !== 0 ? n : 1;
        return -base;
    }

    function shouldOpenFilePickerOnDropClick(tab, hasItems) {
        if (!hasItems) return true;
        return tab !== 'watermark' && tab !== 'crop' && tab !== 'redact';
    }

    const PREVIEW_ZOOM_MIN = 1;
    const PREVIEW_ZOOM_MAX = 8;
    const PREVIEW_ZOOM_FACTOR = 1.1;

    function previewZoomFactor(deltaY) {
        return Number(deltaY) < 0 ? PREVIEW_ZOOM_FACTOR : 1 / PREVIEW_ZOOM_FACTOR;
    }

    function zoomPreviewToward({
        scale, tx, ty, factor, px, py, ox, oy,
        min = PREVIEW_ZOOM_MIN, max = PREVIEW_ZOOM_MAX
    }) {
        const current = Number(scale);
        const safeScale = Number.isFinite(current) && current > 0 ? current : 1;
        const nextScale = Math.min(max, Math.max(min, safeScale * Number(factor)));
        if (!Number.isFinite(nextScale)) return { scale: safeScale, tx, ty };
        if (nextScale === min) return { scale: min, tx: 0, ty: 0 };
        if (nextScale === safeScale) return { scale: safeScale, tx, ty };
        const k = nextScale / safeScale;
        return {
            scale: nextScale,
            tx: px - ox - k * (px - ox - tx),
            ty: py - oy - k * (py - oy - ty)
        };
    }

    function previewTransformCss({ scale, tx, ty }) {
        return `translate(${tx}px, ${ty}px) scale(${scale})`;
    }

    return {
        privacyRegion,
        inspectMetadata,
        ACCEPTED_MIMES,
        ACCEPTED_EXTENSIONS,
        MAX_FILE_BYTES,
        MAX_BATCH_COUNT,
        MAX_IMAGE_EDGE,
        MAX_IMAGE_PIXELS,
        MAX_PREVIEW_EDGE,
        MAX_PREVIEW_PIXELS,
        MAX_PREVIEW_DPR,
        BATCH_CONCURRENCY,
        MAX_ZIP_INPUT_BYTES,
        REJECTED_FILE_MESSAGES,
        sniffImageFormat,
        classifyRejectedType,
        rejectedFileMessage,
        rejectedFormatReason,
        validateFile,
        readJpegLayout,
        orientationSwapsSize,
        orientedSize,
        exifOrientationTransform,
        decideOrientationAction,
        validateImageDimensions,
        computePreviewSize,
        scaleRedactRegion,
        BATCH_TRANSITIONS,
        transitionBatchStatus,
        summarizeBatch,
        runControlledBatch,
        CLEANUP_REASONS,
        resourceCleanupDecision,
        resolveMime,
        buildExportName,
        POSITIONS,
        computeFontPx,
        computeMargin,
        computeAnchor,
        computeTileOrigins,
        WATERMARK_PRESETS,
        MAX_WATERMARK_TILES,
        watermarkIsVisible,
        watermarkOutputSize,
        computeWatermarkTiles,
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
        brushRadiusFromPercent,
        nextFlipScale,
        shouldOpenFilePickerOnDropClick,
        PREVIEW_ZOOM_MIN,
        PREVIEW_ZOOM_MAX,
        PREVIEW_ZOOM_FACTOR,
        previewZoomFactor,
        zoomPreviewToward,
        previewTransformCss
    };
});
