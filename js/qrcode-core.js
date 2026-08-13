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
        textTooLong: '内容不超过 1200 字',
        urlEmpty: '请输入链接',
        urlInvalid: '请输入有效链接',
        emailEmpty: '请输入邮箱',
        emailInvalid: '请输入有效邮箱',
        phoneEmpty: '请输入电话',
        phoneInvalid: '请输入有效电话',
        wifiSsid: '请输入 WiFi 名称',
        wifiPassword: '请输入密码',
        vcardName: '请输入姓名'
    };
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    function isValidEmail(value) {
        return EMAIL_RE.test(value);
    }

    function normalizeUrl(raw) {
        const value = trim(raw);
        if (!value) return { ok: false, empty: true };
        const withScheme = /^(https?:)\/\//i.test(value) ? value : 'https://' + value;
        try {
            const parsed = new URL(withScheme);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return { ok: false, empty: false };
            }
            return { ok: true, url: withScheme };
        } catch (err) {
            return { ok: false, empty: false };
        }
    }

    function normalizePhone(raw) {
        const value = trim(raw);
        if (!value) return { ok: false, empty: true };
        const compact = value.replace(/ /g, '');
        if (!/^[+0-9()\-]+$/.test(compact) || !/[0-9]/.test(compact)) {
            return { ok: false, empty: false };
        }
        return { ok: true, phone: compact };
    }

    function buildUrl(fields) {
        const result = normalizeUrl(fields.url);
        if (!result.ok) {
            return fail({ url: result.empty ? MSG.urlEmpty : MSG.urlInvalid });
        }
        return ok(result.url);
    }

    function buildEmail(fields) {
        const email = trim(fields.email);
        if (!email) return fail({ email: MSG.emailEmpty });
        if (!isValidEmail(email)) return fail({ email: MSG.emailInvalid });
        const subject = trim(fields.subject);
        const body = trim(fields.body);
        let payload = 'mailto:' + email;
        const params = [];
        if (subject) params.push('subject=' + encodeURIComponent(subject));
        if (body) params.push('body=' + encodeURIComponent(body));
        if (params.length) payload += '?' + params.join('&');
        return ok(payload);
    }

    function buildTel(fields) {
        const result = normalizePhone(fields.phone);
        if (!result.ok) {
            return fail({ phone: result.empty ? MSG.phoneEmpty : MSG.phoneInvalid });
        }
        return ok('tel:' + result.phone);
    }

    function buildSms(fields) {
        const result = normalizePhone(fields.phone);
        if (!result.ok) {
            return fail({ phone: result.empty ? MSG.phoneEmpty : MSG.phoneInvalid });
        }
        const body = trim(fields.body);
        return ok(body ? 'SMSTO:' + result.phone + ':' + body : 'SMSTO:' + result.phone);
    }

    function escapeWifi(value) {
        return String(value).replace(/([\\;,:])/g, '\\$1');
    }

    function escapeVCard(value) {
        return String(value)
            .replace(/\\/g, '\\\\')
            .replace(/\r\n|\n|\r/g, '\\n')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,');
    }

    function buildWifi(fields) {
        const ssid = trim(fields.ssid);
        const auth = fields.auth === 'WEP' || fields.auth === 'nopass' ? fields.auth : 'WPA';
        const hidden = Boolean(fields.hidden);
        const errors = {};
        if (!ssid) errors.ssid = MSG.wifiSsid;
        const password = trim(fields.password);
        if (auth !== 'nopass' && !password) errors.password = MSG.wifiPassword;
        if (Object.keys(errors).length) return fail(errors);
        const parts = ['WIFI:T:' + auth, 'S:' + escapeWifi(ssid)];
        if (auth !== 'nopass') parts.push('P:' + escapeWifi(password));
        if (hidden) parts.push('H:true');
        return ok(parts.join(';') + ';;');
    }

    function buildVCard(fields) {
        const name = trim(fields.name);
        if (!name) return fail({ name: MSG.vcardName });
        const errors = {};
        const email = trim(fields.email);
        if (email && !isValidEmail(email)) errors.email = MSG.emailInvalid;
        let urlValue = '';
        const urlRaw = trim(fields.url);
        if (urlRaw) {
            const result = normalizeUrl(urlRaw);
            if (!result.ok) errors.url = MSG.urlInvalid;
            else urlValue = result.url;
        }
        if (Object.keys(errors).length) return fail(errors);
        const lines = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            'N:' + escapeVCard(name) + ';;;;',
            'FN:' + escapeVCard(name)
        ];
        const org = trim(fields.org);
        const phone = trim(fields.phone);
        if (org) lines.push('ORG:' + escapeVCard(org));
        if (phone) lines.push('TEL:' + escapeVCard(phone));
        if (email) lines.push('EMAIL:' + escapeVCard(email));
        if (urlValue) lines.push('URL:' + escapeVCard(urlValue));
        lines.push('END:VCARD');
        return ok(lines.join('\n'));
    }

    function buildPayload(type, fields) {
        const source = fields || {};
        const handlers = {
            text: buildText,
            url: buildUrl,
            wifi: buildWifi,
            vcard: buildVCard,
            email: buildEmail,
            tel: buildTel,
            sms: buildSms
        };
        const handler = handlers[type];
        if (!handler) return fail({ type: '未知类型' });
        return handler(source);
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
        buildPayload: buildPayload,
        normalizeUrl: normalizeUrl,
        normalizePhone: normalizePhone,
        escapeWifi: escapeWifi,
        escapeVCard: escapeVCard
    };
});
