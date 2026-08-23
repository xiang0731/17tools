# 17Tools — Agent 指南

给在本仓库改代码的 agent 用。人读说明看 `README.md`。当前版本号以 `items/History.html` 时间轴**第一条**为准，不要把本文件里的例子当成活版本。

## 这是什么

纯前端静态工具站：打开 `index.html` 即可。无构建、无根目录 `package.json`、无后端。壳是侧栏 + iframe；每个工具是 `items/*.html` 独立页。用户数据只在浏览器本地处理，不要上传。

界面文案用中文。新功能先对齐现有工具的布局和主题，再发明新视觉。

## 架构

```text
index.html          壳：导航、主题、iframe、加载进度、未保存保护、研发中鉴权
css/theme.css       全局 CSS 变量（浅色/深色）
js/theme.js         子页与父页主题同步（新工具用这个）
js/theme-injector.js  旧页兜底注入，不要给新工具用
js/auth.js          侧栏「研发中」密码（sessionStorage）
js/version.js       从 History.html 读最新版本，失败才用文件内回退号
js/unsaved-guard.js 切换工具前确认未保存输入
js/load-progress.js 加载超过 1 秒才显示进度条
js/*-core.js        可 Node 测试的纯逻辑（UMD，无 DOM）
items/*.html        工具页
regression-tests/   静态断言 + 少量 Playwright
docs/superpowers/   设计稿与实现计划
```

父页用 `postMessage({ type: '17tools-theme', theme })` 同步主题。不要另起协议。`localStorage` 主题键是 `theme`。

## 改代码时怎么做

1. 颜色、间距、圆角、字体用 `css/theme.css` 变量，不要写死 `#fff` / `#111827` 一类主题色。
2. 用户输入、错误、预览文案用 `textContent` / `createTextNode`。不要把用户内容塞进 `innerHTML`。
3. `localStorage` 键用 `17tools-<tool>`。默认只存样式/偏好，不存表单正文或密钥；要存内容须在 spec 里写明。
4. 只改任务范围内的文件。不要顺手重构邻页、不要改 `js/auth.js`、不要改 `items/Welcome/` 下的欢迎页草稿。


## 新增或公开一个工具

侧栏入口在 `index.html` 的 `.nav-item[data-file="Xxx.html"]`。公开工具**不要** `data-protected`。

新页面模板（新工具）：

- `items/Foo.html`：`<link rel="stylesheet" href="../css/theme.css">`
- 页脚脚本顺序：`../js/<core>.js`（如有）→ 页面脚本 → `../js/unsaved-guard.js` → `../js/theme.js`
- 标题用中文；宽屏可左右分栏（预览 | 参数），窄屏堆叠。参考 `items/QRCode.html`、`items/DealHunter.html`。

同步这些接入点（漏一处，现有 `*-page.mjs` 就会挂）：

| 位置                  | 做什么                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------- |
| `index.html`          | 加导航项、图标、分组位置                                                               |
| `items/Welcome.html`  | 「N个实用工具」计数（只计公开工具，不含主页/研发中/History/About）                     |
| `items/History.html`  | 追加新版本条目（见下）                                                                 |
| `js/version.js`       | 失败回退版本号改成**同一个**新版本；不要留下旧回退号                                   |
| `README.md`           | 工具列表与目录                                                                         |
| `js/load-progress.js` | 若该页经常 >1s 才出来，把预估毫秒写进 `ESTIMATES_MS`                                   |
| `regression-tests/`   | `*-core.mjs` 测逻辑；`*-page.mjs` 锁页面结构、导航位置、Welcome/History/version/README |

研发中工具：`data-protected="true"`，侧栏对外文案保持「敬请期待」。WiFi 二维码已并入公开「二维码工具」，不要改 `items/WifiQRCode.html` 来做正式入口。

不需要离开确认的页面：根节点加 `data-unsaved-guard="off"`（现有：万年历、正则）。否则保留默认保护。

## 版本与更新历史

`items/History.html` 是版本源。页面展示由 `js/version.js` 读第一条 `.version-number`。

- **只追加**新版本块，不要改写已发布条目的正文。
- 新块放在时间轴**最上面**，带注释 `<!-- 版本 X.Y.Z -->`。
- 每个版本只能有一个 `.update-list`。分类名称和顺序必须是（可缺不可乱序）：
  1. `新功能` — 标签只允许 `new`
  2. `逻辑改动与优化` — 标签只允许 `improved` / `ui` / `ux` / `deprecated`
  3. `缺陷修复` — 标签只允许 `fixed` / `critical`
- 条目形态：`<li><span class="tag ux">体验</span>工具名：做了什么</li>`
- 同步 `items/Welcome.html` 的 `vX.Y.Z`，以及所有把当前版本写死的 `regression-tests/*-page.mjs`。
- 如果没有特别要求，当天的全部改动只存在一个版本的更新记录咯

## 文档

较大功能先写 spec 再写 plan，再改代码：

- 设计：`docs/superpowers/specs/YYYY-MM-DD-<name>-design.md`
- 计划：`docs/superpowers/plans/YYYY-MM-DD-<name>.md`

spec 写目标、非目标、文件表、行为。plan 按任务拆步，并写回归命令。对照最近的 `docs/superpowers/specs/2026-08-13-qrcode-tool-design.md`。

## 补充

- 项目中不需要部署的文件（比如测试文件、开发中用到的文件）放到ForDevelop文件夹中
