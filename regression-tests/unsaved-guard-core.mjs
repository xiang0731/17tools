import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../js/unsaved-guard.js');

function field(overrides) {
    return {
        tagName: 'INPUT',
        id: '',
        name: '',
        type: 'text',
        value: '',
        disabled: false,
        readOnly: false,
        isContentEditable: false,
        closest() {
            return null;
        },
        ...overrides
    };
}

assert.equal(core.isTrackedElement(field()), true);
assert.equal(core.isTrackedElement(field({ tagName: 'TEXTAREA', type: 'textarea' })), true);
assert.equal(core.isTrackedElement(field({ type: 'url' })), true);
assert.equal(core.isTrackedElement(field({ type: 'number' })), true);
assert.equal(core.isTrackedElement(field({ type: 'hidden' })), false);
assert.equal(core.isTrackedElement(field({ type: 'checkbox' })), false);
assert.equal(core.isTrackedElement(field({ type: 'file' })), false);
assert.equal(core.isTrackedElement(field({ type: 'button' })), false);
assert.equal(core.isTrackedElement(field({ disabled: true })), false);
assert.equal(core.isTrackedElement(field({ readOnly: true })), false);
assert.equal(core.isTrackedElement(field({ tagName: 'SELECT', type: 'select-one' })), false);

const ignored = field({
    closest(selector) {
        return selector === '[data-unsaved-ignore]' ? {} : null;
    }
});
assert.equal(core.isTrackedElement(ignored), false);

assert.equal(core.fieldValue(field({ value: 'hello' })), 'hello');
assert.equal(core.fieldValue(field({ tagName: 'TEXTAREA', type: 'textarea', value: 'a\nb' })), 'a\nb');
assert.equal(core.fieldValue(field({
    isContentEditable: true,
    innerText: 'note',
    value: ''
})), 'note');

const doc = {
    nodes: [
        field({ id: 'input', value: '' }),
        field({ id: 'hidden', type: 'hidden', value: 'secret' }),
        field({ id: 'mode', type: 'checkbox', checked: true, value: 'on' })
    ],
    querySelectorAll() {
        return this.nodes;
    }
};

const guard = core.createGuard();
guard.captureBaseline(doc);
assert.equal(guard.isDirty(doc), false);

doc.nodes[0].value = '已输入内容';
assert.equal(guard.isDirty(doc), true);

doc.nodes[0].value = '';
assert.equal(guard.isDirty(doc), false);

doc.nodes[0].value = '草稿';
guard.captureBaseline(doc);
assert.equal(guard.isDirty(doc), false);
doc.nodes[0].value = '草稿改过';
assert.equal(guard.isDirty(doc), true);
doc.nodes[0].value = '草稿';
assert.equal(guard.isDirty(doc), false);

guard.markExtraDirty();
assert.equal(guard.isDirty(doc), true);
guard.markClean(doc);
assert.equal(guard.isDirty(doc), false);

const stayEvent = { preventDefault() {}, returnValue: undefined };
assert.equal(core.applyBeforeUnload(stayEvent, false), false);
assert.equal(stayEvent.returnValue, undefined);

let prevented = false;
const leaveEvent = {
    preventDefault() {
        prevented = true;
    },
    returnValue: undefined
};
assert.equal(core.applyBeforeUnload(leaveEvent, true), true);
assert.equal(prevented, true);
assert.equal(leaveEvent.returnValue, '');

assert.equal(core.isSameToolPage('items/Calculator.html', 'Calculator.html'), true);
assert.equal(core.isSameToolPage('items/Welcome.html', 'Calculator.html'), false);
assert.equal(core.isSameToolPage('items/Welcome.html', 'Welcome.html'), true);

assert.equal(core.isExcludedPage('items/Calendar.html'), true);
assert.equal(core.isExcludedPage('items/Regex.html'), true);
assert.equal(core.isExcludedPage('/items/Calendar.html'), true);
assert.equal(core.isExcludedPage('items/Transformer.html'), false);
assert.deepEqual(core.EXCLUDED_PAGES, ['Calendar.html', 'Regex.html']);

let excludedDirty = true;
core.requestDirty({
    src: 'items/Calendar.html',
    getAttribute() {
        return 'items/Calendar.html';
    },
    contentWindow: {
        __17toolsUnsaved: guard,
        document: doc
    }
}, (dirty) => {
    excludedDirty = dirty;
});
assert.equal(excludedDirty, false);

assert.equal(core.MESSAGE.CHECK, '17tools-unsaved-check');
assert.equal(core.MESSAGE.STATE, '17tools-unsaved-state');
assert.equal(core.MESSAGE.ALLOW, '17tools-unsaved-allow');
assert.equal(core.MESSAGE.ALLOWED, '17tools-unsaved-allowed');

doc.nodes[0].value = '将要离开';
assert.equal(guard.isDirty(doc), true);
assert.equal(core.shouldWarnOnUnload(guard, doc), true);
guard.allowUnload();
assert.equal(core.shouldWarnOnUnload(guard, doc), false);
assert.equal(core.shouldWarnOnUnload(guard, doc), true);

let allowedSync = false;
core.allowUnload({
    contentWindow: {
        __17toolsUnsaved: guard
    }
}, () => {
    allowedSync = true;
});
assert.equal(allowedSync, true);
assert.equal(core.shouldWarnOnUnload(guard, doc), false);

doc.nodes[0].value = '草稿';
guard.captureBaseline(doc);

let syncDirty = null;
core.requestDirty({
    contentWindow: {
        __17toolsUnsaved: guard,
        document: doc
    }
}, (dirty) => {
    syncDirty = dirty;
});
assert.equal(syncDirty, false);

const posted = [];
const listeners = [];
const host = {
    addEventListener(type, fn) {
        if (type === 'message') listeners.push(fn);
    },
    removeEventListener(type, fn) {
        const index = listeners.indexOf(fn);
        if (index !== -1) listeners.splice(index, 1);
    }
};
let asyncDirty = null;
core.requestDirty({
    contentWindow: {
        get __17toolsUnsaved() {
            throw new Error('blocked');
        },
        postMessage(data) {
            posted.push(data);
        }
    }
}, (dirty) => {
    asyncDirty = dirty;
}, host);
assert.deepEqual(posted, [{ type: '17tools-unsaved-check' }]);
listeners.forEach((fn) => fn({ data: { type: '17tools-unsaved-state', dirty: true } }));
assert.equal(asyncDirty, true);

console.log('unsaved-guard-core regression passed');
