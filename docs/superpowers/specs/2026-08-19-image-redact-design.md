# 图片处理：打码功能设计

## 目标

在现有图片处理页增加「图片打码」标签：用户在单张图上用矩形或画笔标出多处区域，以马赛克、模糊、纯色或预设表情覆盖，可事后点选某块改效果，然后本地导出。图片不上传服务器。

## 非目标

- 批量打码（多张共用同一套区域）
- 人脸/车牌自动检测
- 椭圆、多边形、魔术棒
- 像素级橡皮擦（画错用撤销或删除整块）
- 任意 emoji 键盘或自定义上传贴图
- 斜线填充、噪点等额外效果
- 新的第三方库或服务端编解码

## 接入方式

仍使用 `items/ImageProcessor.html`，在现有三个标签后追加第四个：**图片打码**。顺序固定：

1. 添加水印
2. 图片裁切
3. 图片压缩
4. 图片打码

默认打开标签仍是「添加水印」。打码与其他标签互不共享文件列表、预览和导出状态。

同步更新：

- `items/History.html`：补丁版本 **2.16.3 → 2.16.4**，日期 `2026-08-19`，一条「新功能」
- `js/version.js` 失败回退版本号改为 `2.16.4`
- `items/Welcome.html` 版本展示改为 `v2.16.4`（工具数量仍为 19）
- `README.md` 图片处理条目补上打码
- `regression-tests/image-processor-page.mjs` 与 core 测试

主题与布局沿用现有标签：`css/theme.css` 变量；宽屏左侧预览、右侧参数；窄屏上下堆叠。不引入新 CDN 库。

## 页面结构

与裁切相同：只接受一张图。预览工具条为「选择图片」「重置」，无批量开关。已有图时，点击预览画布不再打开文件选择器（画布用于圈选）；「选择图片」始终可换图，换图后清空全部打码区域和撤销栈。

右侧参数自上而下：

1. 工具：矩形 / 画笔（分段按钮，与裁切比例按钮同一套样式）
2. 效果：马赛克 / 模糊 / 纯色 / 表情
3. 当前效果的参数（马赛克块大小 / 模糊强度 / 纯色 / 表情网格，见共同规则）
4. 画笔直径（仅画笔工具时显示，短边百分比）
5. 撤销、删除选中
6. 导出
7. 错误文案

无图或区域列表为空时，导出按钮禁用。

## 共同规则

输入、EXIF 校正、20 MB 上限、JPEG/PNG/WebP 限制，与现有标签相同。一次选多张时只取第一张并 toast「当前为单张模式，已使用第一张」。

导出文件名：`{stem}_redacted.{ext}`，由已有 `buildExportName` 生成。尽量保留原 MIME；JPEG / WebP 质量 0.92，PNG 无损。仅单张，不走 ZIP。

关闭页面后图片和区域都不保留。下列参数写入已有 `localStorage` 键 `17tools-image-processor` 的 `redact` 字段：

| 字段 | 默认 | 范围 |
| --- | --- | --- |
| mosaicSize | 16 | 8–64，图像像素 |
| blurStrength | 8 | 1–20 |
| solidColor | `#000000` | 颜色选择器 |
| emoji | `🫣` | 预设之一 |
| brushPercent | 4 | 1–12，相对图像短边 |

不持久化工具、选中项、区域列表。

## 单元划分

| 单元 | 职责 | 依赖 |
| --- | --- | --- |
| `js/image-processor-core.js` | 在现有模块上增加下列纯函数。无 DOM。 | 无 |
| `items/ImageProcessor.html` | 第四标签、指针交互、Canvas 合成、撤销、导出、主题 | core（Cropper.js / JSZip 本标签不用） |
| 导航/文档/回归 | 版本、说明、断言 | 无 |

Core 新增导出（名称固定，供页面和单测共用）：

| 函数 | 约定 |
| --- | --- |
| `clampRect(rect, width, height)` | 返回裁到画布内的 `{x,y,w,h}` 整数；完全在外或宽高 < 1 时返回 `null` |
| `computeMosaicCells(rect, mosaicSize)` | `mosaicSize` 先夹到 8–64；从左上步进，末格吃剩余 |
| `computeEmojiTiles(rect)` | 见「表情」；返回 `{x,y,size}[]` |
| `simplifyPoints(points, minDist)` | `minDist` 默认 1；相邻欧氏距离小于该值则丢掉后点，始终保留首尾 |
| `hitTestRect(rect, x, y)` | 含边 |
| `hitTestStroke(points, radius, x, y)` | 点到折线距离 ≤ radius |
| `brushRadiusFromPercent(minSide, percent)` | 直径 = `minSide * clamp(percent,1,12) / 100`，下限 4；返回直径的一半 |

## 区域模型

每块打码是一条记录，后添加的画在先添加的上面。最多 **50** 条，超出时 toast「最多 50 处打码」并忽略该笔。

```text
{
  id: string,
  kind: 'rect' | 'brush',
  x, y, w, h,          // 轴对齐包围盒，图像像素，整数
  points: [{x, y}] | null,  // 仅 brush，图像像素
  brushRadius: number | null, // 仅 brush，图像像素，直径的一半
  effect: 'mosaic' | 'blur' | 'solid' | 'emoji',
  mosaicSize: number,
  blurStrength: number,
  solidColor: string,
  emoji: string
}
```

矩形拖拽结束时用 core 把 `{x,y,w,h}` 裁到 `[0, width) × [0, height)`，宽高至少为 1。画笔点列落在画布外的点夹到边缘。

### 工具与点选

仅两个工具：**矩形**、**画笔**。没有独立「选择」工具。

指针坐标用 `canvas.getBoundingClientRect()` 换算到图像像素：`imageX = (clientX - left) * (canvas.width / cssWidth)`。

- **矩形**：在空白处按下并拖动，位移 ≥ 4 图像像素才生成新矩形；不足 4 像素视为点击。点击命中最上层区域则选中，未命中则取消选中。选中矩形后：拖内部移动；拖四角缩放（自由比例，松开时再裁剪到画布内）。拖动生成新矩形的过程中不切换选中。
- **画笔**：按下后按指针采样点列，圆头圆接（`lineCap` / `lineJoin` 为 `round`），直径 = `短边 * brushPercent / 100`，下限 4 像素。松开后提交一条 brush 记录并选中它。若按下时命中已有区域且几乎未移动（位移 < 4 像素），则改为选中该区域、不新建笔画。

新区域使用提交当下侧栏的效果和参数。提交后自动选中该区域。

点选命中：从上到下找第一条命中的记录。矩形：点在盒内（含边）。画笔：点到折线任一线段的最短距离 ≤ `brushRadius`（端点按圆盘计）。位移是否达到 4 像素用欧氏距离 `hypot(dx, dy)`。

选中态：预览上用 `var(--primary-color)` 描边。矩形画矩形框和四个角点；画笔沿点列描一条略粗于原笔画的轮廓。侧栏效果和参数同步为该记录的值。改效果或参数只写回当前选中记录。未选中时，侧栏表示「下一笔」将使用的值，并写入 `localStorage`。

选中矩形可拖可缩放；选中画笔只能删或改效果/参数，不能变形、不能平移。

### 撤销与删除

撤销栈保存区域列表的深拷贝，最多 40 步。下列操作在**结束后**压栈一次（不是每个 `pointermove`）：新建矩形/笔画、移动、缩放、删除、改效果、改参数。滑杆拖动期间不入栈，`pointerup` / `change` 时入一次。

「撤销」弹出栈顶，恢复上一份列表和选中 id（若该 id 已不存在则清空选中）。栈空时按钮禁用。不做重做。

「删除选中」去掉当前记录；无选中时按钮禁用。`Backspace` / `Delete` 在焦点不在输入/颜色控件时同样删除选中。`Escape` 取消选中。

「重置」清空该标签的图片、区域和撤销栈，与现有 `clearImages` 行为一致。

## 四种效果

合成顺序：清空画布 → 画原图 → 按列表顺序把每块打码画上去。后一块覆盖前一块的重叠部分；后一块的采样来自**当前画布**（已含先前打码），不是未经处理的原图。

区域蒙版：矩形即盒子本身；画笔是点列圆头描边形成的覆盖。实现上先把该效果画到与包围盒等大的临时画布，再用蒙版 `destination-in` 后画回主画布，避免矩形算法泄漏到笔画之外。

### 马赛克

Core `computeMosaicCells(rect, mosaicSize)`：从 `(rect.x, rect.y)` 起按 `mosaicSize` 步进，最后一格用剩余宽高（至少 1）。页面对每个格子 `getImageData` 求平均 RGB，`fillRect` 铺回。`mosaicSize` 在写入前夹到 8–64。

### 模糊

把蒙版内像素画到宽 `max(1, round(w / blurStrength))`、高 `max(1, round(h / blurStrength))` 的临时画布，再放大画回包围盒（`imageSmoothingEnabled = true`）。这是降采样盒模糊，强度 1 几乎原样，20 很糊。不做高斯卷积。

### 纯色

蒙版内填充 `solidColor`，不透明。

### 表情

预设固定为这 10 个，页面用按钮网格展示，不可输入其它字符：

`🫣 🙈 😀 ⭐ 🚫 💦 💩 ❤️ 🔥 ✅`

Core `computeEmojiTiles(rect)`：格子边长 `cellSize = clamp(min(rect.w, rect.h), 1, 64)`。从包围盒左上铺满完整格子，放不下的边缘不画半个（窄条因此只有一行）。每个格子居中绘制该 emoji 一字，字号 `cellSize * 0.82`，字体栈 `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`。画笔区域同样按包围盒铺格，再用笔画蒙版裁掉格子外的部分。

## 数据流

```text
用户选文件
  → validateFile + loadBitmap（与现有 ingestFiles 相同，single = true）
  → 预览原图，区域列表为空

指针
  → CSS 坐标 → 图像像素
  → 新建 / 点选 / 移动 / 缩放
  → 改区域列表 → 重绘预览

侧栏效果或参数变化
  → 有选中：写回该记录并重绘
  → 无选中：只更新「下一笔」默认值并 saveSettings

导出
  → 原图尺寸离屏 Canvas 按同样顺序合成（不画选中高亮）
  → toBlob 原 MIME → 下载 {stem}_redacted.{ext}
```

预览 Canvas 的内部宽高等于图像像素，CSS 限制为最大宽度 100%、最大高度 420px（与水印预览一致）。导出不使用 CSS 缩放后的尺寸。

Object URL 与 ImageBitmap 的释放沿用现有 `revokeItem` / `beforeunload`；打码标签加入同一清理路径。

## 异常处理

| 情况 | 行为 |
| --- | --- |
| 非 JPEG/PNG/WebP | 不加入，提示仅支持这三种 |
| 单文件 > 20 MB | 不加入，提示超限 |
| 一次多张 | 只取第一张，toast 说明 |
| 解码失败 | 提示无法读取，不进入列表 |
| 当前无图 | 导出禁用 |
| 有图但无打码区域 | 导出禁用 |
| 超过 50 处 | 不新增，toast |
| 矩形拖拽不足 4 像素 | 当作点击点选，不新建 |
| `toBlob` 失败 | 不下载，错误区「无法导出」 |
| Cropper.js / JSZip 加载失败 | 不影响本标签 |

错误文案显示在该标签导出按钮下方；换图或重置时清空。

## 测试

扩展 `regression-tests/image-processor-core.mjs`：

- `buildExportName(..., 'redacted', ...)` 含多点和中文名
- `clampRect`：部分在画外、完全在画外、零宽高
- `computeMosaicCells`：已知 100×80 矩形、块大小 30，格子数与最后一格尺寸
- `computeEmojiTiles`：窄条只铺一行；短边 > 64 时格子边长封顶 64
- `simplifyPoints`：过近的点被丢掉
- `hitTestRect` / `hitTestStroke`：在上、在外、贴边
- `brushRadiusFromPercent`：短边 1000、4% → 半径 20

扩展 `regression-tests/image-processor-page.mjs`：

- 存在 `data-tab="redact"` 与文案「图片打码」
- 四个效果按钮/选项与十个预设表情字符
- `id="rdClear"`、`id="rdExport"`、矩形/画笔工具
- `clearImages('redact')`、`bindDrop(..., 'redact')`
- History / Welcome / `version.js` 为 `2.16.4`
- 现有水印、裁切、压缩断言仍通过

页面手测（实现后核对，不强制自动化）：

- 四标签互不串图
- 深色/浅色
- 矩形多块 + 画笔，点选改效果
- 马赛克/模糊/纯色/表情预览与导出一致（导出无高亮框）
- 撤销、删除、重置、换图清空区域
- 已有图时点画布不会误开文件选择器

## 文件清单

修改：

- `items/ImageProcessor.html`
- `js/image-processor-core.js`
- `regression-tests/image-processor-core.mjs`
- `regression-tests/image-processor-page.mjs`
- `items/History.html`
- `items/Welcome.html`
- `js/version.js`
- `README.md`
