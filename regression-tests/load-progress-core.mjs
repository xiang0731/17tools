import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../js/load-progress.js');

assert.equal(core.DELAY_MS, 1000);
assert.equal(core.PROGRESS_CAP, 0.9);
assert.equal(core.DEFAULT_ESTIMATE_MS, 2500);
assert.equal(core.estimateFor('PrettyFormat.html'), 8000);
assert.equal(core.estimateFor('items/PrettyFormat.html'), 8000);
assert.equal(core.estimateFor('ImageProcessor.html'), 3000);
assert.equal(core.estimateFor('Markdown.html'), 3000);
assert.equal(core.estimateFor('QRCode.html'), 2000);
assert.equal(core.estimateFor('CodeDiff.html'), 1500);
assert.equal(core.estimateFor('About.html'), 1200);
assert.equal(core.estimateFor('Calculator.html'), 2500);
assert.equal(core.estimateFor(''), 2500);

assert.equal(core.progressAt(0, 8000, false), 0);
assert.equal(core.progressAt(4000, 8000, false), 0.5);
assert.equal(core.progressAt(8000, 8000, false), 0.9);
assert.equal(core.progressAt(20000, 8000, false), 0.9);
assert.equal(core.progressAt(100, 8000, true), 1);

assert.equal(core.loadingCopy('代码格式化'), '正在加载 代码格式化');
assert.equal(core.loadingCopy(''), '正在加载');
assert.equal(core.loadingCopy(null), '正在加载');

const ctl = core.createController();
const t0 = 1_000_000;

let state = ctl.start({ fileName: 'PrettyFormat.html', label: '代码格式化' }, t0);
assert.equal(state.active, true);
assert.equal(state.visible, false);
assert.equal(state.progress, 0);
assert.equal(state.label, '正在加载 代码格式化');
assert.equal(state.fileName, 'PrettyFormat.html');

state = ctl.getState(t0 + 999);
assert.equal(state.visible, false);
assert.equal(state.active, true);
assert.ok(state.progress < 0.2);

state = ctl.getState(t0 + 1000);
assert.equal(state.visible, true);
assert.equal(state.percent, 13);
assert.equal(state.progress, 0.125);

state = ctl.getState(t0 + 8000);
assert.equal(state.visible, true);
assert.equal(state.progress, 0.9);
assert.equal(state.percent, 90);

state = ctl.complete(t0 + 8200);
assert.equal(state.active, false);
assert.equal(state.visible, true);
assert.equal(state.progress, 1);
assert.equal(state.percent, 100);

state = ctl.hide(t0 + 8450);
assert.equal(state.visible, false);
assert.equal(state.progress, 1);

const fast = core.createController();
fast.start({ fileName: 'Calculator.html', label: '极速计算' }, t0);
state = fast.complete(t0 + 400);
assert.equal(state.visible, false);
assert.equal(state.active, false);
assert.equal(state.progress, 1);

const switchCtl = core.createController();
switchCtl.start({ fileName: 'Markdown.html', label: 'Markdown 编辑器' }, t0);
switchCtl.getState(t0 + 1000);
state = switchCtl.start({ fileName: 'QRCode.html', label: '二维码工具' }, t0 + 1200);
assert.equal(state.visible, false);
assert.equal(state.fileName, 'QRCode.html');
assert.equal(state.label, '正在加载 二维码工具');
state = switchCtl.getState(t0 + 2200);
assert.equal(state.visible, true);
assert.equal(state.fileName, 'QRCode.html');

console.log('load-progress-core regression passed');
