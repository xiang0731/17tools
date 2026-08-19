# 图片处理：全宽大预览布局设计

## 目标

图片处理四个标签（水印、裁切、压缩、打码）的预览区默认占满浏览器剩余高度，左右两栏横向铺满窗口（对齐优惠计算器），上传后的图按比例完整放大到预览框内，方便精细操作。只放大屏幕预览，不改变导出像素。

## 非目标

- 手动拖拽改变预览框尺寸
- 预览内滚轮缩放 / 拖拽平移（裁切仍使用 Cropper.js 自带缩放）
- 把预览框尺寸写入 `localStorage`
- 改水印/裁切/压缩/打码的处理算法、导出命名或文件规则
- 新第三方库
- 修改 `items/Welcome/` 下草稿欢迎页

## 问题

当前 `.page { max-width: 1280px }`，水印/压缩/打码预览 `max-height: 420px`，裁切容器固定 `480px`。窗口再大，图也被压在小框里。

## 布局

对照 `items/DealHunter.html`：

- `html, body`：`height: 100vh; width: 100%; overflow: hidden`（桌面）
- `.page`：纵向 flex，铺满视口，`padding: var(--spacing-lg)`，**去掉 `max-width: 1280px`**
- 标题与标签栏 `flex-shrink: 0`
- 当前 `.tab-panel.active`：`display: flex; flex-direction: column; flex: 1; min-height: 0`
- `.layout`：与优惠计算器 `.main-layout` 相同，`display: flex; flex: 1; gap: var(--spacing-lg); min-height: 0`
- `.preview-pane`：`flex: 1.2; min-width: 0`，内部纵向 flex
- `.control-pane`：`flex: 0.8; min-width: 260px; overflow-y: auto`
- 两栏合计吃满 `.page` 内容宽，左右不再留大块空白。比例保持现有约 1.2 : 0.8，不是均分。

窄屏（`max-width: 900px`）：两栏上下堆叠；`html, body` 改为可滚动（`height: auto; min-height: 100vh; overflow: auto`），预览框 `min-height: 50vh`，避免参数被 `overflow: hidden` 锁死。

## 预览框与图片自适应

四个 `#wmDrop` / `#cropDrop` / `#cpDrop` / `#rdDrop`：

- `flex: 1; min-height: 200px; width: 100%`
- 去掉 `#cropDrop.has-image` 的 `min-height: 480px`
- 去掉水印/压缩/打码的 `max-height: 420px`
- `#wmCanvas`、`#cpPreview`、`#rdCanvas` 显示时：`max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; margin: 0 auto`
- Canvas 内部仍按原图像素绘制（`canvas.width = item.width`），仅 CSS 缩放显示
- `#cropWrap` 改为 `width: 100%; height: 100%`（不再写死 480px）
- 空框提示文案与点击/拖拽上传行为不变

打码坐标已用 `getBoundingClientRect()` 换算，CSS 变大后仍对准。导出仍画原图像素。

## 裁切跟窗

Cropper 在容器从 `display: none` 切到可见、或窗口缩放时必须重算：

- 对 `#cropDrop` 使用 `ResizeObserver`，回调里调用已有 `cropper.resize()` 与 `fitCropperCanvas()`
- 切到「图片裁切」标签后 `requestAnimationFrame` 再跑一次同样的重算
- 无 Cropper 实例时回调直接返回

## 版本与文档

- 版本 **2.16.5**，日期 **2026-08-20**
- `items/History.html` 增加一条「逻辑改动与优化」：图片处理预览铺满窗口，上传图按比例放大
- `js/version.js` 失败回退改为 `2.16.5`
- `items/Welcome.html` 展示 `v2.16.5`，工具数仍为 19
- 回归：`regression-tests/image-processor-page.mjs`、`regression-tests/qrcode-page.mjs` 的当前版本断言升到 2.16.5，并锁住全宽布局与取消 420/480 死高度

## 测试

- 页面回归断言：无 `max-width: 1280px`、无 `max-height: 420px`、无裁切 `height: 480px`、存在 `height: 100vh`、`object-fit: contain`、`ResizeObserver`、`2.16.5`
- 手工：四标签空框与有图时预览随窗口变大；裁切框随窗口变化不崩；打码圈选仍对准；导出尺寸仍为原图
