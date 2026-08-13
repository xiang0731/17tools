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

console.log('board-theme regression passed');
