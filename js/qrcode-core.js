(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.QRCodeCore = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const TYPES = ['text', 'url', 'wifi', 'vcard', 'email', 'tel', 'sms'];
    const FILE_STEM = {
        text: 'text', url: 'url', wifi: 'wifi', vcard: 'vcard',
        email: 'email', tel: 'tel', sms: 'sms'
    };
    const MAX_TEXT_LENGTH = 1200;
    const SIZES = [128, 256, 512, 1024];
    const ECC_LEVELS = ['L', 'M', 'Q', 'H'];
    const STORAGE_KEY = '17tools-qrcode';
    const DEFAULT_STYLE = {
        type: 'text',
        foreground: '#000000',
        background: '#FFFFFF',
        size: 256,
        ecc: 'M'
    };
    const MSG = {
        textEmpty: '请输入内容',
        textTooLong: '内容不超过 1200 字'
    };

    function fail(errors) {
        return { ok: false, errors: errors };
    }

    function ok(payload) {
        return { ok: true, payload: payload };
    }

    function trim(value) {
        return String(value == null ? '' : value).trim();
    }

    function normalizeHex(value, fallback) {
        const raw = String(value || '').trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(raw)) {
            return raw.toUpperCase();
        }
        if (/^#[0-9A-Fa-f]{3}$/.test(raw)) {
            return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
        }
        return fallback;
    }

    function parseStyle(input) {
        const src = input && typeof input === 'object' ? input : {};
        return {
            type: TYPES.includes(src.type) ? src.type : DEFAULT_STYLE.type,
            foreground: normalizeHex(src.foreground, DEFAULT_STYLE.foreground),
            background: normalizeHex(src.background, DEFAULT_STYLE.background),
            size: SIZES.includes(Number(src.size)) ? Number(src.size) : DEFAULT_STYLE.size,
            ecc: ECC_LEVELS.includes(src.ecc) ? src.ecc : DEFAULT_STYLE.ecc
        };
    }

    function channelLuminance(value) {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }

    function hexToRgb(hex) {
        const n = normalizeHex(hex, '#000000');
        return {
            r: parseInt(n.slice(1, 3), 16),
            g: parseInt(n.slice(3, 5), 16),
            b: parseInt(n.slice(5, 7), 16)
        };
    }

    function relativeLuminance(hex) {
        const { r, g, b } = hexToRgb(hex);
        return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
    }

    function contrastRatio(fg, bg) {
        const l1 = relativeLuminance(fg);
        const l2 = relativeLuminance(bg);
        const light = Math.max(l1, l2);
        const dark = Math.min(l1, l2);
        return (light + 0.05) / (dark + 0.05);
    }

    function isLowContrast(fg, bg) {
        return contrastRatio(fg, bg) < 3;
    }

    function buildFileName(type, ext) {
        const stem = FILE_STEM[type] || 'text';
        const suffix = ext === 'svg' ? 'svg' : 'png';
        return 'qr-' + stem + '.' + suffix;
    }

    function buildText(fields) {
        const text = trim(fields && fields.text);
        if (!text) return fail({ text: MSG.textEmpty });
        if (text.length > MAX_TEXT_LENGTH) return fail({ text: MSG.textTooLong });
        return ok(text);
    }

    function buildPayload(type, fields) {
        if (type === 'text') return buildText(fields || {});
        return fail({ type: '未知类型' });
    }

    return {
        TYPES: TYPES,
        FILE_STEM: FILE_STEM,
        MAX_TEXT_LENGTH: MAX_TEXT_LENGTH,
        SIZES: SIZES,
        ECC_LEVELS: ECC_LEVELS,
        STORAGE_KEY: STORAGE_KEY,
        DEFAULT_STYLE: DEFAULT_STYLE,
        MSG: MSG,
        parseStyle: parseStyle,
        contrastRatio: contrastRatio,
        isLowContrast: isLowContrast,
        buildFileName: buildFileName,
        buildPayload: buildPayload
    };
});
