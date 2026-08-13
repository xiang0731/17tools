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

assert.deepEqual(core.POSITIONS, ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br']);
assert.equal(core.computeFontPx(1000, 5), 50);
assert.equal(core.computeFontPx(1000, 1), 10);
assert.equal(core.computeFontPx(1000, 20), 200);
assert.equal(core.computeFontPx(1000, 0), 10);
assert.equal(core.computeMargin(1000), 30);

assert.deepEqual(core.computeAnchor(1000, 800, 'br', 30), {
    x: 970, y: 770, textAlign: 'right', textBaseline: 'bottom'
});
assert.deepEqual(core.computeAnchor(1000, 800, 'tl', 30), {
    x: 30, y: 30, textAlign: 'left', textBaseline: 'top'
});
assert.deepEqual(core.computeAnchor(1000, 800, 'c', 30), {
    x: 500, y: 400, textAlign: 'center', textBaseline: 'middle'
});
assert.deepEqual(core.computeAnchor(1000, 800, 't', 30), {
    x: 500, y: 30, textAlign: 'center', textBaseline: 'top'
});
assert.deepEqual(core.computeAnchor(1000, 800, 'l', 30), {
    x: 30, y: 400, textAlign: 'left', textBaseline: 'middle'
});
assert.equal(core.computeAnchor(1000, 800, 'unknown', 30).textAlign, 'right');

assert.deepEqual(core.computeTileOrigins({ width: 100, height: 100, spacing: 50 }), [
    { x: 25, y: 25 }, { x: 75, y: 25 }, { x: 25, y: 75 }, { x: 75, y: 75 }
]);

assert.equal(core.parseTargetSize('200', 'KB'), 200 * 1024);
assert.equal(core.parseTargetSize('1', 'MB'), 1024 * 1024);
assert.equal(core.parseTargetSize('0', 'KB'), null);
assert.equal(core.parseTargetSize('abc', 'KB'), null);
assert.equal(core.parseTargetSize('1', 'GB'), null);

assert.deepEqual(core.formatByteSize(2048), { value: 2, unit: 'KB', text: '2 KB' });
assert.deepEqual(core.formatByteSize(1536), { value: 1.5, unit: 'KB', text: '1.5 KB' });
assert.deepEqual(core.formatByteSize(1048576), { value: 1, unit: 'MB', text: '1 MB' });

assert.equal(core.qualityToCanvas(80), 0.8);
assert.equal(core.qualityToCanvas(1), 0.01);
assert.equal(core.qualityToCanvas(100), 1);
assert.equal(core.canvasToQuality(0.8), 80);

assert.equal(core.SEARCH_MIN_QUALITY, 0.3);
assert.deepEqual(core.nextScaleSize(1000, 800, 800), { width: 900, height: 720 });
assert.equal(core.nextScaleSize(260, 260, 800), null);
assert.equal(core.nextScaleSize(200, 200, 200), null);

async function fakeEncode({ width, height, quality }) {
    return Math.round(width * height * quality);
}

const passthrough = await core.compressToTarget({
    sourceWidth: 100, sourceHeight: 80, sourceBytes: 1000, targetBytes: 2000,
    controlMode: 'size', quality: 0.8, encode: async () => {
        throw new Error('encode should not run for passthrough');
    }
});
assert.equal(passthrough.passthrough, true);
assert.equal(passthrough.hitTarget, true);
assert.equal(passthrough.byteLength, 1000);

const qualityMode = await core.compressToTarget({
    sourceWidth: 1000, sourceHeight: 800, sourceBytes: 900000, targetBytes: 100,
    controlMode: 'quality', quality: 0.8, encode: fakeEncode
});
assert.equal(qualityMode.width, 1000);
assert.equal(qualityMode.height, 800);
assert.equal(qualityMode.quality, 0.8);
assert.equal(qualityMode.passthrough, false);
assert.equal(qualityMode.byteLength, Math.round(1000 * 800 * 0.8));

const byQuality = await core.compressToTarget({
    sourceWidth: 1000, sourceHeight: 800, sourceBytes: 900000, targetBytes: 400000,
    controlMode: 'size', quality: 1, encode: fakeEncode
});
assert.equal(byQuality.width, 1000);
assert.equal(byQuality.height, 800);
assert.equal(byQuality.passthrough, false);
assert.equal(byQuality.hitTarget, true);
assert.ok(byQuality.byteLength <= 400000);
assert.ok(byQuality.quality >= 0.45 && byQuality.quality <= 0.5);

const scaled = await core.compressToTarget({
    sourceWidth: 1000, sourceHeight: 800, sourceBytes: 900000, targetBytes: 50000,
    controlMode: 'size', quality: 1, encode: fakeEncode
});
assert.ok(scaled.width < 1000);
assert.equal(scaled.hitTarget, true);
assert.ok(scaled.byteLength <= 50000);

const clampHit = await core.compressToTarget({
    sourceWidth: 1000, sourceHeight: 800, sourceBytes: 900000, targetBytes: 25000,
    controlMode: 'size', quality: 1, encode: fakeEncode
});
assert.equal(clampHit.hitTarget, true);
assert.ok(clampHit.byteLength <= 25000);

const missed = await core.compressToTarget({
    sourceWidth: 1000, sourceHeight: 800, sourceBytes: 900000, targetBytes: 1,
    controlMode: 'size', quality: 1, encode: fakeEncode
});
assert.equal(missed.hitTarget, false);
assert.ok(Math.min(missed.width, missed.height) <= 256);

console.log('image-processor-core regression passed');
