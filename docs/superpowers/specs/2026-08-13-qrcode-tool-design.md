# 二维码工具设计

## 目标

在 17Tools 中新增一个本地二维码生成工具。用户选择内容类型、填写字段、调整外观后，在浏览器内实时预览，并下载 PNG / SVG 或复制为图片。不上传服务器。

## 非目标

- 识别或解码已有二维码图片
- 中心 Logo、圆角模块、渐变、艺术码
- 批量生成
- 地理坐标、日历事件、加密货币等额外类型
- 改造或公开现有「研发中」的 `WifiQRCode.html`
- 服务端生成

## 接入方式

新增独立页面 `items/QRCode.html`，侧栏「主要工具」中增加「二维码工具」，放在现有「图片处理」正下方。同步更新：

- `index.html` 导航项（图标 `fa-qrcode`，文案「二维码工具」，无 `data-protected`）
- `items/Welcome.html` 工具数量（当前 18 → 19）与版本展示（随 History）
- `items/History.html` 新次版本（当前 2.15.2 → 2.16.0）「新功能」条目
- `README.md` 工具列表与目录
- `js/version.js` 的失败回退版本号改为 `2.16.0`（页面展示仍以 History 为准）

不修改 `items/WifiQRCode.html` 和 `js/auth.js`。

主题使用 `css/theme.css` 变量，跟随全局深色/浅色。布局对齐图片处理：宽屏左侧预览、右侧参数；窄屏上下堆叠。

## 页面结构

页面标题「二维码工具」。默认打开「文本」类型。

右侧上方类型切换，共 7 种，顺序固定：

1. 文本
2. 链接
3. WiFi
4. 名片
5. 邮件
6. 电话
7. 短信

切换类型只换对应表单。共用样式（颜色、尺寸、纠错）保持不变。各类型表单值在当前页面会话内保留；关闭页面后丢弃，不写入 `localStorage`。

左侧为实时预览。内容无效时显示占位（图标 +「填写内容后生成二维码」），下载和复制按钮禁用。

输入与样式变化后 150ms 防抖重绘。

## 共用样式

| 参数 | 默认 | 取值 |
| --- | --- | --- |
| 前景色 | `#000000` | 颜色选择器 |
| 背景色 | `#FFFFFF` | 颜色选择器 |
| 尺寸 | 256 | 仅四档：128 / 256 / 512 / 1024。该值是 PNG 画布与 SVG 视口边长（像素）。预览用 CSS 限制为最大宽度 100%、最大高度 420px，不改变导出分辨率 |
| 纠错 | M | L / M / Q / H |

对比度按 WCAG 2 相对亮度计算：`sRGB` 通道先 `/255` 再按 `<=0.03928 ? /12.92 : ((c+0.055)/1.055)^2.4` 线性化，`L = 0.2126R + 0.7152G + 0.0722B`，比值 `(L1+0.05)/(L2+0.05)`（较大 L 作分子）。比值 **< 3.0** 时显示警告「前景与背景对比过低，可能无法扫描」，仍允许导出。

## 第三方库

CDN 引入 soldair/node-qrcode **1.5.1**（cdnjs 上该版本含浏览器构建，1.5.2+ 的 cdnjs 资源为空）：

`https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js`

页面使用全局 `QRCode`：

- 预览与 PNG：`QRCode.toCanvas(canvas, payload, options)`
- SVG：`QRCode.toString(payload, { type: 'svg', ...options })`

`options` 固定包含：`errorCorrectionLevel`、`width`（等于所选尺寸）、`margin: 2`、`color: { dark: 前景色, light: 背景色 }`。

## 单元划分

| 单元 | 职责 | 依赖 |
| --- | --- | --- |
| `js/qrcode-core.js` | 类型常量、必填校验、URL 补协议、WiFi 转义与载荷、vCard / mailto / tel / SMSTO 拼装、文本长度上限、对比度、文件名。可在 Node 测试。 | 无 DOM |
| `items/QRCode.html` | 类型切换、表单、预览、防抖、下载 PNG/SVG、复制图片、主题、localStorage | core + qrcode 1.5.1 |
| 导航/文档文件 | 入口与说明 | 无 |

Core 以 UMD 导出 `QRCodeCore`，风格对齐 `js/tire-selector-core.js`。

## 各类型字段与载荷

校验在 core 完成。页面只负责把表单值交给 core，并根据返回的 `ok` / `errors` 显示提示、决定是否调用渲染库。

空字符串均先 `trim`。可选字段为空则不写入对应载荷键。

### 文本

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| 内容 | 是 | 多行。trim 后为空则拒绝。长度按 trim 后字符数，上限 **1200**；超出提示「内容不超过 1200 字」并拒绝 |

载荷：trim 后的原文，不做转义。

### 链接

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| URL | 是 | 单行。trim 后为空则拒绝。若没有 `http://` 或 `https://` 前缀，补 `https://`。补完后用 `new URL()` 校验；失败提示「请输入有效链接」 |

载荷：补协议后的 URL 字符串。

### WiFi

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| SSID | 是 | trim 后为空则拒绝 |
| 加密 | 是 | `WPA`（默认）/ `WEP` / `nopass`。选 `nopass` 时隐藏密码框并忽略已填密码 |
| 密码 | 加密不是 nopass 时必填 | trim 后为空则拒绝 |
| 隐藏网络 | 否 | 勾选为 true，默认 false |

载荷格式：`WIFI:T:<auth>;S:<ssid>;P:<password>;H:<true|false>;;`

- `nopass` 时省略 `P:` 段，得到 `WIFI:T:nopass;S:<ssid>;H:<true|false>;;`
- `H:` 仅在隐藏网络为 true 时写入；false 时省略 `H:` 段
- SSID 与密码中的 `\ ; , :` 必须转义为 `\\` `\;` `\,` `\:`

### 名片

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| 姓名 | 是 | trim 后为空则拒绝 |
| 电话 | 否 |  |
| 邮箱 | 否 | 非空时用与邮件相同的简单规则校验 |
| 公司 | 否 |  |
| 网址 | 否 | 非空时走与「链接」相同的补协议和 `new URL()` 校验 |

载荷为 vCard 3.0，字段值按 vCard 规则转义反斜杠、分号、逗号，换行写成 `\n`：

```
BEGIN:VCARD
VERSION:3.0
N:<姓名>;;;;
FN:<姓名>
ORG:<公司>
TEL:<电话>
EMAIL:<邮箱>
URL:<网址>
END:VCARD
```

可选字段为空则整行省略。行结束用 `\n`。

### 邮件

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| 收件人 | 是 | trim 后为空则拒绝。规则：`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`，失败提示「请输入有效邮箱」 |
| 主题 | 否 |  |
| 正文 | 否 | 多行 |

载荷：`mailto:<email>`；有主题或正文时追加 `?` 查询串，`subject` / `body` 用 `encodeURIComponent`。只有正文时为 `mailto:a@b.c?body=...`。

### 电话

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| 号码 | 是 | trim 后为空则拒绝。允许 `+`、数字、空格、`-`、括号。去掉空格后至少含一位数字，否则提示「请输入有效电话」 |

载荷：`tel:` + 去掉空格后的号码（保留 `+`、数字、`-`、括号）。

### 短信

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| 号码 | 是 | 规则与电话相同 |
| 正文 | 否 | 多行 |

载荷：无正文时 `SMSTO:<号码>`；有正文时 `SMSTO:<号码>:<正文>`。号码为去掉空格后的值。正文不做 URL 编码。

## 导出与复制

文件名由 core 给出，不含路径：

| 类型 | 文件名 |
| --- | --- |
| 文本 | `qr-text.{ext}` |
| 链接 | `qr-url.{ext}` |
| WiFi | `qr-wifi.{ext}` |
| 名片 | `qr-vcard.{ext}` |
| 邮件 | `qr-email.{ext}` |
| 电话 | `qr-tel.{ext}` |
| 短信 | `qr-sms.{ext}` |

`ext` 为 `png` 或 `svg`。

- 下载 PNG：当前 canvas 导出。
- 下载 SVG：`QRCode.toString` 的字符串存为文件。
- 复制图片：用户点击后，把当前 canvas 写成 `image/png` 的 `ClipboardItem`。不支持或失败时提示「无法复制，请改用下载」。成功提示「已复制到剪贴板」。

生成失败（库抛错、内容超出二维码容量）时不下载、不复制，提示「无法生成二维码，请缩短内容」。

## 数据流

```text
用户改类型 / 字段 / 样式
  → 150ms 防抖
  → core.validate + buildPayload
  → 失败：占位预览，禁用下载/复制，字段旁短提示
  → 成功：QRCode.toCanvas 预览
       对比度过低则显示警告（不阻止）

下载 PNG → canvas
下载 SVG → QRCode.toString
复制     → canvas → ClipboardItem
```

## 持久化

`localStorage` 键：`17tools-qrcode`

只存：

```json
{
  "type": "text",
  "foreground": "#000000",
  "background": "#FFFFFF",
  "size": 256,
  "ecc": "M"
}
```

`type` 取值：`text` | `url` | `wifi` | `vcard` | `email` | `tel` | `sms`。非法值回退为 `text`。`size` 不在四档内则回退 256。`ecc` 非法回退 `M`。颜色非法回退默认黑白。

不存任何表单内容（含文本、链接、WiFi 密码、名片等）。

样式或类型每次有效变更后写入。打开页面时读取并恢复类型与样式，表单为空。

## 异常处理

| 情况 | 行为 |
| --- | --- |
| 必填为空 | 不生成；对应字段短提示；下载/复制禁用 |
| 文本超过 1200 字 | 拒绝生成，提示不超过 1200 字 |
| 链接 / 邮箱 / 电话格式无效 | 内联提示，不生成 |
| 前景背景对比度 < 3.0 | 警告，仍允许导出 |
| 渲染库失败或容量超限 | 提示无法生成，请缩短内容 |
| 剪贴板不可用或拒绝 | 提示改用下载 |
| localStorage 读失败或 JSON 损坏 | 静默使用默认样式和文本类型 |
| 二维码库脚本未加载 | 预览区说明「二维码库加载失败」，按钮禁用 |

错误文案写在字段旁或预览下方，不使用 `alert`。

## 测试

新增 `regression-tests/qrcode-core.mjs`，覆盖 core：

- 文本：空、正常、1200 刚好通过、1201 拒绝
- 链接：补 `https://`、已有协议不重复补、非法值拒绝
- WiFi：WPA 含密码、nopass 无 `P:`、隐藏网络写 `H:true`、SSID/密码中 `; , : \` 转义
- vCard：仅姓名、全字段、分号转义、空可选字段不出现对应行
- mailto：仅收件人、含 subject/body 的编码、非法邮箱拒绝
- tel / SMSTO：去空格、无正文与有正文
- 文件名七种类型 × png/svg
- 对比度：黑白通过、同色 < 3.0

新增 `regression-tests/qrcode-page.mjs`，覆盖接入：

- `index.html` 中 `QRCode.html` 出现在 `ImageProcessor.html` 之后、`Regex.html` 之前
- 文案「二维码工具」，无 `data-protected`
- Welcome 为「19个实用工具」
- History 含 `2.16.0` 与「二维码工具」新功能条目
- `version.js` 回退为 `2.16.0` 且不再写 `2.15.2`
- README 列出二维码工具与 `QRCode.html`、`qrcode-core.js`
- 页面引入 qrcode 1.5.1、`qrcode-core.js`、`theme.js`、`17tools-qrcode`
- 七种类型控件与 PNG / SVG / 复制按钮存在
- 不向用户内容使用 `innerHTML`

页面级手测（实现完成后由执行者核对）：

- 七种类型均可扫出对应内容（至少文本、链接、WiFi）
- 切换类型不丢失会话内已填字段，也不串到另一类型
- 深色/浅色主题
- 窄屏上下堆叠
- 复制成功与失败提示

现有 `image-processor-page`、`history-layout` 与安全回归测试在加入 History 条目后仍须通过。`image-processor-page` 中写死的 Welcome「18个实用工具」和 `2.15.2` 断言改为 19 与 `2.16.0`。

## 文件清单

新建：

- `items/QRCode.html`
- `js/qrcode-core.js`
- `regression-tests/qrcode-core.mjs`
- `regression-tests/qrcode-page.mjs`

修改：

- `index.html`
- `items/Welcome.html`
- `items/History.html`
- `js/version.js`
- `README.md`
- `regression-tests/image-processor-page.mjs`（版本与工具数量断言）
