import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('items/Board.html', 'utf8');

assert.match(page, /function applyTheme\s*\(/);
assert.match(page, /function detectTheme\s*\(/);
assert.match(page, /function getSafeParentDocumentElement\s*\(/);
assert.match(page, /e\.data\.type === '17tools-theme'/);
assert.equal(page.includes("type === 'theme-change'"), false);
assert.match(page, /parentRoot\.getAttribute\('data-theme'\)/);
assert.match(page, /localStorage\.getItem\('theme'\)/);
assert.equal(page.includes('../js/theme.js'), false);
assert.equal(page.includes('theme-injector.js'), false);

assert.match(page, /invertPixels\s*\(/);
assert.match(page, /255 - /);
assert.match(page, /alpha === 0/);
assert.match(page, /invertHexColor\s*\(/);
assert.equal(page.includes("this.strokeColor === '#000000' || this.strokeColor === '#ffffff'"), false);
assert.match(page, /dataUrl:\s*this\.canvas\.toDataURL\(\)/);
assert.match(page, /theme:\s*this\.getBoardTheme\(\)/);
assert.match(page, /restoreState\s*\(/);
assert.match(page, /entry\.theme !== this\.getBoardTheme\(\)/);
assert.match(page, /if \(this\.isDrawing\) \{[\s\S]*?this\.stopDrawing\(\)/);

console.log('board-theme regression passed');
