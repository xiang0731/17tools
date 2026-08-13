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

const index = fs.readFileSync('index.html', 'utf8');
const welcome = fs.readFileSync('items/Welcome.html', 'utf8');
const history = fs.readFileSync('items/History.html', 'utf8');
const version = fs.readFileSync('js/version.js', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');

assert.match(index, /data-file="ImageProcessor.html"/);
assert.match(index, /图片处理/);
const martianIndex = index.indexOf('data-file="MartianText.html"');
const imageIndex = index.indexOf('data-file="ImageProcessor.html"');
assert.ok(martianIndex !== -1 && imageIndex > martianIndex, '图片处理应在火星文转换之后');

assert.match(welcome, /18个实用工具/);
assert.match(history, /<!-- 版本 2\.15\.0 -->/);
assert.match(history, /版本 2\.15\.0/);
assert.match(history, /2026-08-13/);
assert.match(history, /图片处理：新增独立工具页/);
assert.match(version, /2\.15\.0/);
assert.equal(version.includes('2.14.0'), false);
assert.equal(version.includes('2.14.1'), false);
assert.match(readme, /图片处理/);
assert.match(readme, /ImageProcessor\.html/);
assert.match(readme, /image-processor-core\.js/);

console.log('image-processor-page regression passed');
