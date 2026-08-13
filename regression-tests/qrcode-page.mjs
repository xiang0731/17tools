import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('items/QRCode.html', 'utf8');

assert.match(page, /cdnjs\.cloudflare\.com\/ajax\/libs\/qrcode\/1\.5\.1\/qrcode\.min\.js/);
assert.match(page, /qrcode-core\.js/);
assert.match(page, /theme\.js/);
assert.match(page, /17tools-qrcode/);
assert.match(page, /<title>二维码工具<\/title>/);
assert.match(page, /data-type="text"/);
assert.match(page, /data-type="url"/);
assert.match(page, /data-type="wifi"/);
assert.match(page, /data-type="vcard"/);
assert.match(page, /data-type="email"/);
assert.match(page, /data-type="tel"/);
assert.match(page, /data-type="sms"/);
assert.match(page, /id="btnPng"/);
assert.match(page, /id="btnSvg"/);
assert.match(page, /id="btnCopy"/);
assert.match(page, /id="previewCanvas"/);
assert.match(page, /class="form-input"/);
assert.match(page, /errorCorrectionLevel/);
assert.match(page, /margin:\s*2/);
assert.match(page, /150/);
assert.equal(page.includes('innerHTML'), false);
assert.equal(page.includes('alert('), false);
assert.match(page, /填写内容后生成二维码/);
assert.match(page, /二维码库加载失败/);
assert.match(page, /无法复制，请改用下载/);
assert.match(page, /已复制到剪贴板/);
assert.match(page, /无法生成二维码，请缩短内容/);
assert.match(page, /前景与背景对比过低，可能无法扫描/);

console.log('qrcode-page regression passed');
