(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.LocalRasterCore = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';
    function inspect(input) {
        const b = input instanceof Uint8Array ? input : new Uint8Array(input || 0);
        const text = (o, n) => String.fromCharCode(...b.subarray(o, o + n));
        const be16 = o => b[o] * 256 + b[o + 1];
        const be32 = o => (b[o] * 16777216 + b[o + 1] * 65536 + b[o + 2] * 256 + b[o + 3]);
        const le32 = o => (b[o] + b[o + 1] * 256 + b[o + 2] * 65536 + b[o + 3] * 16777216);
        let mime = '', width = 0, height = 0;
        const metadata = [];
        if (b.length >= 24 && text(1, 3) === 'PNG' && b[0] === 137 && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10 && text(12, 4) === 'IHDR') {
            mime = 'image/png'; width = be32(16); height = be32(20);
            for (let o = 8; o + 12 <= b.length;) {
                const size = be32(o), type = text(o + 4, 4);
                if (size > b.length - o - 12) break;
                if (['eXIf', 'tEXt', 'iTXt', 'zTXt'].includes(type)) metadata.push(type);
                o += size + 12;
            }
        } else if (b.length >= 4 && b[0] === 255 && b[1] === 216) {
            mime = 'image/jpeg';
            for (let o = 2; o + 4 <= b.length;) {
                if (b[o++] !== 255) break;
                while (b[o] === 255) o++;
                const marker = b[o++];
                if (marker === 218 || marker === 217) break;
                if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
                const size = be16(o);
                if (size < 2 || o + size > b.length) break;
                if (marker === 225) {
                    if (text(o + 2, 6) === 'Exif\0\0') metadata.push('EXIF（可能包含 GPS / 方向）');
                    else if (text(o + 2, 28).startsWith('http://ns.adobe.com/xap/1.0/')) metadata.push('XMP');
                }
                if (marker === 237) metadata.push('IPTC / Photoshop');
                if (marker === 254) metadata.push('JPEG 注释');
                if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && size >= 7) {
                    height = be16(o + 3); width = be16(o + 5);
                }
                o += size;
            }
        } else if (b.length >= 20 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
            mime = 'image/webp';
            for (let o = 12; o + 8 <= b.length;) {
                const type = text(o, 4), size = le32(o + 4), p = o + 8;
                if (size > b.length - p) break;
                if (type === 'EXIF' || type === 'XMP ') metadata.push(type.trim());
                if (type === 'VP8X' && size >= 10) {
                    width = 1 + b[p + 4] + b[p + 5] * 256 + b[p + 6] * 65536;
                    height = 1 + b[p + 7] + b[p + 8] * 256 + b[p + 9] * 65536;
                } else if (type === 'VP8 ' && size >= 10 && b[p + 3] === 157 && b[p + 4] === 1 && b[p + 5] === 42 && !width) {
                    width = (b[p + 6] + b[p + 7] * 256) & 16383; height = (b[p + 8] + b[p + 9] * 256) & 16383;
                } else if (type === 'VP8L' && size >= 5 && b[p] === 47 && !width) {
                    width = 1 + ((b[p + 1] + b[p + 2] * 256) & 16383);
                    height = 1 + ((b[p + 2] >> 6) | (b[p + 3] << 2) | ((b[p + 4] & 15) << 10));
                }
                o = p + size + (size % 2);
            }
        }
        return { ok: Boolean(mime && width > 0 && height > 0), mime, width, height, metadata: [...new Set(metadata)] };
    }
    function inspectDataUrl(source, maxBytes) {
        if (typeof source !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(source)) return { ok: false, reason: 'unsafe-source' };
        const comma = source.indexOf(','), encoded = source.slice(comma + 1);
        if (!encoded.length || encoded.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return { ok: false, reason: 'bad-image' };
        const byteLength = encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
        if (byteLength > (maxBytes || 20 * 1024 * 1024)) return { ok: false, reason: 'budget' };
        try {
            const raw = atob(encoded), bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
            const info = inspect(bytes);
            if (!info.ok || source.slice(5, comma - 7) !== info.mime) return { ok: false, reason: 'bad-image' };
            return { ...info, byteLength };
        } catch (_) { return { ok: false, reason: 'bad-image' }; }
    }
    return { inspect, inspectDataUrl };
});
