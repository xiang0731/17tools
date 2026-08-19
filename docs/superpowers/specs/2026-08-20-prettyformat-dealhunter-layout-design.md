# 代码格式化：全宽双栏布局设计

## 目标

代码格式化页去掉最外层大卡片，左右「代码输入 / 格式化结果」对齐优惠计算器：两栏等宽、横向铺满窗口、纵向占满标题以下剩余高度。语言选择、按钮、行号、高亮与格式化逻辑不变。

## 非目标

- 把语言选择或操作按钮提到标题下方做成整页工具条
- 实时随输入自动格式化（仍按现有按钮 / 语言切换 / 自动检测触发）
- 改 Prettier 规则、语言列表、复制/下载/清空行为
- 新第三方库
- 修改 `items/Welcome/` 下草稿欢迎页
- 手动拖拽改变两栏宽度

## 问题

当前 `items/PrettyFormat.html` 的 `.container` 是一张大卡片：`max-width: 1400px`、边框、阴影、内边距。`.editor-container` 是 `grid` + `min-height: 70vh`，`.editor-wrapper` 还有 `min-height: 400px`。窗口再大，编辑器被压在卡片里，两侧和底部留白。

## 布局

对照 `items/DealHunter.html`：

- `html, body`：`height: 100vh; width: 100%; overflow: hidden`（桌面）
- 删除 `.container` 这个 class 及其卡片样式（`max-width: 1400px`、背景、边框、阴影、额外 padding）。不要保留空壳 class。
- 页面壳用 `.app-container`：纵向 flex，铺满视口，`padding: var(--spacing-lg)`，`box-sizing: border-box`
- 标题 `flex-shrink: 0`，字号保持现有 28px
- 两栏容器用 `.main-layout`，删除 `.editor-container`：`display: flex; flex: 1; gap: var(--spacing-lg); min-height: 0`。桌面不再用 `grid`。删除现有 `max-width: 1024px` 把两栏改成单列的规则，改由 768px 规则负责堆叠。
- 左右 `.code-area` 均 `flex: 1; min-width: 0`，视觉对齐优惠计算器 `.panel`（`background-secondary`、边框、圆角、`overflow: hidden`、`box-shadow: sm`），内部纵向 flex
- `.editor-wrapper`：`flex: 1; min-height: 0`，去掉 `min-height: 400px`
- `.empty-state`：在输出面板内垂直水平居中填满剩余高度，去掉 `min-height: 300px`
- 语言选择、清空/复制/下载仍在左栏工具条；格式化/复制/下载仍在右栏工具条

两栏合计吃满 `.app-container` 内容宽，左右不再留大块空白。比例 1:1，不是图片处理那套 1.2 : 0.8。

窄屏（`max-width: 768px`，与优惠计算器相同）：

- `.main-layout` 改为纵向，`overflow-y: auto`
- 每个 `.code-area`：`min-height: 300px; flex: none`
- `html, body`：`overflow: auto; height: auto`
- `.app-container`：`height: auto`

语言工具条在 `900px` 以下仍可内部换行（现有规则保留）。

## HTML 结构

```
.app-container
  h1
  .main-layout
    .code-area（输入：header + language-selector + editor-wrapper）
    .code-area（输出：header + language-selector + editor-wrapper）
  #status-message（仍在壳外，fixed 定位不变）
```

不要再包一层带卡片样式的 `.container`。

## 版本与文档

- 版本 **2.16.6**，日期 **2026-08-20**
- `items/History.html` 增加一条「逻辑改动与优化」：代码格式化去掉外层大框，输入与结果铺满窗口（对齐优惠计算器）
- `js/version.js` 失败回退改为 `2.16.6`
- `items/Welcome.html` 展示 `v2.16.6`，工具数仍为 19
- 新增 `regression-tests/prettyformat-page.mjs`；`regression-tests/image-processor-page.mjs`、`regression-tests/qrcode-page.mjs` 的当前版本断言升到 2.16.6

## 测试

页面回归断言：

- 无 `.container` 的 `max-width: 1400px`
- 无 `.editor-container` 的 `min-height: 70vh`
- 无 `.editor-wrapper` 的 `min-height: 400px`
- 存在 `.app-container`、`.main-layout`、`height: 100vh`
- 存在 `2.16.6`

手工：桌面下两栏铺满剩余高度、无外层大卡片；拉大窗口编辑区跟着长；窄屏上下堆叠可滚动；格式化、行号同步、复制下载仍可用。
