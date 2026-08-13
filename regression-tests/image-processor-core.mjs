import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../js/image-processor-core.js');

assert.deepEqual(core.ACCEPTED_MIMES, ['image/jpeg', 'image/png', 'image/webp']);
assert.equal(core.MAX_FILE_BYTES, 20 * 1024 * 1024);
assert.equal(core.MAX_BATCH_COUNT, 20);

assert.deepEqual(core.validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 100 }), { ok: true });
assert.deepEqual(core.validateFile({ name: 'a.png', type: 'image/png', size: 100 }), { ok: true });
assert.deepEqual(core.validateFile({ name: 'a.webp', type: 'image/webp', size: 100 }), { ok: true });
assert.deepEqual(core.validateFile({ name: 'a.gif', type: 'image/gif', size: 100 }), { ok: false, reason: 'type' });
assert.deepEqual(core.validateFile({ name: 'a.jpg', type: 'image/jpeg', size: core.MAX_FILE_BYTES + 1 }), { ok: false, reason: 'size' });
assert.equal(core.validateFile({ name: 'photo.JPG', type: '', size: 10 }).ok, true);

assert.equal(core.resolveMime('a.png', ''), 'image/png');
assert.equal(core.resolveMime('a.jpg', 'image/jpeg'), 'image/jpeg');
assert.equal(core.resolveMime('a.webp', 'image/webp'), 'image/webp');

assert.equal(core.buildExportName('photo.jpg', 'watermarked', 'image/jpeg'), 'photo_watermarked.jpg');
assert.equal(core.buildExportName('my.photo.png', 'cropped', 'image/png'), 'my.photo_cropped.png');
assert.equal(core.buildExportName('中文.webp', 'compressed', 'image/webp'), '中文_compressed.webp');
assert.equal(core.buildExportName('noext', 'watermarked', 'image/jpeg'), 'noext_watermarked.jpg');

console.log('image-processor-core regression passed');
