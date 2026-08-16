import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');

assert.match(index, /js\/unsaved-guard\.js/);
assert.match(index, /UnsavedGuard\.install\(/);
assert.match(index, /hasUnsavedContent\s*\(/);
assert.match(index, /confirmLeave\s*\(/);
assert.match(index, /isSameToolPage\s*\(/);
assert.match(index, /beforeunload/);
assert.match(index, /已输入的内容将不会保留/);
assert.match(index, /unsaved-leave-overlay/);
assert.match(index, /留下/);
assert.match(index, /离开/);
assert.match(index, /__17toolsUnsaved/);

assert.match(index, /checkUnsaved\s*\(/);
assert.match(index, /requestDirty\s*\(/);
assert.match(index, /allowUnload\s*\(/);
assert.match(index, /this\.isCurrentPage\(navItem\)/);

const theme = fs.readFileSync('js/theme.js', 'utf8');
assert.match(theme, /unsaved-guard\.js/);
assert.match(theme, /UnsavedGuard\.install\(/);

const injector = fs.readFileSync('js/theme-injector.js', 'utf8');
assert.match(injector, /unsaved-guard\.js/);

const board = fs.readFileSync('items/Board.html', 'utf8');
assert.match(board, /unsaved-guard\.js/);

const markdown = fs.readFileSync('items/Markdown.html', 'utf8');
assert.match(markdown, /unsaved-guard\.js/);

const keeper = fs.readFileSync('items/Keeper.html', 'utf8');
assert.match(keeper, /unsaved-guard\.js/);

const calendar = fs.readFileSync('items/Calendar.html', 'utf8');
assert.match(calendar, /data-unsaved-guard="off"/);
assert.equal(calendar.includes('unsaved-guard.js'), false);

const regex = fs.readFileSync('items/Regex.html', 'utf8');
assert.match(regex, /data-unsaved-guard="off"/);
assert.equal(regex.includes('unsaved-guard.js'), false);

assert.match(theme, /data-unsaved-guard/);

console.log('unsaved-guard-page regression passed');
