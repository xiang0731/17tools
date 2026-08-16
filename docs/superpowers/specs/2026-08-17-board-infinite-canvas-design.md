# 智能白板无限画布设计

## 目标

把智能白板做成可向外延伸的像素画布：右键拖动平移视野，Ctrl+滚轮缩放，顶部工具栏提供缩放和复位。移出窗口的笔迹保留，可在原窗口外继续画。JSON 和 PNG 都包含全部已绘制区域。

## 非目标

- 不改成矢量笔迹；仍是 Canvas 像素
- 不做中键拖动、空格拖动、双指平移
- 不改主题同步协议（仍用 `17tools-theme` 与像素反相）
- 不把 PNG 导出改成「只导出当前窗口」
- 不在平移或缩放时写入撤销栈
- 不为导出体积设硬上限（极大包围盒若失败，由浏览器报错）

## 改动范围

| 文件 | 作用 |
| --- | --- |
| `js/board-world.js` | 新增。相机、分块、屏幕↔世界坐标的纯函数，供页面和单测共用 |
| `items/Board.html` | 分块绘制、右键平移、顶部缩放/复位、JSON/PNG/清空/槽位 |
| `regression-tests/board-world.mjs` | 新增。锁住坐标与分块算术 |
| `regression-tests/board-infinite-page.mjs` | 新增。锁住页面交互与保存/导出约定 |
| `regression-tests/board-theme.mjs` | 按新历史/导出结构更新仍有效的主题断言 |
| `items/History.html`、`js/version.js`、`items/Welcome.html` | 新次版本一条记录（实现时取当时最新版本的下一档） |
| `README.md` | 白板能力补上平移与无限画布 |

## 交互

### 平移

在画布容器上按住鼠标右键拖动，视野跟随拖动。禁止浏览器右键菜单（`contextmenu` 的 `preventDefault`）。左键仍只用于绘画（现有 `e.which !== 1` 判断保留）。

屏幕位移 `(dx, dy)` 换算成世界位移 `(-dx / scale, -dy / scale)`，使笔迹跟着光标走。平移只改相机，不调用 `saveState()`。点阵背景的 `background-position` / `background-size` 随相机移动和缩放，格子对齐世界坐标。

状态栏坐标显示世界坐标（取整）。

### 缩放

滚轮缩放只认 **Ctrl+滚轮**。不再用 Shift+滚轮。容器上 Ctrl+滚轮必须 `preventDefault`，避免浏览器缩放页面。`Ctrl++` / `Ctrl+−` / `Ctrl+0` 保留：前两个改缩放，`Ctrl+0` 只把缩放设为 100%，不改平移。

缩放范围仍是 50%–300%，步进 10%。缩放和平移共用同一套相机。

### 顶部工具栏

在撤销/清空那一组之后新增一组，顺序为：

`[ − ]  100%  [ + ]  [ 复位 ]`

| 控件 | `id` | 行为 |
| --- | --- | --- |
| `−` | `zoom-out` | 缩放 −10%，受 50%–300% 限制 |
| 百分比 | `zoom-percent` | 显示当前缩放；点击后只把缩放设为 100%，不改平移 |
| `+` | `zoom-in` | 缩放 +10%，受 50%–300% 限制 |
| 复位 | `reset-view` | 只把平移拉回原点 `(0, 0)`，缩放不变 |

底部 `#reset-zoom` 去掉点击重置（可保留只读百分比 `#zoom-level`，与顶部同步）。右侧提示改为「Ctrl+滚轮缩放 · 右键拖动平移」。

## 世界模型

### 相机

```text
{ offsetX, offsetY, scale }
```

打开白板时为 `{ offsetX: 0, offsetY: 0, scale: 1 }`。`(0, 0)` 是此时窗口左上角对应的世界原点。

屏幕与世界（CSS 像素）：

```text
screenX = (worldX - offsetX) * scale
screenY = (worldY - offsetY) * scale
```

反向：

```text
worldX = screenX / scale + offsetX
worldY = screenY / scale + offsetY
```

这些换算放在 `js/board-world.js`（与 `image-processor-core.js` 相同的 UMD 包装，全局名 `BoardWorld`），页面只传相机和尺寸，不在 HTML 里重写公式。常量 `TILE_SIZE = 1024` 也从该模块导出。

### 分块

世界按 **1024×1024 CSS 像素** 切成块。块索引允许负数。世界点 `(x, y)` 落到 `floor(x / 1024), floor(y / 1024)`。块的键为 `"tx,ty"`（例如 `"0,0"`、`"-1,2"`）。

块按需创建：只有笔画、橡皮、形状或载入内容真正写到某块时才分配。纯平移经过空白区域不创建块。

每块是一张离屏 canvas，backing store 为 `1024 * dpr` 见方，与显示层使用相同的 `devicePixelRatio`。显示层仍是窗口大小的 `#drawingCanvas`：每次重绘时清空，把视野内的块 `drawImage` 到对应屏幕位置。

笔画、橡皮、形状写到世界块上（跨块时写所有碰到的块）。形状工具的实时预览画在显示层；落笔结束再写入块并 `saveState()`。

窗口改变大小只改显示层尺寸并重绘，已有块不动。

### 撤销 / 主题 / 槽位

撤销仍最多 20 步。每步为：

```text
{ tiles: { "tx,ty": dataUrl, ... }, theme: 'light' | 'dark' }
```

没改过的块与上一步共用同一份 `dataUrl` 字符串（写时复制引用，避免整图复制）。平移、缩放、复位不进栈。

切主题时对所有已有块做现有 `invertPixels`（`alpha === 0` 跳过，其余 RGB 反相），再刷新显示层。反相本身不进撤销栈。若正在绘制，先 `stopDrawing`（这一笔进栈），再反相。笔色反相规则不变。

`restoreState`：按条目的 `tiles` 重建离屏块并重绘显示层；若 `theme` 与当前 `data-theme` 不同，对块再反相一次（与现逻辑一致，只是作用对象从单张画布换成所有块）。撤销/重做只恢复块，不恢复相机。

三个临时槽位各存：`tiles`、`camera`、`history`、`index`。切槽位时保存并恢复视野。

## 保存与导出

### JSON

新文件 `version` 为 `'1.2'`，结构：

```text
{
  version: '1.2',
  timestamp: ISO string,
  tileSize: 1024,
  tiles: { "tx,ty": dataUrl, ... },
  camera: { offsetX, offsetY, scale },
  settings: { strokeColor, colorHistory, brushSize }
}
```

不再写旧字段 `canvas`。打开后恢复全部块和当时的相机。

旧文件（`version` `'1.1'` 或带 `canvas`、无 `tiles`）：把那张图从世界原点 `(0, 0)` 铺到块上（图比 1024 大则拆到多块），相机设为 `{ offsetX: 0, offsetY: 0, scale: 1 }`，再读 `settings`。加载图片文件（PNG/JPG）时，把图贴到**当前视野**左上角对应的世界位置（用户看见图出现在窗口里）。

### PNG

仍先弹出「导出浅色图片 / 导出深色图片」，合成规则与现在相同：

1. 离屏拼出笔迹；若导出主题 ≠ 当前主题，对笔迹做 `invertPixels`
2. 再铺底色：浅色 `#ffffff`，深色 `#111827`
3. 下载 `whiteboard_{timestamp}.png`

有笔迹时，导出范围为所有块中非透明像素的轴对齐包围盒（世界 CSS 像素）。两坨离得远的笔迹之间的空白包含在内。包围盒相对世界原点可以是任意位置，不强制从 `(0, 0)` 起。离屏 canvas 的像素宽高为包围盒 × `devicePixelRatio`（与当前显示层一致）。

空画布（没有任何非透明像素）时：用户选定导出主题后，用 `confirm` 提示「当前画布是空的，确定仍要导出？」。确定则导出一张与**当前窗口 CSS 尺寸**等大的纯底色图（像素尺寸同样 × `devicePixelRatio`）；取消则不下载。

### 清空

现有「确定要清空画布吗？此操作不可撤销。」确认保留。确认后：

1. 删除所有块并清空显示层
2. 相机设为 `{ offsetX: 0, offsetY: 0, scale: 1 }`
3. 更新顶部/底部缩放显示为 100%
4. `saveState()` 写入清空后的一步（与现在清空后进栈一致）

## 单元划分

| 单元 | 职责 | 依赖 |
| --- | --- | --- |
| `js/board-world.js` | 屏幕↔世界、块索引/键、可见块范围、平移位移换算 | 无 DOM |
| `WhiteBoard` 相机与重绘 | 持有 `offsetX/offsetY/scale` 与块 Map，复合显示层、同步点阵和缩放 UI | `board-world.js`、Canvas 2D |
| 右键平移 / Ctrl+滚轮 | 改相机并重绘，不进撤销 | 相机 |
| 顶部缩放与复位 | `−` `+` 百分比 复位；百分比只重置缩放 | 相机 |
| `saveState` / `restoreState` | 按块快照（引用共用）与主题对齐 | 块 Map |
| JSON 1.2 | 读写 `tiles` + `camera`；旧 `canvas` 铺到原点 | 块 Map |
| `exportImageWithTheme` | 内容包围盒或空画布确认后按窗口导出 | 块 Map、`invertPixels` |
| `clearCanvas` | 清块 + 重置相机 + 进栈 | 块 Map、相机 |

`board-world.js` 不读写 DOM、不碰 canvas 像素，便于 Node 单测。

## 测试

### `regression-tests/board-world.mjs`

直接调用 `js/board-world.js`：

- `scale = 1` 时屏幕原点对应 `offset`；`scale = 2` 时屏幕位移 10 等于世界位移 5
- 世界 `(-1, -1)` 落到块 `(-1, -1)`，不落到 `(0, 0)`
- 块键 `"tx,ty"` 可逆
- 视野 `(0,0)` 尺寸 `800×600`、块 1024 时可见块含 `0,0`；平移到 `(-100, -100)` 后还含 `-1,-1`

### `regression-tests/board-infinite-page.mjs`

读取 `items/Board.html` 做源码断言：

- 引入 `../js/board-world.js`
- 监听 `contextmenu` 并 `preventDefault`
- 滚轮缩放判断为 `ctrlKey`，源码中缩放路径不再用 `shiftKey`
- 存在 `id="zoom-out"`、`id="zoom-percent"`、`id="zoom-in"`、`id="reset-view"`
- 状态栏提示含「Ctrl+滚轮缩放」和「右键拖动平移」
- JSON `version` 为 `'1.2'`，写入 `tiles` 与 `camera`；`saveToLocal` 不再写 `canvas:` 字段
- 加载路径同时接受 `data.tiles` 与旧 `data.canvas`
- 空画布导出走 `confirm`，文案含「空」
- `clearCanvas` 在确认后把 `offsetX`/`offsetY` 归零且 `scale` 为 1

### `regression-tests/board-theme.mjs`

按块快照更新仍必须成立的约定：`invertPixels`、浅/深导出底色、`17tools-theme`。历史条目从 `dataUrl` 改为 `tiles` 的断言一并改掉。

手工冒烟：

1. 左键画画，右键拖到窗外再画，复位后原笔迹仍在原点，新笔迹在窗外。
2. Ctrl+滚轮缩放，点顶部百分比回到 100%，视野位置不变；点复位只回原点，缩放不变。
3. Shift+滚轮不再缩放。
4. 清空后视野回到原点且 100%，再确认一次空画布导出弹确认框。
5. 保存 JSON，刷新后打开：笔迹和视野都在。打开旧版只有 `canvas` 的 JSON：图画在原点，视野在原点 100%。
6. 有笔迹时导出 PNG 覆盖全部墨迹；切主题后笔迹反相，槽位切换恢复对应视野。
