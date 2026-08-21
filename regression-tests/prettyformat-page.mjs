import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('items/PrettyFormat.html', 'utf8');

assert.match(page, /<title>代码格式化工具<\/title>/);
assert.match(page, /id="input-code"/);
assert.match(page, /id="format-btn"/);
assert.match(page, /id="output-code"/);
assert.match(page, /id="language"/);
assert.match(page, /class="app-container"/);
assert.match(page, /class="main-layout"/);
assert.match(page, /height:\s*100vh/);
assert.equal(page.includes('class="container"'), false);
assert.equal(page.includes('editor-container'), false);
assert.equal(page.includes('max-width: 1400px'), false);
assert.equal(page.includes('min-height: 70vh'), false);
assert.equal(page.includes('min-height: 400px'), false);
assert.match(page, /@media \(max-width: 768px\)/);
assert.match(page, /min-height:\s*300px/);
assert.match(page, /\.code-area \{[\s\S]*?flex:\s*1;[\s\S]*?min-width:\s*0;/);
assert.equal(page.includes('@media (max-width: 1024px)'), false);

const welcome = fs.readFileSync('items/Welcome.html', 'utf8');
const history = fs.readFileSync('items/History.html', 'utf8');
const version = fs.readFileSync('js/version.js', 'utf8');

assert.match(welcome, /19个实用工具/);
assert.match(welcome, /v2\.16\.4/);
assert.match(history, /<!-- 版本 2\.16\.4 -->/);
assert.match(history, /版本 2\.16\.4/);
assert.match(history, /<!-- 版本 2\.16\.3 -->/);
assert.match(history, /版本 2\.16\.3/);
assert.match(history, /<!-- 版本 2\.16\.2 -->/);
assert.match(history, /版本 2\.16\.2/);
assert.match(history, /2026-08-19/);
assert.match(history, /代码格式化去掉外层大框/);
assert.match(history, /图片处理：预览铺满窗口/);
assert.match(history, /文本转换、万年历、时间计算器：标题移到内容卡片外/);
assert.equal(history.includes('<!-- 版本 2.16.6 -->'), false);
assert.equal(history.includes('<!-- 版本 2.16.5 -->'), false);
assert.match(version, /2\.16\.4/);
assert.equal(version.includes('2.16.6'), false);
assert.equal(version.includes('2.16.5'), false);
assert.equal(version.includes('2.16.2'), false);

console.log('prettyformat-page regression passed');
