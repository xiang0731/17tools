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

assert.match(page, /this\.tiles\s*=\s*new Map/);
assert.match(page, /getCamera\s*\(/);
assert.match(page, /redrawDisplay\s*\(/);
assert.match(page, /panByScreenDelta/);
assert.match(page, /e\.button === 2/);
assert.match(page, /resetView\s*\(/);
assert.match(page, /this\.offsetX\s*=\s*0/);
assert.match(page, /this\.offsetY\s*=\s*0/);
assert.equal(page.includes('wrapper.style.transform = transformValue'), false);
assert.equal(page.includes("const transformValue = `scale(${this.scale})`"), false);

console.log('board-infinite-page regression passed');
