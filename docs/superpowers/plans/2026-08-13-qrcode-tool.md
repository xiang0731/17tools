# QR Code Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 17Tools 中新增公开的本地「二维码工具」，支持七种内容类型，可调颜色/尺寸/纠错，并导出 PNG、SVG 或复制图片。

**Architecture:** 可测试的纯函数放在 `js/qrcode-core.js`（UMD，对齐 `js/tire-selector-core.js`）：校验、载荷拼装、对比度、文件名、样式消毒。页面 `items/QRCode.html` 负责类型切换、实时预览、下载和剪贴板；渲染交给 CDN 上的 `qrcode` 1.5.1。不改 `WifiQRCode.html` / `auth.js`。

**Tech Stack:** 原生 HTML/CSS/JavaScript、soldair/node-qrcode 1.5.1（cdnjs）、`css/theme.css` + `js/theme.js`、Node `node:assert/strict` 回归测试。

## Global Constraints

- 只在浏览器内生成，不上传服务器。
- 七种类型固定顺序：文本、链接、WiFi、名片、邮件、电话、短信。
- 样式默认：前景 `#000000`、背景 `#FFFFFF`、尺寸 `256`、纠错 `M`。尺寸仅 `128 / 256 / 512 / 1024`。
- CDN 钉死：`https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js`。渲染 options 必须含 `errorCorrectionLevel`、`width`、`margin: 2`、`color.dark` / `color.light`。
- `localStorage` 键：`17tools-qrcode`。只存 `type/foreground/background/size/ecc`，不存任何表单内容。
- 侧栏「主要工具」中，「二维码工具」放在「图片处理」正下方、`Regex.html` 之前；文案「二维码工具」；图标 `fa-qrcode`；无 `data-protected`。
- 版本 `2.16.0`，日期 `2026-08-13`；History 只加「新功能」分类，标签 `tag new`。
- Welcome 工具数 `18` → `19`。
- DOM 里的用户输入、错误信息一律用 `textContent`，禁止 `innerHTML`。禁止 `alert`。
- 不修改 `items/WifiQRCode.html` 和 `js/auth.js`。
- 实现对照 spec：`docs/superpowers/specs/2026-08-13-qrcode-tool-design.md`。

## File map

| 文件 | 职责 |
| --- | --- |
| `js/qrcode-core.js` | 校验、载荷、对比度、文件名、样式消毒。无 DOM。 |
| `items/QRCode.html` | UI、预览、导出、复制、localStorage。 |
| `regression-tests/qrcode-core.mjs` | core 断言。 |
| `regression-tests/qrcode-page.mjs` | 页面结构与站点接入断言。 |
| `index.html` / `Welcome.html` / `History.html` / `version.js` / `README.md` | 入口、版本、说明。 |
| `regression-tests/image-processor-page.mjs` | 把写死的 18 / 2.15.2 改成 19 / 2.16.0。 |

---

### Task 1: Core 样式、对比度、文件名与文本载荷

**Files:**
- Create: `js/qrcode-core.js`
- Create: `regression-tests/qrcode-core.mjs`
- Test: `regression-tests/qrcode-core.mjs`

**Interfaces:**
- Consumes: 无
- Produces: `QRCodeCore` UMD 对象，本任务包含：
  - `TYPES`: `['text', 'url', 'wifi', 'vcard', 'email', 'tel', 'sms']`
  - `MAX_TEXT_LENGTH`: `1200`
  - `SIZES`: `[128, 256, 512, 1024]`
  - `ECC_LEVELS`: `['L', 'M', 'Q', 'H']`
  - `STORAGE_KEY`: `'17tools-qrcode'`
  - `DEFAULT_STYLE`: `{ type: 'text', foreground: '#000000', background: '#FFFFFF', size: 256, ecc: 'M' }`
  - `MSG.textEmpty`: `'请输入内容'`
  - `MSG.textTooLong`: `'内容不超过 1200 字'`
  - `parseStyle(input)` → 消毒后的 style 对象
  - `contrastRatio(fg, bg)` → `number`
  - `isLowContrast(fg, bg)` → `boolean`（比值 `< 3`）
  - `buildFileName(type, ext)` → `'qr-{stem}.{png|svg}'`
  - `buildPayload(type, fields)` → `{ ok: true, payload }` 或 `{ ok: false, errors }`。本任务至少实现 `text`。

- [ ] **Step 1: Write the failing test**

Create `regression-tests/qrcode-core.mjs`:

```js
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../js/qrcode-core.js');

assert.deepEqual(core.TYPES, ['text', 'url', 'wifi', 'vcard', 'email', 'tel', 'sms']);
assert.equal(core.MAX_TEXT_LENGTH, 1200);
assert.deepEqual(core.SIZES, [128, 256, 512, 1024]);
assert.deepEqual(core.ECC_LEVELS, ['L', 'M', 'Q', 'H']);
assert.equal(core.STORAGE_KEY, '17tools-qrcode');
assert.deepEqual(core.DEFAULT_STYLE, {
    type: 'text',
    foreground: '#000000',
    background: '#FFFFFF',
    size: 256,
    ecc: 'M'
});

assert.deepEqual(core.parseStyle({}), core.DEFAULT_STYLE);
assert.deepEqual(core.parseStyle(null), core.DEFAULT_STYLE);
assert.equal(core.parseStyle({ type: 'wifi', size: 512, ecc: 'H' }).type, 'wifi');
assert.equal(core.parseStyle({ type: 'nope', size: 99, ecc: 'Z', foreground: 'red' }).type, 'text');
assert.equal(core.parseStyle({ size: 99 }).size, 256);
assert.equal(core.parseStyle({ ecc: 'nope' }).ecc, 'M');
assert.equal(core.parseStyle({ foreground: '#abc' }).foreground, '#AABBCC');

assert.equal(core.contrastRatio('#000000', '#FFFFFF'), 21);
assert.equal(core.isLowContrast('#000000', '#FFFFFF'), false);
assert.equal(core.contrastRatio('#000000', '#000000'), 1);
assert.equal(core.isLowContrast('#000000', '#000000'), true);
assert.equal(core.isLowContrast('#FFFFFF', '#FFFFFF'), true);

assert.equal(core.buildFileName('text', 'png'), 'qr-text.png');
assert.equal(core.buildFileName('url', 'svg'), 'qr-url.svg');
assert.equal(core.buildFileName('wifi', 'png'), 'qr-wifi.png');
assert.equal(core.buildFileName('vcard', 'svg'), 'qr-vcard.svg');
assert.equal(core.buildFileName('email', 'png'), 'qr-email.png');
assert.equal(core.buildFileName('tel', 'svg'), 'qr-tel.svg');
assert.equal(core.buildFileName('sms', 'png'), 'qr-sms.png');
assert.equal(core.buildFileName('text', 'other'), 'qr-text.png');

assert.deepEqual(core.buildPayload('text', { text: 'hello' }), { ok: true, payload: 'hello' });
assert.deepEqual(core.buildPayload('text', { text: '  hi  ' }), { ok: true, payload: 'hi' });
assert.deepEqual(core.buildPayload('text', { text: '   ' }), {
    ok: false, errors: { text: '请输入内容' }
});
assert.equal(core.buildPayload('text', { text: 'x'.repeat(1200) }).ok, true);
assert.deepEqual(core.buildPayload('text', { text: 'x'.repeat(1201) }), {
    ok: false, errors: { text: '内容不超过 1200 字' }
});

console.log('qrcode-core regression passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/qrcode-core.mjs`

Expected: FAIL with `Cannot find module '../js/qrcode-core.js'`

- [ ] **Step 3: Write minimal implementation**

Create `js/qrcode-core.js`:

```js
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.QRCodeCore = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const TYPES = ['text', 'url', 'wifi', 'vcard', 'email', 'tel', 'sms'];
    const FILE_STEM = {
        text: 'text', url: 'url', wifi: 'wifi', vcard: 'vcard',
        email: 'email', tel: 'tel', sms: 'sms'
    };
    const MAX_TEXT_LENGTH = 1200;
    const SIZES = [128, 256, 512, 1024];
    const ECC_LEVELS = ['L', 'M', 'Q', 'H'];
    const STORAGE_KEY = '17tools-qrcode';
    const DEFAULT_STYLE = {
        type: 'text',
        foreground: '#000000',
        background: '#FFFFFF',
        size: 256,
        ecc: 'M'
    };
    const MSG = {
        textEmpty: '请输入内容',
        textTooLong: '内容不超过 1200 字'
    };

    function fail(errors) {
        return { ok: false, errors: errors };
    }

    function ok(payload) {
        return { ok: true, payload: payload };
    }

    function trim(value) {
        return String(value == null ? '' : value).trim();
    }

    function normalizeHex(value, fallback) {
        const raw = String(value || '').trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(raw)) {
            return raw.toUpperCase();
        }
        if (/^#[0-9A-Fa-f]{3}$/.test(raw)) {
            return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
        }
        return fallback;
    }

    function parseStyle(input) {
        const src = input && typeof input === 'object' ? input : {};
        return {
            type: TYPES.includes(src.type) ? src.type : DEFAULT_STYLE.type,
            foreground: normalizeHex(src.foreground, DEFAULT_STYLE.foreground),
            background: normalizeHex(src.background, DEFAULT_STYLE.background),
            size: SIZES.includes(Number(src.size)) ? Number(src.size) : DEFAULT_STYLE.size,
            ecc: ECC_LEVELS.includes(src.ecc) ? src.ecc : DEFAULT_STYLE.ecc
        };
    }

    function channelLuminance(value) {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }

    function hexToRgb(hex) {
        const n = normalizeHex(hex, '#000000');
        return {
            r: parseInt(n.slice(1, 3), 16),
            g: parseInt(n.slice(3, 5), 16),
            b: parseInt(n.slice(5, 7), 16)
        };
    }

    function relativeLuminance(hex) {
        const { r, g, b } = hexToRgb(hex);
        return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
    }

    function contrastRatio(fg, bg) {
        const l1 = relativeLuminance(fg);
        const l2 = relativeLuminance(bg);
        const light = Math.max(l1, l2);
        const dark = Math.min(l1, l2);
        return (light + 0.05) / (dark + 0.05);
    }

    function isLowContrast(fg, bg) {
        return contrastRatio(fg, bg) < 3;
    }

    function buildFileName(type, ext) {
        const stem = FILE_STEM[type] || 'text';
        const suffix = ext === 'svg' ? 'svg' : 'png';
        return 'qr-' + stem + '.' + suffix;
    }

    function buildText(fields) {
        const text = trim(fields && fields.text);
        if (!text) return fail({ text: MSG.textEmpty });
        if (text.length > MAX_TEXT_LENGTH) return fail({ text: MSG.textTooLong });
        return ok(text);
    }

    function buildPayload(type, fields) {
        if (type === 'text') return buildText(fields || {});
        return fail({ type: '未知类型' });
    }

    return {
        TYPES: TYPES,
        FILE_STEM: FILE_STEM,
        MAX_TEXT_LENGTH: MAX_TEXT_LENGTH,
        SIZES: SIZES,
        ECC_LEVELS: ECC_LEVELS,
        STORAGE_KEY: STORAGE_KEY,
        DEFAULT_STYLE: DEFAULT_STYLE,
        MSG: MSG,
        parseStyle: parseStyle,
        contrastRatio: contrastRatio,
        isLowContrast: isLowContrast,
        buildFileName: buildFileName,
        buildPayload: buildPayload
    };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node regression-tests/qrcode-core.mjs`

Expected: `qrcode-core regression passed`

- [ ] **Step 5: Commit**

```bash
git add -- js/qrcode-core.js regression-tests/qrcode-core.mjs
git commit --only -m "$(cat <<'EOF'
feat: add QR code core style, contrast, and text payload helpers

EOF
)" -- js/qrcode-core.js regression-tests/qrcode-core.mjs
```

---

### Task 2: Core 链接、邮件、电话、短信载荷

**Files:**
- Modify: `js/qrcode-core.js`
- Modify: `regression-tests/qrcode-core.mjs`
- Test: `regression-tests/qrcode-core.mjs`

**Interfaces:**
- Consumes: Task 1 的 `buildPayload` / `MSG` / `trim` 模式
- Produces: 扩展后的 `buildPayload`：
  - `url` 字段 `{ url }`。缺 `http://` 或 `https://` 时补 `https://`，再用 `new URL()` 校验。空 → `请输入链接`；非法 → `请输入有效链接`
  - `email` 字段 `{ email, subject, body }`。规则 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`。空 → `请输入邮箱`；非法 → `请输入有效邮箱`。载荷 `mailto:`，查询串 `encodeURIComponent`
  - `tel` 字段 `{ phone }`。trim 后去空格；允许 `+`、数字、`-`、括号；至少一位数字。空 → `请输入电话`；非法 → `请输入有效电话`。载荷 `tel:`
  - `sms` 字段 `{ phone, body }`。号码规则同电话。无正文 `SMSTO:<号码>`；有正文 `SMSTO:<号码>:<正文>`（正文不编码）
  - 另导出 `normalizeUrl`、`normalizePhone` 供页面不必重复，测试可直接打 `buildPayload`

- [ ] **Step 1: Extend the failing tests**

Append these assertions to `regression-tests/qrcode-core.mjs` **before** the `console.log` line:

```js
assert.deepEqual(core.buildPayload('url', { url: 'example.com' }), {
    ok: true, payload: 'https://example.com'
});
assert.deepEqual(core.buildPayload('url', { url: 'https://a.com/x' }), {
    ok: true, payload: 'https://a.com/x'
});
assert.deepEqual(core.buildPayload('url', { url: 'http://a.com' }), {
    ok: true, payload: 'http://a.com'
});
assert.deepEqual(core.buildPayload('url', { url: '  ' }), {
    ok: false, errors: { url: '请输入链接' }
});
assert.deepEqual(core.buildPayload('url', { url: 'https://' }), {
    ok: false, errors: { url: '请输入有效链接' }
});

assert.deepEqual(core.buildPayload('email', { email: 'a@b.c' }), {
    ok: true, payload: 'mailto:a@b.c'
});
assert.deepEqual(core.buildPayload('email', {
    email: 'a@b.c', subject: 'Hi there', body: 'Yo'
}), {
    ok: true, payload: 'mailto:a@b.c?subject=Hi%20there&body=Yo'
});
assert.deepEqual(core.buildPayload('email', { email: 'a@b.c', body: 'hello' }), {
    ok: true, payload: 'mailto:a@b.c?body=hello'
});
assert.deepEqual(core.buildPayload('email', { email: '' }), {
    ok: false, errors: { email: '请输入邮箱' }
});
assert.deepEqual(core.buildPayload('email', { email: 'not-an-email' }), {
    ok: false, errors: { email: '请输入有效邮箱' }
});

assert.deepEqual(core.buildPayload('tel', { phone: '138 0000 0000' }), {
    ok: true, payload: 'tel:13800000000'
});
assert.deepEqual(core.buildPayload('tel', { phone: '+86 138-0000-0000' }), {
    ok: true, payload: 'tel:+86138-0000-0000'
});
assert.deepEqual(core.buildPayload('tel', { phone: '   ' }), {
    ok: false, errors: { phone: '请输入电话' }
});
assert.deepEqual(core.buildPayload('tel', { phone: 'abc' }), {
    ok: false, errors: { phone: '请输入有效电话' }
});

assert.deepEqual(core.buildPayload('sms', { phone: '138 0013 8000' }), {
    ok: true, payload: 'SMSTO:13800138000'
});
assert.deepEqual(core.buildPayload('sms', { phone: '13800138000', body: 'hello:world' }), {
    ok: true, payload: 'SMSTO:13800138000:hello:world'
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/qrcode-core.mjs`

Expected: FAIL because `buildPayload('url', …)` 仍返回 `{ ok: false, errors: { type: '未知类型' } }`

- [ ] **Step 3: Implement url / email / tel / sms**

In `js/qrcode-core.js`，把 `MSG` 扩成：

```js
    const MSG = {
        textEmpty: '请输入内容',
        textTooLong: '内容不超过 1200 字',
        urlEmpty: '请输入链接',
        urlInvalid: '请输入有效链接',
        emailEmpty: '请输入邮箱',
        emailInvalid: '请输入有效邮箱',
        phoneEmpty: '请输入电话',
        phoneInvalid: '请输入有效电话'
    };
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

在 `buildText` 之后加入：

```js
    function isValidEmail(value) {
        return EMAIL_RE.test(value);
    }

    function normalizeUrl(raw) {
        const value = trim(raw);
        if (!value) return { ok: false, empty: true };
        const withScheme = /^(https?:)\/\//i.test(value) ? value : 'https://' + value;
        try {
            const parsed = new URL(withScheme);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return { ok: false, empty: false };
            }
            return { ok: true, url: withScheme };
        } catch (err) {
            return { ok: false, empty: false };
        }
    }

    function normalizePhone(raw) {
        const value = trim(raw);
        if (!value) return { ok: false, empty: true };
        const compact = value.replace(/ /g, '');
        if (!/^[+0-9()\-]+$/.test(compact) || !/[0-9]/.test(compact)) {
            return { ok: false, empty: false };
        }
        return { ok: true, phone: compact };
    }

    function buildUrl(fields) {
        const result = normalizeUrl(fields.url);
        if (!result.ok) {
            return fail({ url: result.empty ? MSG.urlEmpty : MSG.urlInvalid });
        }
        return ok(result.url);
    }

    function buildEmail(fields) {
        const email = trim(fields.email);
        if (!email) return fail({ email: MSG.emailEmpty });
        if (!isValidEmail(email)) return fail({ email: MSG.emailInvalid });
        const subject = trim(fields.subject);
        const body = trim(fields.body);
        let payload = 'mailto:' + email;
        const params = [];
        if (subject) params.push('subject=' + encodeURIComponent(subject));
        if (body) params.push('body=' + encodeURIComponent(body));
        if (params.length) payload += '?' + params.join('&');
        return ok(payload);
    }

    function buildTel(fields) {
        const result = normalizePhone(fields.phone);
        if (!result.ok) {
            return fail({ phone: result.empty ? MSG.phoneEmpty : MSG.phoneInvalid });
        }
        return ok('tel:' + result.phone);
    }

    function buildSms(fields) {
        const result = normalizePhone(fields.phone);
        if (!result.ok) {
            return fail({ phone: result.empty ? MSG.phoneEmpty : MSG.phoneInvalid });
        }
        const body = trim(fields.body);
        return ok(body ? 'SMSTO:' + result.phone + ':' + body : 'SMSTO:' + result.phone);
    }
```

把 `buildPayload` 换成：

```js
    function buildPayload(type, fields) {
        const source = fields || {};
        if (type === 'text') return buildText(source);
        if (type === 'url') return buildUrl(source);
        if (type === 'email') return buildEmail(source);
        if (type === 'tel') return buildTel(source);
        if (type === 'sms') return buildSms(source);
        return fail({ type: '未知类型' });
    }
```

在 `return {` 中增加 `normalizeUrl`、`normalizePhone`。

- [ ] **Step 4: Run test to verify it passes**

Run: `node regression-tests/qrcode-core.mjs`

Expected: `qrcode-core regression passed`

- [ ] **Step 5: Commit**

```bash
git add -- js/qrcode-core.js regression-tests/qrcode-core.mjs
git commit --only -m "$(cat <<'EOF'
feat: add URL, email, phone, and SMS QR payloads

EOF
)" -- js/qrcode-core.js regression-tests/qrcode-core.mjs
```

---

### Task 3: Core WiFi 与名片载荷

**Files:**
- Modify: `js/qrcode-core.js`
- Modify: `regression-tests/qrcode-core.mjs`
- Test: `regression-tests/qrcode-core.mjs`

**Interfaces:**
- Consumes: Task 2 的 `normalizeUrl`、`isValidEmail`、`MSG.emailInvalid` / `MSG.urlInvalid`
- Produces:
  - `wifi` 字段 `{ ssid, auth, password, hidden }`。`auth` 仅 `WPA`（默认）/ `WEP` / `nopass`。`nopass` 省略 `P:`。`hidden === true` 才写 `H:true`。SSID/密码转义 `\ ; , :` → `\\` `\;` `\,` `\:`
  - 载荷：`WIFI:T:<auth>;S:<ssid>;P:<password>;H:true;;`（按规则省略 P/H），结尾永远是 `;;`
  - `vcard` 字段 `{ name, phone, email, org, url }`。姓名必填。可选字段空则整行省略。值转义 `\`、换行、`;`、`,`。行结束 `\n`
  - 导出 `escapeWifi`、`escapeVCard`

- [ ] **Step 1: Extend the failing tests**

Append before `console.log`:

```js
assert.equal(
    core.buildPayload('wifi', { ssid: 'Home', auth: 'WPA', password: 'secret' }).payload,
    'WIFI:T:WPA;S:Home;P:secret;;'
);
assert.equal(
    core.buildPayload('wifi', { ssid: 'Open', auth: 'nopass', password: 'ignore' }).payload,
    'WIFI:T:nopass;S:Open;;'
);
assert.equal(
    core.buildPayload('wifi', { ssid: 'Home', auth: 'WPA', password: 'secret', hidden: true }).payload,
    'WIFI:T:WPA;S:Home;P:secret;H:true;;'
);
assert.equal(
    core.buildPayload('wifi', { ssid: 'a;b,c:d\\e', auth: 'WPA', password: 'p;q' }).payload,
    'WIFI:T:WPA;S:a\\;b\\,c\\:d\\\\e;P:p\\;q;;'
);
assert.deepEqual(core.buildPayload('wifi', { ssid: '', auth: 'WPA', password: '' }), {
    ok: false, errors: { ssid: '请输入 WiFi 名称', password: '请输入密码' }
});
assert.equal(core.buildPayload('wifi', { ssid: 'x', auth: 'nopass' }).ok, true);

assert.equal(
    core.buildPayload('vcard', { name: '张三' }).payload,
    'BEGIN:VCARD\nVERSION:3.0\nN:张三;;;;\nFN:张三\nEND:VCARD'
);
assert.equal(
    core.buildPayload('vcard', {
        name: 'Li', phone: '123', email: 'a@b.c', org: 'Acme', url: 'acme.com'
    }).payload,
    'BEGIN:VCARD\nVERSION:3.0\nN:Li;;;;\nFN:Li\nORG:Acme\nTEL:123\nEMAIL:a@b.c\nURL:https://acme.com\nEND:VCARD'
);
assert.equal(
    core.buildPayload('vcard', { name: 'A;B' }).payload,
    'BEGIN:VCARD\nVERSION:3.0\nN:A\\;B;;;;\nFN:A\\;B\nEND:VCARD'
);
assert.ok(!core.buildPayload('vcard', { name: 'Li' }).payload.includes('ORG:'));
assert.ok(!core.buildPayload('vcard', { name: 'Li' }).payload.includes('TEL:'));
assert.deepEqual(core.buildPayload('vcard', { name: '  ' }), {
    ok: false, errors: { name: '请输入姓名' }
});
assert.deepEqual(core.buildPayload('vcard', { name: 'Li', email: 'bad' }), {
    ok: false, errors: { email: '请输入有效邮箱' }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/qrcode-core.mjs`

Expected: FAIL because `wifi` / `vcard` 仍是未知类型

- [ ] **Step 3: Implement WiFi and vCard**

在 `MSG` 增加：

```js
        wifiSsid: '请输入 WiFi 名称',
        wifiPassword: '请输入密码',
        vcardName: '请输入姓名',
```

在 `buildSms` 之后加入：

```js
    function escapeWifi(value) {
        return String(value).replace(/([\\;,:])/g, '\\$1');
    }

    function escapeVCard(value) {
        return String(value)
            .replace(/\\/g, '\\\\')
            .replace(/\r\n|\n|\r/g, '\\n')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,');
    }

    function buildWifi(fields) {
        const ssid = trim(fields.ssid);
        const auth = fields.auth === 'WEP' || fields.auth === 'nopass' ? fields.auth : 'WPA';
        const hidden = Boolean(fields.hidden);
        const errors = {};
        if (!ssid) errors.ssid = MSG.wifiSsid;
        const password = trim(fields.password);
        if (auth !== 'nopass' && !password) errors.password = MSG.wifiPassword;
        if (Object.keys(errors).length) return fail(errors);
        const parts = ['WIFI:T:' + auth, 'S:' + escapeWifi(ssid)];
        if (auth !== 'nopass') parts.push('P:' + escapeWifi(password));
        if (hidden) parts.push('H:true');
        return ok(parts.join(';') + ';;');
    }

    function buildVCard(fields) {
        const name = trim(fields.name);
        if (!name) return fail({ name: MSG.vcardName });
        const errors = {};
        const email = trim(fields.email);
        if (email && !isValidEmail(email)) errors.email = MSG.emailInvalid;
        let urlValue = '';
        const urlRaw = trim(fields.url);
        if (urlRaw) {
            const result = normalizeUrl(urlRaw);
            if (!result.ok) errors.url = MSG.urlInvalid;
            else urlValue = result.url;
        }
        if (Object.keys(errors).length) return fail(errors);
        const lines = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            'N:' + escapeVCard(name) + ';;;;',
            'FN:' + escapeVCard(name)
        ];
        const org = trim(fields.org);
        const phone = trim(fields.phone);
        if (org) lines.push('ORG:' + escapeVCard(org));
        if (phone) lines.push('TEL:' + escapeVCard(phone));
        if (email) lines.push('EMAIL:' + escapeVCard(email));
        if (urlValue) lines.push('URL:' + escapeVCard(urlValue));
        lines.push('END:VCARD');
        return ok(lines.join('\n'));
    }
```

`buildPayload` 改为：

```js
    function buildPayload(type, fields) {
        const source = fields || {};
        const handlers = {
            text: buildText,
            url: buildUrl,
            wifi: buildWifi,
            vcard: buildVCard,
            email: buildEmail,
            tel: buildTel,
            sms: buildSms
        };
        const handler = handlers[type];
        if (!handler) return fail({ type: '未知类型' });
        return handler(source);
    }
```

`return` 增加 `escapeWifi`、`escapeVCard`。

- [ ] **Step 4: Run test to verify it passes**

Run: `node regression-tests/qrcode-core.mjs`

Expected: `qrcode-core regression passed`

- [ ] **Step 5: Commit**

```bash
git add -- js/qrcode-core.js regression-tests/qrcode-core.mjs
git commit --only -m "$(cat <<'EOF'
feat: add WiFi and vCard QR payload builders

EOF
)" -- js/qrcode-core.js regression-tests/qrcode-core.mjs
```

---

### Task 4: 二维码工具页面

**Files:**
- Create: `items/QRCode.html`
- Create: `regression-tests/qrcode-page.mjs`
- Test: `regression-tests/qrcode-page.mjs`
- Test: `regression-tests/qrcode-core.mjs`

**Interfaces:**
- Consumes: `window.QRCodeCore`（Task 1–3 全部 API）和全局 `QRCode`（cdnjs 1.5.1）
- Produces: 可单独打开的工具页。`scheduleRender` 防抖 150ms；`readFields(type)` 从当前类型表单取值；会话 `drafts` 按类型保留；`localStorage[QRCodeCore.STORAGE_KEY]` 只写 style

- [ ] **Step 1: Write the failing page regression**

Create `regression-tests/qrcode-page.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('items/QRCode.html', 'utf8');

assert.match(page, /cdnjs\.cloudflare\.com\/ajax\/libs\/qrcode\/1\.5\.1\/qrcode\.min\.js/);
assert.match(page, /qrcode-core\.js/);
assert.match(page, /theme\.js/);
assert.match(page, /17tools-qrcode/);
assert.match(page, /<title>二维码工具<\/title>/);
assert.match(page, /data-type="text"/);
assert.match(page, /data-type="url"/);
assert.match(page, /data-type="wifi"/);
assert.match(page, /data-type="vcard"/);
assert.match(page, /data-type="email"/);
assert.match(page, /data-type="tel"/);
assert.match(page, /data-type="sms"/);
assert.match(page, /id="btnPng"/);
assert.match(page, /id="btnSvg"/);
assert.match(page, /id="btnCopy"/);
assert.match(page, /id="previewCanvas"/);
assert.match(page, /class="form-input"/);
assert.match(page, /errorCorrectionLevel/);
assert.match(page, /margin:\s*2/);
assert.match(page, /150/);
assert.equal(page.includes('innerHTML'), false);
assert.equal(page.includes('alert('), false);
assert.match(page, /填写内容后生成二维码/);
assert.match(page, /二维码库加载失败/);
assert.match(page, /无法复制，请改用下载/);
assert.match(page, /已复制到剪贴板/);
assert.match(page, /无法生成二维码，请缩短内容/);
assert.match(page, /前景与背景对比过低，可能无法扫描/);

console.log('qrcode-page regression passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/qrcode-page.mjs`

Expected: FAIL with `ENOENT` on `items/QRCode.html`

- [ ] **Step 3: Create the page**

Create `items/QRCode.html` with **exactly** this content (do not add `innerHTML` or `alert`):

```html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>二维码工具</title>
    <link rel="stylesheet" href="../css/theme.css">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        html, body { margin: 0; min-height: 100vh; background: var(--background-primary); color: var(--text-primary); font-family: var(--font-family); }
        .page { padding: var(--spacing-lg); max-width: 1280px; margin: 0 auto; }
        h1 { margin: 0 0 var(--spacing-lg); text-align: center; display: flex; align-items: center; justify-content: center; gap: var(--spacing-sm); font-size: 28px; }
        h1 i { color: var(--primary-color); }
        .layout { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: var(--spacing-lg); }
        .preview-pane, .control-pane { background: var(--background-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--spacing-lg); box-shadow: var(--shadow-sm); }
        .preview-box { min-height: 280px; border: 1px dashed var(--border-color); border-radius: var(--radius-md); display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--background-primary); padding: var(--spacing-lg); }
        #previewCanvas { max-width: 100%; max-height: 420px; display: none; }
        #previewCanvas.is-visible { display: block; }
        .drop-hint { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-sm); text-align: center; color: var(--text-secondary); }
        .drop-hint i { font-size: 32px; color: var(--primary-color); }
        .drop-hint.is-hidden { display: none; }
        .types { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: var(--spacing-lg); }
        .type-btn { background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); padding: 10px 12px; cursor: pointer; font-size: 14px; font-weight: 600; }
        .type-btn.active { color: var(--primary-color); border-bottom-color: var(--primary-color); }
        .type-panel { display: none; }
        .type-panel.active { display: block; }
        .form-group { margin-bottom: 12px; }
        label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
        .field-error { min-height: 1.2em; color: var(--error-color); font-size: 12px; margin-top: 4px; }
        .warn, .action-msg { font-size: 13px; margin-top: 8px; min-height: 1.4em; }
        .warn { color: var(--warning-color); }
        .size-row, .color-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .size-row button { border: 1px solid var(--border-color); background: var(--background-primary); color: var(--text-primary); border-radius: 8px; padding: 8px 12px; cursor: pointer; }
        .size-row button.active { background: var(--primary-light); border-color: var(--primary-color); color: var(--primary-color); }
        input[type="color"] { width: 48px; height: 36px; padding: 2px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--background-primary); }
        .actions { display: flex; flex-direction: column; gap: 8px; margin-top: var(--spacing-md); }
        .actions button:disabled { opacity: 0.5; cursor: not-allowed; }
        .hidden { display: none !important; }
        @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="page">
        <h1><i class="fas fa-qrcode"></i>二维码工具</h1>
        <div class="layout">
            <div class="preview-pane">
                <div class="preview-box">
                    <div class="drop-hint" id="previewHint">
                        <i class="fas fa-qrcode"></i>
                        <div id="previewHintText">填写内容后生成二维码</div>
                    </div>
                    <canvas id="previewCanvas" width="256" height="256"></canvas>
                </div>
                <div class="warn" id="contrastWarn"></div>
                <div class="action-msg" id="actionMsg"></div>
            </div>
            <div class="control-pane">
                <div class="types">
                    <button class="type-btn active" type="button" data-type="text">文本</button>
                    <button class="type-btn" type="button" data-type="url">链接</button>
                    <button class="type-btn" type="button" data-type="wifi">WiFi</button>
                    <button class="type-btn" type="button" data-type="vcard">名片</button>
                    <button class="type-btn" type="button" data-type="email">邮件</button>
                    <button class="type-btn" type="button" data-type="tel">电话</button>
                    <button class="type-btn" type="button" data-type="sms">短信</button>
                </div>

                <div class="type-panel active" data-panel="text">
                    <div class="form-group">
                        <label for="textInput">内容</label>
                        <textarea class="form-input form-textarea" id="textInput" rows="5"></textarea>
                        <div class="field-error" data-error-for="text"></div>
                    </div>
                </div>
                <div class="type-panel" data-panel="url">
                    <div class="form-group">
                        <label for="urlInput">链接</label>
                        <input class="form-input" id="urlInput" type="text">
                        <div class="field-error" data-error-for="url"></div>
                    </div>
                </div>
                <div class="type-panel" data-panel="wifi">
                    <div class="form-group">
                        <label for="wifiSsid">WiFi 名称</label>
                        <input class="form-input" id="wifiSsid" type="text">
                        <div class="field-error" data-error-for="ssid"></div>
                    </div>
                    <div class="form-group">
                        <label for="wifiAuth">加密</label>
                        <select class="form-input form-select" id="wifiAuth">
                            <option value="WPA" selected>WPA</option>
                            <option value="WEP">WEP</option>
                            <option value="nopass">无密码</option>
                        </select>
                    </div>
                    <div class="form-group" id="wifiPassGroup">
                        <label for="wifiPassword">密码</label>
                        <input class="form-input" id="wifiPassword" type="text">
                        <div class="field-error" data-error-for="password"></div>
                    </div>
                    <div class="form-group">
                        <label><input id="wifiHidden" type="checkbox"> 隐藏网络</label>
                    </div>
                </div>
                <div class="type-panel" data-panel="vcard">
                    <div class="form-group">
                        <label for="vcardName">姓名</label>
                        <input class="form-input" id="vcardName" type="text">
                        <div class="field-error" data-error-for="name"></div>
                    </div>
                    <div class="form-group">
                        <label for="vcardPhone">电话</label>
                        <input class="form-input" id="vcardPhone" type="text">
                    </div>
                    <div class="form-group">
                        <label for="vcardEmail">邮箱</label>
                        <input class="form-input" id="vcardEmail" type="text">
                        <div class="field-error" data-error-for="email"></div>
                    </div>
                    <div class="form-group">
                        <label for="vcardOrg">公司</label>
                        <input class="form-input" id="vcardOrg" type="text">
                    </div>
                    <div class="form-group">
                        <label for="vcardUrl">网址</label>
                        <input class="form-input" id="vcardUrl" type="text">
                        <div class="field-error" data-error-for="url"></div>
                    </div>
                </div>
                <div class="type-panel" data-panel="email">
                    <div class="form-group">
                        <label for="emailTo">收件人</label>
                        <input class="form-input" id="emailTo" type="text">
                        <div class="field-error" data-error-for="email"></div>
                    </div>
                    <div class="form-group">
                        <label for="emailSubject">主题</label>
                        <input class="form-input" id="emailSubject" type="text">
                    </div>
                    <div class="form-group">
                        <label for="emailBody">正文</label>
                        <textarea class="form-input form-textarea" id="emailBody" rows="3"></textarea>
                    </div>
                </div>
                <div class="type-panel" data-panel="tel">
                    <div class="form-group">
                        <label for="telPhone">号码</label>
                        <input class="form-input" id="telPhone" type="text">
                        <div class="field-error" data-error-for="phone"></div>
                    </div>
                </div>
                <div class="type-panel" data-panel="sms">
                    <div class="form-group">
                        <label for="smsPhone">号码</label>
                        <input class="form-input" id="smsPhone" type="text">
                        <div class="field-error" data-error-for="phone"></div>
                    </div>
                    <div class="form-group">
                        <label for="smsBody">正文</label>
                        <textarea class="form-input form-textarea" id="smsBody" rows="3"></textarea>
                    </div>
                </div>

                <div class="form-group">
                    <label>前景色 / 背景色</label>
                    <div class="color-row">
                        <input id="fgColor" type="color" value="#000000">
                        <input id="bgColor" type="color" value="#ffffff">
                    </div>
                </div>
                <div class="form-group">
                    <label>尺寸</label>
                    <div class="size-row">
                        <button type="button" data-size="128">128</button>
                        <button type="button" class="active" data-size="256">256</button>
                        <button type="button" data-size="512">512</button>
                        <button type="button" data-size="1024">1024</button>
                    </div>
                </div>
                <div class="form-group">
                    <label for="eccSelect">纠错</label>
                    <select class="form-input form-select" id="eccSelect">
                        <option value="L">L</option>
                        <option value="M" selected>M</option>
                        <option value="Q">Q</option>
                        <option value="H">H</option>
                    </select>
                </div>
                <div class="actions">
                    <button class="btn btn-primary" id="btnPng" type="button" disabled>下载 PNG</button>
                    <button class="btn btn-secondary" id="btnSvg" type="button" disabled>下载 SVG</button>
                    <button class="btn btn-secondary" id="btnCopy" type="button" disabled>复制图片</button>
                </div>
            </div>
        </div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js"></script>
    <script src="../js/qrcode-core.js"></script>
    <script>
        const core = window.QRCodeCore;
        const canvas = document.getElementById('previewCanvas');
        const hint = document.getElementById('previewHint');
        const hintText = document.getElementById('previewHintText');
        const contrastWarn = document.getElementById('contrastWarn');
        const actionMsg = document.getElementById('actionMsg');
        const btnPng = document.getElementById('btnPng');
        const btnSvg = document.getElementById('btnSvg');
        const btnCopy = document.getElementById('btnCopy');
        const fgColor = document.getElementById('fgColor');
        const bgColor = document.getElementById('bgColor');
        const eccSelect = document.getElementById('eccSelect');
        const wifiPassGroup = document.getElementById('wifiPassGroup');
        const wifiAuth = document.getElementById('wifiAuth');

        const drafts = {
            text: { text: '' },
            url: { url: '' },
            wifi: { ssid: '', auth: 'WPA', password: '', hidden: false },
            vcard: { name: '', phone: '', email: '', org: '', url: '' },
            email: { email: '', subject: '', body: '' },
            tel: { phone: '' },
            sms: { phone: '', body: '' }
        };

        let currentType = 'text';
        let currentPayload = '';
        let debounceTimer = 0;
        let libraryOk = typeof QRCode !== 'undefined';

        function $(id) { return document.getElementById(id); }

        function readStyle() {
            const sizeBtn = document.querySelector('.size-row button.active');
            return core.parseStyle({
                type: currentType,
                foreground: fgColor.value,
                background: bgColor.value,
                size: sizeBtn ? Number(sizeBtn.getAttribute('data-size')) : 256,
                ecc: eccSelect.value
            });
        }

        function applyStyle(style) {
            currentType = style.type;
            fgColor.value = style.foreground.toLowerCase();
            bgColor.value = style.background.toLowerCase();
            eccSelect.value = style.ecc;
            document.querySelectorAll('.size-row button').forEach((btn) => {
                btn.classList.toggle('active', Number(btn.getAttribute('data-size')) === style.size);
            });
            document.querySelectorAll('.type-btn').forEach((btn) => {
                btn.classList.toggle('active', btn.getAttribute('data-type') === style.type);
            });
            document.querySelectorAll('.type-panel').forEach((panel) => {
                panel.classList.toggle('active', panel.getAttribute('data-panel') === style.type);
            });
        }

        function saveStyle() {
            try {
                localStorage.setItem(core.STORAGE_KEY, JSON.stringify(readStyle()));
            } catch (err) { /* ignore quota / private mode */ }
        }

        function loadStyle() {
            try {
                const raw = localStorage.getItem(core.STORAGE_KEY);
                if (!raw) return core.DEFAULT_STYLE;
                return core.parseStyle(JSON.parse(raw));
            } catch (err) {
                return core.DEFAULT_STYLE;
            }
        }

        function readFields(type) {
            if (type === 'text') return { text: $('textInput').value };
            if (type === 'url') return { url: $('urlInput').value };
            if (type === 'wifi') {
                return {
                    ssid: $('wifiSsid').value,
                    auth: wifiAuth.value,
                    password: $('wifiPassword').value,
                    hidden: $('wifiHidden').checked
                };
            }
            if (type === 'vcard') {
                return {
                    name: $('vcardName').value,
                    phone: $('vcardPhone').value,
                    email: $('vcardEmail').value,
                    org: $('vcardOrg').value,
                    url: $('vcardUrl').value
                };
            }
            if (type === 'email') {
                return {
                    email: $('emailTo').value,
                    subject: $('emailSubject').value,
                    body: $('emailBody').value
                };
            }
            if (type === 'tel') return { phone: $('telPhone').value };
            return { phone: $('smsPhone').value, body: $('smsBody').value };
        }

        function writeFields(type, fields) {
            if (type === 'text') $('textInput').value = fields.text || '';
            if (type === 'url') $('urlInput').value = fields.url || '';
            if (type === 'wifi') {
                $('wifiSsid').value = fields.ssid || '';
                wifiAuth.value = fields.auth || 'WPA';
                $('wifiPassword').value = fields.password || '';
                $('wifiHidden').checked = Boolean(fields.hidden);
            }
            if (type === 'vcard') {
                $('vcardName').value = fields.name || '';
                $('vcardPhone').value = fields.phone || '';
                $('vcardEmail').value = fields.email || '';
                $('vcardOrg').value = fields.org || '';
                $('vcardUrl').value = fields.url || '';
            }
            if (type === 'email') {
                $('emailTo').value = fields.email || '';
                $('emailSubject').value = fields.subject || '';
                $('emailBody').value = fields.body || '';
            }
            if (type === 'tel') $('telPhone').value = fields.phone || '';
            if (type === 'sms') {
                $('smsPhone').value = fields.phone || '';
                $('smsBody').value = fields.body || '';
            }
            syncWifiPasswordVisibility();
        }

        function syncWifiPasswordVisibility() {
            wifiPassGroup.classList.toggle('hidden', wifiAuth.value === 'nopass');
        }

        function clearFieldErrors() {
            document.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
        }

        function showFieldErrors(errors) {
            clearFieldErrors();
            const panel = document.querySelector('.type-panel.active');
            Object.keys(errors || {}).forEach((key) => {
                const el = panel.querySelector('[data-error-for="' + key + '"]');
                if (el) el.textContent = errors[key];
            });
        }

        function setButtonsEnabled(enabled) {
            btnPng.disabled = !enabled;
            btnSvg.disabled = !enabled;
            btnCopy.disabled = !enabled;
        }

        function renderOptions(style) {
            return {
                errorCorrectionLevel: style.ecc,
                width: style.size,
                margin: 2,
                color: { dark: style.foreground, light: style.background }
            };
        }

        function showPlaceholder(text) {
            currentPayload = '';
            canvas.classList.remove('is-visible');
            hint.classList.remove('is-hidden');
            hintText.textContent = text;
            setButtonsEnabled(false);
        }

        function scheduleRender() {
            window.clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(renderPreview, 150);
        }

        function renderPreview() {
            actionMsg.textContent = '';
            const style = readStyle();
            contrastWarn.textContent = core.isLowContrast(style.foreground, style.background)
                ? '前景与背景对比过低，可能无法扫描'
                : '';
            if (!libraryOk) {
                showPlaceholder('二维码库加载失败');
                return;
            }
            const built = core.buildPayload(currentType, readFields(currentType));
            if (!built.ok) {
                showFieldErrors(built.errors);
                showPlaceholder('填写内容后生成二维码');
                return;
            }
            clearFieldErrors();
            QRCode.toCanvas(canvas, built.payload, renderOptions(style), (error) => {
                if (error) {
                    showPlaceholder('无法生成二维码，请缩短内容');
                    actionMsg.textContent = '无法生成二维码，请缩短内容';
                    return;
                }
                currentPayload = built.payload;
                hint.classList.add('is-hidden');
                canvas.classList.add('is-visible');
                setButtonsEnabled(true);
            });
        }

        function downloadBlob(blob, name) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = name;
            link.click();
            URL.revokeObjectURL(url);
        }

        function switchType(nextType) {
            drafts[currentType] = readFields(currentType);
            currentType = nextType;
            writeFields(nextType, drafts[nextType]);
            applyStyle(Object.assign(readStyle(), { type: nextType }));
            saveStyle();
            scheduleRender();
        }

        document.querySelectorAll('.type-btn').forEach((btn) => {
            btn.addEventListener('click', () => switchType(btn.getAttribute('data-type')));
        });
        document.querySelectorAll('.size-row button').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.size-row button').forEach((el) => el.classList.remove('active'));
                btn.classList.add('active');
                saveStyle();
                scheduleRender();
            });
        });
        wifiAuth.addEventListener('change', () => {
            syncWifiPasswordVisibility();
            scheduleRender();
        });
        ['fgColor', 'bgColor', 'eccSelect'].forEach((id) => {
            $(id).addEventListener('change', () => { saveStyle(); scheduleRender(); });
        });
        document.querySelector('.control-pane').addEventListener('input', scheduleRender);

        btnPng.addEventListener('click', () => {
            if (!currentPayload) return;
            canvas.toBlob((blob) => {
                if (!blob) return;
                downloadBlob(blob, core.buildFileName(currentType, 'png'));
            }, 'image/png');
        });
        btnSvg.addEventListener('click', () => {
            if (!currentPayload || !libraryOk) return;
            QRCode.toString(currentPayload, Object.assign({ type: 'svg' }, renderOptions(readStyle())), (error, svg) => {
                if (error) {
                    actionMsg.textContent = '无法生成二维码，请缩短内容';
                    return;
                }
                downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), core.buildFileName(currentType, 'svg'));
            });
        });
        btnCopy.addEventListener('click', () => {
            if (!currentPayload) return;
            canvas.toBlob(async (blob) => {
                if (!blob || !navigator.clipboard || !window.ClipboardItem) {
                    actionMsg.textContent = '无法复制，请改用下载';
                    return;
                }
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    actionMsg.textContent = '已复制到剪贴板';
                } catch (err) {
                    actionMsg.textContent = '无法复制，请改用下载';
                }
            }, 'image/png');
        });

        applyStyle(loadStyle());
        if (!libraryOk) {
            showPlaceholder('二维码库加载失败');
        } else {
            showPlaceholder('填写内容后生成二维码');
            scheduleRender();
        }
    </script>
    <script src="../js/theme.js"></script>
</body>
</html>
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node regression-tests/qrcode-core.mjs
node regression-tests/qrcode-page.mjs
```

Expected:

```
qrcode-core regression passed
qrcode-page regression passed
```

手测（打开 `items/QRCode.html` 或经 `index.html` iframe，本任务可直接打开文件）：

- 输入文本出现二维码，手机能扫出原文；清空后回到占位且按钮禁用
- 链接类型输入 `example.com`，扫出 `https://example.com`
- WiFi 类型填 SSID/密码，扫出可连网配置；选 nopass 时密码框消失
- 切换到链接再切回文本，原文还在
- 前景背景都设成白色时出现对比度警告，仍可下载
- 下载 PNG / SVG 文件名分别为 `qr-text.png` / `qr-text.svg`
- 复制按钮在安全上下文给出成功或失败文案
- 缩窄窗口变为上下堆叠；切换深色主题控件仍可读

- [ ] **Step 5: Commit**

```bash
git add -- items/QRCode.html regression-tests/qrcode-page.mjs
git commit --only -m "$(cat <<'EOF'
feat: add QR code tool page with live preview and export

EOF
)" -- items/QRCode.html regression-tests/qrcode-page.mjs
```

---

### Task 5: 接入导航、版本与说明

**Files:**
- Modify: `index.html`（「图片处理」`nav-item` 之后）
- Modify: `items/Welcome.html`
- Modify: `items/History.html`
- Modify: `js/version.js`
- Modify: `README.md`
- Modify: `regression-tests/qrcode-page.mjs`
- Modify: `regression-tests/image-processor-page.mjs`
- Test: `regression-tests/qrcode-page.mjs`
- Test: `regression-tests/image-processor-page.mjs`
- Test: `regression-tests/history-layout.mjs`
- Test: `regression-tests/qrcode-core.mjs`

**Interfaces:**
- Consumes: `items/QRCode.html` 已存在
- Produces: 侧栏可打开该工具；版本显示 2.16.0；Welcome 工具数为 19

- [ ] **Step 1: Extend page regression to cover integration**

Append to `regression-tests/qrcode-page.mjs` before `console.log`:

```js
const index = fs.readFileSync('index.html', 'utf8');
const welcome = fs.readFileSync('items/Welcome.html', 'utf8');
const history = fs.readFileSync('items/History.html', 'utf8');
const version = fs.readFileSync('js/version.js', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');

const imageIndex = index.indexOf('data-file="ImageProcessor.html"');
const qrIndex = index.indexOf('data-file="QRCode.html"');
const regexIndex = index.indexOf('data-file="Regex.html"');
assert.ok(imageIndex !== -1 && qrIndex !== -1 && regexIndex !== -1, '导航缺少图片处理、二维码或正则入口');
assert.ok(qrIndex > imageIndex, '二维码工具应在图片处理之后');
assert.ok(qrIndex < regexIndex, '二维码工具应在正则表达式之前');
assert.match(index, /二维码工具/);
assert.equal(/data-file="QRCode.html"[^>]*data-protected/.test(index), false);

assert.match(welcome, /19个实用工具/);
assert.match(welcome, /v2\.16\.0/);
assert.match(history, /<!-- 版本 2\.16\.0 -->/);
assert.match(history, /版本 2\.16\.0/);
assert.match(history, /2026-08-13/);
assert.match(history, /二维码工具/);
assert.match(version, /2\.16\.0/);
assert.equal(version.includes('2.15.2'), false);
assert.match(readme, /二维码工具/);
assert.match(readme, /QRCode\.html/);
assert.match(readme, /qrcode-core\.js/);
```

In `regression-tests/image-processor-page.mjs` replace:

- `/18个实用工具/` → `/19个实用工具/`
- `/v2\\.15\\.2/` → `/v2\\.16\\.0/`
- `/<!-- 版本 2\\.15\\.2 -->/` 与 `/版本 2\\.15\\.2/` 保留（History 仍应包含旧版本）。不要删除 2.15.2 历史断言。
- `assert.match(version, /2\.15\.2/);` 改为 `assert.match(version, /2\.16\.0/);`
- `assert.equal(version.includes('2.15.1'), false);` 与 `2.15.0` / `2.14.1` 的 false 断言保持；**新增** `assert.equal(version.includes('2.15.2'), false);`

- [ ] **Step 2: Run test to verify it fails**

Run: `node regression-tests/qrcode-page.mjs`

Expected: FAIL because `index.html` 还没有 `QRCode.html`

- [ ] **Step 3: Wire the site files**

In `index.html`, immediately after the ImageProcessor nav item and before Regex, insert:

```html
                    <div class="nav-item" data-file="QRCode.html">
                        <i class="fas fa-qrcode"></i>
                        <span>二维码工具</span>
                    </div>
```

In `items/Welcome.html`:

- `18个实用工具` → `19个实用工具`
- `v2.15.2` → `v2.16.0`

In `items/History.html`, insert this block as the first `.version-entry` inside `.timeline`（放在 `<!-- 版本 2.15.2 -->` 之前）:

```html
            <!-- 版本 2.16.0 -->
            <div class="version-entry">
                <div class="version-dot"></div>
                <div class="version-header">
                    <div class="version-number">版本 2.16.0</div>
                    <div class="version-date">2026-08-13</div>
                </div>
                <div class="update-list">
                    <div class="feature-category">新功能</div>
                    <ul>
                        <li><span class="tag new">新增</span>二维码工具：新增独立工具页和侧栏入口，支持文本、链接、WiFi、名片、邮件、电话和短信，可调颜色、尺寸和纠错并导出 PNG、SVG 或复制图片</li>
                    </ul>
                </div>
            </div>
```

In `js/version.js`, replace every `'2.15.2'` fallback and the `@version 2.15.2` comment with `2.16.0`。文件中不得再出现 `2.15.2`。

In `README.md`:

- 「当前包含…」那句补上二维码。
- 「主要工具」在图片处理之后、正则工具之前增加：`- 二维码工具：把文本、链接、WiFi、名片、邮件、电话或短信生成二维码，可调颜色、尺寸和纠错级别，并下载 PNG / SVG 或复制图片。`
- 「技术实现」第三方库列表加上 qrcode 1.5.1。
- 项目结构补上 `js/qrcode-core.js`（放在 `image-processor-core.js` 附近）和 `items/QRCode.html`（放在 `ImageProcessor.html` 附近）。

不要改 `items/WifiQRCode.html` 或 `js/auth.js`。

- [ ] **Step 4: Run all related regressions**

Run:

```bash
node regression-tests/qrcode-core.mjs
node regression-tests/qrcode-page.mjs
node regression-tests/image-processor-page.mjs
node regression-tests/history-layout.mjs
```

Expected:

```
qrcode-core regression passed
qrcode-page regression passed
image-processor-page regression passed
history-layout regression passed (N versions)
```

`N` 会比原来多 1。若 `history-layout` 失败，检查 2.16.0 是否只用了「新功能」且标签是 `tag new`。

通过侧栏打开「二维码工具」，确认它出现在「图片处理」下方，且未登录时不像「研发中」那样显示「敬请期待」。

- [ ] **Step 5: Commit**

```bash
git add -- index.html items/Welcome.html items/History.html js/version.js README.md regression-tests/qrcode-page.mjs regression-tests/image-processor-page.mjs
git commit --only -m "$(cat <<'EOF'
feat: add QR code tool to sidebar and bump version to 2.16.0

EOF
)" -- index.html items/Welcome.html items/History.html js/version.js README.md regression-tests/qrcode-page.mjs regression-tests/image-processor-page.mjs
```

---

## Spec coverage

| Spec 要求 | Task |
| --- | --- |
| 文本 / 1200 字上限 | 1 |
| 样式消毒、对比度、文件名 | 1 |
| 链接补 https、mailto、tel、SMSTO | 2 |
| WiFi 转义与 nopass / hidden | 3 |
| vCard 3.0 与可选行省略 | 3 |
| 页面预览、150ms、PNG/SVG/复制、localStorage | 4 |
| 侧栏位置、Welcome 19、History 2.16.0、README | 5 |
| 不改 WifiQRCode / auth | 5 约束 |
| 现有 image-processor-page / history-layout | 5 |
