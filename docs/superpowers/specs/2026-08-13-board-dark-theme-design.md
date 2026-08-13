# 智能白板黑暗模式设计

## 目标

让智能白板跟随 17Tools 全局主题。黑暗模式下工具栏、状态栏和画布一起变暗；切换主题时反相已有笔迹；导出 PNG 时由用户选择浅色或深色合成。

## 非目标

- 不把白板接到 `js/theme.js` / `js/theme-injector.js`
- 不改主页面 `index.html` 的主题协议（仍发送 `17tools-theme`）
- 不把画布改成矢量笔迹；仍是 Canvas 像素
- 不在切主题时新增一条撤销记录
- 不给 JSON 保存/加载做主题转换（存当前像素和当前笔色）
- 不把画布做成「永远白纸」（那是已否决的方案 1）

## 改动范围

| 文件 | 作用 |
| --- | --- |
| `items/Board.html` | 主题同步、笔迹反相、导出选项 |
| `regression-tests/board-theme.mjs` | 新增，锁住协议与反相/导出约定 |
| `items/History.html` | 新次版本 `2.15.2` 一条记录 |
| `js/version.js`、`items/Welcome.html` | 失败回退 / 展示版本改为 `2.15.2` |

## 主题同步

改动只在 `items/Board.html`，对齐 `items/Markdown.html` 已验证的通道。

### 单一入口 `applyTheme(theme)`

`theme` 只能是 `'light'` 或 `'dark'`。非法值当作 `'light'`。

行为：

1. 若与当前已应用主题相同，直接返回（避免 iframe `load` 与 `postMessage` 各来一次时把笔迹反相两次）。
2. 记下旧主题，给 `<html>` 设置 `data-theme`。
3. 若 `window.whiteboard` 已存在且旧主题有效，调用 `whiteboard.handleThemeChange(theme)`（内部做像素反相和笔色反相）。
4. 启动时第一次 `applyTheme` 发生在 `WhiteBoard` 构造之前：只改 `data-theme`，不反相。构造函数按当前主题选默认笔色（深色 `#ffffff`，浅色 `#000000`）。

### 主题来源（全部进入 `applyTheme`）

| 通道 | 作用 |
| --- | --- |
| 启动 `detectTheme()` | 先读父页面 `data-theme`；读不到再读 `localStorage.theme`；再不行用 `light`。访问父页面必须包在 try/catch，父窗口不是 Node 时当作读不到。 |
| `postMessage` 类型 `17tools-theme` | 主通道，与 `index.html`、Markdown 一致。删除对 `theme-change` 的监听。 |
| 监听自身 `data-theme` | 兜底：父页面同源时直接 `setAttribute`。 |
| 监听父页面 `data-theme` | 兜底：同源时父页面切换也能跟上。 |

现有 `[data-theme="dark"]` CSS 变量保持不变：工具栏、状态栏、画布底（`--background-primary`）和点阵（`--border-color`）一起变暗。画布元素仍是透明的，底下 CSS 背景负责纸色。

## 笔迹反相

白板存的是像素。切主题时对非透明像素做 RGB 反相，不重绘矢量。

### 像素规则

对当前画布 backing store（`canvas.width` × `canvas.height`，含 DPR）执行 `getImageData`：

- `alpha === 0`：跳过（橡皮擦挖空处继续透出主题背景）
- `alpha > 0`：`r/g/b = 255 - r/g/b`，alpha 不变（抗锯齿边缘只反相颜色）

然后 `putImageData`。空画布无可见变化。

### 笔色规则

当前笔色和三个备用色用同一套 6 位十六进制反相，例如 `#000000` ↔ `#ffffff`，`#ff0000` ↔ `#00ffff`。同步颜色选择器和备用色色块。不再使用「仅当笔色是纯黑或纯白才切换」的旧逻辑。

启动时不反相备用色；只有主题真正从一种切到另一种时才反相。

### 不进撤销栈

切主题反相当前画布，不调用 `saveState()`。

若当时正在绘制（`isDrawing === true`），先按 pointerup 的路径结束当前一笔（`stopDrawing`，这一笔会进撤销栈），再反相。反相本身仍不进撤销栈。正在画时切主题不会丢掉当前路径，也不会把「切换主题」当成一步撤销。

### 历史与槽位

内存中的历史从纯 data URL 字符串改为：

```text
{ dataUrl: string, theme: 'light' | 'dark' }
```

三个槽位的 `snapshot` 同样带 `theme`。`saveState` / `switchSlot` 写入时，`theme` 为当时的 `data-theme`。

`restoreState`：画出 `dataUrl` 后，若条目的 `theme` 与当前 `data-theme` 不同，再对画布做一次像素反相。这样撤销、重做、切槽位后的笔迹始终匹配当前主题。

同一次会话内不需要兼容旧的纯字符串历史（页面刷新即清空）。JSON 文件格式不变，仍只存当前画布 data URL 和 `settings`，加载后按像素原样绘制，不按文件主题反相。

## 导出 PNG

点击「导出图片」不再立刻下载。在该按钮下方弹出两个选项：

- 导出浅色图片
- 导出深色图片

当前主题对应的那一项为默认（视觉上标为选中/主按钮）。点击页面其他处或按 Escape 关闭弹层，不导出。再次点击导出按钮则切换弹层开关。选中一项后关闭弹层并下载。

### 合成（离屏，不改当前画布）

1. 把当前画布拷到离屏 canvas。
2. 若导出主题 ≠ 当前 `data-theme`，对离屏副本做与上面相同的像素反相。
3. 再做一张同尺寸画布：先铺满底色，再把离屏笔迹画上去。
   - 浅色：底 `#ffffff`
   - 深色：底 `#111827`（与深色 `--background-primary` 一致）
4. 下载 `whiteboard_{timestamp}.png`（文件名规则与现在相同，不加 `_light` / `_dark` 后缀）。

## 单元划分

| 单元 | 职责 | 依赖 |
| --- | --- | --- |
| 主题同步函数 | `detectTheme`、`applyTheme`、四条通道 | DOM / parent / postMessage |
| `WhiteBoard.handleThemeChange` | 像素反相、笔色反相、更新橡皮擦光标 | Canvas 2D |
| `WhiteBoard.invertPixels` | 对指定 canvas 做 RGB 反相 | Canvas 2D |
| `WhiteBoard.exportImage` | 弹层 + 离屏合成 + 下载 | Canvas 2D |
| 历史条目 `{ dataUrl, theme }` | 撤销/槽位与当前主题对齐 | `restoreState` |

`invertPixels` 只做像素变换，不读主题、不改笔色，便于测试约定写进页面源码断言。

## 测试

新增 `regression-tests/board-theme.mjs`，读取 `items/Board.html` 做源码断言（与 `image-processor-page.mjs` 同类，不跑真实浏览器）：

- 监听 `17tools-theme`，源码中不再出现作为 message type 的 `theme-change`
- 存在 `applyTheme` 与 `detectTheme`，且会读父页面 `data-theme` 和 `localStorage.theme`
- 切主题走像素反相：`255 -` 以及 `alpha === 0` 跳过
- 历史快照带 `theme` 字段；`restoreState` 在主题不一致时再反相
- 导出有浅色 / 深色两个选项；合成在离屏 canvas；浅色底 `#ffffff`，深色底 `#111827`
- 不再包含「仅当颜色是 `#000000` 或 `#ffffff` 才改笔色」的旧分支

手工冒烟（实现后在主站 iframe 中点一遍）：

1. 主站切深色 → 白板工具栏、画布、默认笔立刻变深/变白。
2. 浅色下画黑线 + 红线，切深色 → 黑变白、红变青；再切回浅色 → 恢复。
3. 撤销 / 切槽位 1–3 后，笔迹仍和当前主题一致。
4. 深色下导出浅色 PNG：白底黑/红线；浅色下导出深色 PNG：深底白/青线。
5. 正在画的时候切主题不打断，也不多出一条撤销。
