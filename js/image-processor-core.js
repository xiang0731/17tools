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
