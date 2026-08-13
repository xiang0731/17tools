# 17Tools

17Tools 是一个基于 HTML/CSS/JavaScript 的轻量工具集合，当前包含文本处理、代码处理、时间日期、计算、图片处理、白板和研发中工具等多个独立页面。

## 功能特点

- 纯前端静态页面，可直接打开 `index.html` 使用。
- 侧边栏导航 + iframe 内容加载。
- 支持深色/浅色主题切换。
- 支持响应式布局和移动端视图切换。
- 工具页相互独立，便于单独维护和扩展。

## 当前工具

### 主要工具

- 主页：项目欢迎页和工具概览。
- 智能白板：画笔、橡皮擦、形状、撤销/重做、JSON 保存/加载、PNG 导出。
- 极速计算：多行算术表达式求和，支持括号、小数、加减乘除和幂运算。
- 优惠计算器：折扣、满减和优惠方案对比。
- 接口带宽计算：按接口调用量、数据大小和时间窗口估算带宽。
- 正则工具：正则测试、匹配结果查看和测试文本生成。

### 文本工具

- 文本转换：提供大小写、前后缀、排序、Base64 等批量文本转换能力。
- 文本替换：批量替换文本并保留替换历史。
- 文本分割：按规则拆分、整理文本内容。
- 链接清理工具：移除链接中的跟踪参数并生成清理历史。
- Markdown 编辑器：Markdown 编辑、实时预览、复制和导出 HTML。
- 代码格式化：支持 JavaScript、TypeScript、HTML、CSS、JSON、Markdown 等格式化和高亮。
- 代码对比工具：对比两段代码或文本差异。

### 时间工具

- 万年历：公历、农历、节日、节气和月份视图。
- 时间计算：日期加减、日期差、农历/公历转换和时间偏移计算。
- 世界时间：多个时区的实时时钟和时差说明。

### 其他工具

- 轮胎选择器：通过胎宽、扁平比和轮毂尺寸选择，展示轮胎图形标识、规格解释和购买参考范围。
- 图片处理：本地添加文字水印、单张裁切，以及按目标体积或质量压缩图片。

### 研发中工具

- WiFi 二维码：生成 WiFi 配置二维码。
- 防息屏工具：保持设备屏幕常亮。
- DevTool1 / DevTool2：实验性工具入口。

### 信息页面

- 更新历史：版本更新记录。
- 关于：项目说明和相关信息。

## 技术实现

- 原生 HTML/CSS/JavaScript 实现。
- 主题样式通过 `css/theme.css` 和 `js/theme.js` 共享。
- 部分工具使用第三方库，例如 Prettier、highlight.js、Marked、Font Awesome、Cropper.js、JSZip。
- 本地历史和草稿主要使用 `localStorage` 或 `sessionStorage`。

## 使用方法

1. 直接打开 `index.html`。
2. 通过侧边栏选择所需工具。
3. 在对应工具页面输入内容并执行操作。

## 项目结构

```text
17Tools/
├── index.html
├── css/
│   └── theme.css
├── js/
│   ├── auth.js
│   ├── theme.js
│   ├── tire-selector-core.js
│   ├── image-processor-core.js
│   └── version.js
├── items/
│   ├── Welcome.html
│   ├── Board.html
│   ├── Calculator.html
│   ├── DealHunter.html
│   ├── Bandwidth.html
│   ├── Regex.html
│   ├── Transformer.html
│   ├── Replacer.html
│   ├── Divider.html
│   ├── LinkCleaner.html
│   ├── Markdown.html
│   ├── PrettyFormat.html
│   ├── CodeDiff.html
│   ├── Calendar.html
│   ├── DateCalculator.html
│   ├── WorldTime.html
│   ├── TireSelector.html
│   ├── MartianText.html
│   ├── ImageProcessor.html
│   ├── WifiQRCode.html
│   ├── Keeper.html
│   ├── History.html
│   └── About.html
├── testTools/
├── tests/
├── DRAWNIX_LICENSE.md
└── README.md
```
