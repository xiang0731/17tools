import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('items/ImageProcessor.html', 'utf8');

assert.match(page, /data-tab="watermark"/);
assert.match(page, /data-tab="crop"/);
assert.match(page, /data-tab="compress"/);
assert.match(page, /cropperjs\/1\.6\.2\/cropper\.min\.css/);
assert.match(page, /cropperjs\/1\.6\.2\/cropper\.min\.js/);
assert.match(page, /jszip\/3\.10\.1\/jszip\.min\.js/);
assert.match(page, /image-processor-core\.js/);
assert.match(page, /theme\.js/);
assert.match(page, /17tools-image-processor/);
assert.equal(page.includes('innerHTML = file.name'), false);
assert.match(page, /imageOrientation:\s*['"]from-image['"]/);

console.log('image-processor-page regression passed');
