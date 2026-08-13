import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../js/qrcode-core.js');

assert.deepEqual(core.TYPES, ['text', 'url', 'wifi', 'vcard', 'email', 'tel', 'sms']);
assert.equal(core.MAX_TEXT_LENGTH, 1200);
assert.deepEqual(core.SIZES, [128, 256, 512, 1024]);
assert.deepEqual(core.ECC_LEVELS, ['L', 'M', 'Q', 'H']);
assert.equal(core.STORAGE_KEY, '17tools-qrcode');
assert.deepEqual(core.DEFAULT_STYLE, {
    type: 'text',
    foreground: '#000000',
    background: '#FFFFFF',
    size: 256,
    ecc: 'M'
});

assert.deepEqual(core.parseStyle({}), core.DEFAULT_STYLE);
assert.deepEqual(core.parseStyle(null), core.DEFAULT_STYLE);
assert.equal(core.parseStyle({ type: 'wifi', size: 512, ecc: 'H' }).type, 'wifi');
assert.equal(core.parseStyle({ type: 'nope', size: 99, ecc: 'Z', foreground: 'red' }).type, 'text');
assert.equal(core.parseStyle({ size: 99 }).size, 256);
assert.equal(core.parseStyle({ ecc: 'nope' }).ecc, 'M');
assert.equal(core.parseStyle({ foreground: '#abc' }).foreground, '#AABBCC');

assert.equal(core.contrastRatio('#000000', '#FFFFFF'), 21);
assert.equal(core.isLowContrast('#000000', '#FFFFFF'), false);
assert.equal(core.contrastRatio('#000000', '#000000'), 1);
assert.equal(core.isLowContrast('#000000', '#000000'), true);
assert.equal(core.isLowContrast('#FFFFFF', '#FFFFFF'), true);

assert.equal(core.buildFileName('text', 'png'), 'qr-text.png');
assert.equal(core.buildFileName('url', 'svg'), 'qr-url.svg');
assert.equal(core.buildFileName('wifi', 'png'), 'qr-wifi.png');
assert.equal(core.buildFileName('vcard', 'svg'), 'qr-vcard.svg');
assert.equal(core.buildFileName('email', 'png'), 'qr-email.png');
assert.equal(core.buildFileName('tel', 'svg'), 'qr-tel.svg');
assert.equal(core.buildFileName('sms', 'png'), 'qr-sms.png');
assert.equal(core.buildFileName('text', 'other'), 'qr-text.png');

assert.deepEqual(core.buildPayload('text', { text: 'hello' }), { ok: true, payload: 'hello' });
assert.deepEqual(core.buildPayload('text', { text: '  hi  ' }), { ok: true, payload: 'hi' });
assert.deepEqual(core.buildPayload('text', { text: '   ' }), {
    ok: false, errors: { text: '请输入内容' }
});
assert.equal(core.buildPayload('text', { text: 'x'.repeat(1200) }).ok, true);
assert.deepEqual(core.buildPayload('text', { text: 'x'.repeat(1201) }), {
    ok: false, errors: { text: '内容不超过 1200 字' }
});

console.log('qrcode-core regression passed');
