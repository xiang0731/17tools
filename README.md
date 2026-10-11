# 17Tools

17Tools 是一个基于 HTML/CSS/JavaScript 的轻量工具集合，当前包含文本处理、代码处理、时间日期、计算、图片处理、二维码、白板和研发中工具等多个独立页面。

当前版本：`v2.19.1`。唯一版本源是 `items/History.html` 时间轴第一条记录。

## 功能特点

- 纯前端静态页面，可直接打开 `index.html` 使用。
- 侧边栏导航 + iframe 内容加载。
- 支持深色/浅色主题切换。
- 支持响应式布局和移动端视图切换；按任务词搜索，收藏和最近使用只保存工具ID。
- 页面布局覆盖320–1440px浅色/深色回归；时间计算与工作日卡片对齐，二维码和关于页适配窄屏，白板隐藏提示不撑宽页面。
- 工具页相互独立，便于单独维护和扩展。

## 当前工具

### 主要工具

- 主页：项目欢迎页和工具概览。
- 智能白板：无限画布，画笔、橡皮擦（点擦/消除、圆/方）、文字、形状、撤销/重做、移动画布、双指缩放、右键平移、Ctrl+滚轮缩放、JSON 保存/加载、PNG 导出、IndexedDB 自动草稿；导入先校验本地图片与资源预算，导出可选当前视野或全部范围。
- 极速计算：多行算术表达式求和，支持括号、小数、加减乘除和幂运算；`-2**2` 为 -4。展示最多15位有效数字，范围或合计溢出明确报错；明细分页，错误小计不可复制为完整合计。
- 优惠计算器：单价比价与按总折扣分摊实付；两个模式都保留无效行，金额以整数分分配并保持总数守恒。
- 图片处理：图片全程留在浏览器本地；支持文字水印（展示用/防盗用增强预设、随机错行平铺、可拖动或键盘定位的主体大水印、原尺寸或最长边 1920/1280/960 像素的分享副本）、单张裁切、单张打码和按目标体积或质量压缩。水印只能提高去除成本，无法保证阻止裁切或 AI 重绘；不可见水印禁止导出。隐私遮挡默认用不透明纯色，其他效果分别说明用途；原尺寸合成PNG并检查常见元数据。导入后校验 20 MB、8192 像素最长边和 1678 万总像素预算，页面使用低分辨率预览，最终从原图导出；水印和压缩支持带进度与取消的串行批处理，并可选择打包下载或单独下载。
- 二维码工具：把文本、链接、WiFi、名片、邮件、电话或短信生成二维码，可调颜色、尺寸和纠错级别，并下载 PNG / SVG 或复制图片；增加本地图片读码与生成自检，敏感结果默认遮盖。低对比时警告并可恢复黑白，不保证所有真机扫码成功。
- 正则表达式：正则测试、匹配结果查看、常用预设和测试文本生成；匹配与替换在可中断后台计算中运行并有输入/条数预算。手机上用中文短路径，高级设置可折叠；明确JavaScript引擎和flags，可本地导出规则与正反例测试集。

### 文本工具

- 文本转换：提供大小写、前后缀、排序、Base64、逐行 JSON 数组和保序去重等23种批量文本转换。
- 文本替换：批量字面替换与特殊字符解释，超预算保留原文；历史默认仅本次页面，主动勾选后才保存到本机。
- 文本分割：按行拆分文本；只保存紧凑行索引，按页生成50份结果，完整复制与下载保留原输入。
- 链接清理工具：移除追踪参数并保留其他查询原始编码、顺序和重复项；签名链接可复制原文回退，按50行分页，复制仍完整。历史只在本次页面。
- Markdown 编辑器：Markdown 编辑、实时预览和安全代码高亮；复制/导出等待当前完整文章，支持单独删除本机旧草稿。窄屏默认单面板，大屏保留双栏。
- 代码格式化：支持通用语言（文本 / 请求 Body），以及 JavaScript、TypeScript、HTML、CSS、JSON、Markdown 等格式化和高亮。
- 代码对比工具：对比两段代码或文本差异；旧补丁明确标注来源，后台超时和取消可恢复。

### 时间工具

- 万年历：公历、农历、节日、节气和月份视图；日期可用键盘选择，区分节日名称、休息与补班。
- 时间计算：日期加减、日期差、农历/公历转换和时间偏移计算；整数偏移与1900–2100范围明确校验，日历天与实际经过时间分开。两页都有工作日偏移/区间计数，可选周末和自定义例外；中国法定安排覆盖2025、2026，其他年份明确按周末与例外估算。
- 世界时间：两地实时时钟和时差说明，跨夏令时及返回页面同步更新偏移。

### 其他工具

- 汽车能耗成本：按百公里油耗或电耗和单价计算每公里、每百公里和行程花费，并可对比油车与电车；填写油箱容积或电池容量后估算续航。高级模式可计充电损耗、混合电价与年度固定费用，空白保持未知。默认不保存，勾选后才留在此设备。
- 轮胎选择器：通过胎宽、扁平比和轮毂尺寸选择，展示轮胎图形标识、规格解释和购买参考范围；自动联动解释原选择与调整原因，可比较原厂/任意候选尺寸、周长与理论车速；尺寸不保证适配，需核对车辆手册。
- 火星文转换：保护完整emoji与组合字符，默认仅转换，可主动选择随机装饰。
- 接口带宽计算：按接口预设容量和设备负载估算 TX/RX/PCIe，最多100条负载；未知设备能力独立提示并可填实际容量，结果是估算，不是兼容保证。

### 研发中工具

侧栏「研发中」入口受访问控制保护，未登录时显示为「敬请期待」。WiFi 二维码能力已并入正式「二维码工具」。

- 防息屏工具：保持设备屏幕常亮。
- DevTool1 / DevTool2：实验性工具入口。

### 信息页面

- 更新历史：版本更新记录。
- 关于：项目说明和相关信息。

## 技术实现

- 原生 HTML/CSS/JavaScript 实现。
- 主题样式通过 `css/theme.css` 共享，并由 `js/theme.js` 或 `js/theme-injector.js` 注入到各工具页。
- 第三方库来源：
  - Font Awesome 6.0.0：本地 `vendor/fontawesome/6.0.0/`（Icons CC BY 4.0，Fonts SIL OFL 1.1，Code MIT）。侧栏图标在 `file://` 离线打开时仍可用。
  - jsQR 1.4.0：本地 `vendor/jsqr/1.4.0/jsQR.js`（Apache-2.0），只在浏览器内解析图片。
  - qrcode 1.5.1：本地 `vendor/qrcode/1.5.1/qrcode.min.js`（MIT）。二维码生成、图片读码与自检不依赖网络。
  - Cropper.js 1.6.2、JSZip 3.10.1、Prettier 2.8.8、highlight.js 11.7.0 / 11.9.0、marked 12.0.1、jsdiff 5.1.0：cdnjs，钉死版本，带 SRI（`integrity`）和 `crossorigin="anonymous"`。
  - diff2html 3.4.56：jsDelivr，钉死版本，同样带 SRI 和 `crossorigin`。
  - 动态加载走 `js/lazy-script-core.js`：可选 `integrity`、CDN 主机白名单、超时失败。
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
│   ├── theme.css
│   └── workday.css
├── vendor/
│   ├── fontawesome/
│   ├── qrcode/
│   └── jsqr/
├── js/
│   ├── auth.js
│   ├── clipboard.js
│   ├── text-budget-core.js
│   ├── tool-catalog-core.js
│   ├── editor-task-core.js
│   ├── date-calculator-core.js
│   ├── china-holidays.js
│   ├── workday-core.js
│   ├── workday-page.js
│   ├── martian-text-core.js
│   ├── local-raster-core.js
│   ├── qrcode-decode-core.js
│   ├── regex-rule-kit.js
│   ├── calculator-core.js
│   ├── energy-cost-core.js
│   ├── deal-hunter-core.js
│   ├── theme.js
│   ├── theme-injector.js
│   ├── tire-selector-core.js
│   ├── transformer-core.js
│   ├── image-processor-core.js
│   ├── pretty-format-core.js
│   ├── lazy-script-core.js
│   ├── link-cleaner-core.js
│   ├── qrcode-core.js
│   ├── regex-tool.js
│   ├── regex-tool-core.js
│   ├── regex-tool-worker.js
│   └── version.js
├── items/
│   ├── Welcome.html
│   ├── Board.html
│   ├── Calculator.html
│   ├── DealHunter.html
│   ├── ImageProcessor.html
│   ├── QRCode.html
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
│   ├── EnergyCost.html
│   ├── TireSelector.html
│   ├── MartianText.html
│   ├── Bandwidth.html
│   ├── WifiQRCode.html
│   ├── Keeper.html
│   ├── DevTool1.html
│   ├── DevTool2.html
│   ├── History.html
│   └── About.html
├── ForDevelop/
│   ├── regression-tests/
│   │   ├── helpers/
│   │   └── run-all.mjs
│   ├── docs/superpowers/
│   ├── package.json
│   └── package-lock.json
├── USER_GUIDE.md
└── README.md
```

## 回归测试

网站本身无需安装依赖。开发检查使用 Node 22 或更新版本，专用依赖与锁文件放在 `ForDevelop/`；从仓库根目录执行：

```bash
npm --prefix ForDevelop ci
npm --prefix ForDevelop run browsers:install
node ForDevelop/regression-tests/run-all.mjs
```

默认执行全部功能回归，既有基线生成和可选性能测量不混入通过数。按需分层：

```bash
node ForDevelop/regression-tests/run-all.mjs --group=quick
node ForDevelop/regression-tests/run-all.mjs --group=browser
node ForDevelop/regression-tests/run-all.mjs --group=measure
node ForDevelop/regression-tests/qrcode-core.mjs
```

默认每项180秒超时，失败和超时会继续汇总其他测试，未选中项单独计数。可用 `--timeout-ms=240000`、`--output=ForDevelop/my-run`、`--list`。产物默认写新建 `ForDevelop/regression-tests/output/runs/<时间>-<进程>/`，不会覆盖既有基线。

浏览器回归优先使用设置的 `CHROME_PATH`，macOS存在系统Chrome时可直接使用，否则使用安装的Playwright Chromium。指定路径不存在会明确失败。开发依赖从ForDevelop解析，不需要根node_modules；更新依赖须同步锁文件并复核浏览器回归。

设置环境变量 `REGRESSION_USE_BUNDLED_BROWSER=1` 可强制使用已安装的Playwright Chromium。Linux若缺浏览器系统库，可执行 `npm --prefix ForDevelop run browsers:install-deps`，安装系统库可能需要管理员权限。

主题主键 `17tools-theme`，兼容旧 `theme`；父子页消息仍为 `17tools-theme`。较大功能设计与计划位于 `ForDevelop/docs/superpowers/`，开发产物不用于部署。
