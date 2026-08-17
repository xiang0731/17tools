import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');

assert.match(index, /js\/load-progress\.js/);
assert.match(index, /id="tool-load-overlay"/);
assert.match(index, /id="tool-load-bar"/);
assert.match(index, /id="tool-load-label"/);
assert.match(index, /id="tool-load-pct"/);
assert.match(index, /role="progressbar"/);
assert.match(index, /startToolLoad\(/);
assert.match(index, /finishToolLoad\(/);
assert.match(index, /LoadProgress\.createController\(/);
assert.match(index, /正在加载/);
assert.match(index, /tool-load-overlay/);

assert.match(index, /startToolLoad\(fileName, toolLabel\)/);
assert.match(index, /finishToolLoad\(\);/);

const core = fs.readFileSync('js/load-progress.js', 'utf8');
assert.match(core, /DELAY_MS/);
assert.match(core, /PrettyFormat\.html/);
assert.match(core, /createController/);

console.log('load-progress-page regression passed');
