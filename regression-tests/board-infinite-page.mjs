import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('items/Board.html', 'utf8');

assert.match(page, /js\/board-world\.js/);
assert.match(page, /id="zoom-out"/);
assert.match(page, /id="zoom-percent"/);
assert.match(page, /id="zoom-in"/);
assert.match(page, /id="reset-view"/);
assert.match(page, /Ctrl\+滚轮缩放/);
assert.match(page, /右键拖动平移/);
assert.match(page, /contextmenu/);
assert.match(page, /preventDefault\(\)/);
assert.match(page, /e\.ctrlKey/);
assert.equal(/wheel[\s\S]{0,400}e\.shiftKey/.test(page), false);
assert.equal(page.includes('Shift+滚轮缩放'), false);

console.log('board-infinite-page regression passed');
