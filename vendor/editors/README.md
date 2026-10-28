# 编辑器固定依赖

仅用于 R02 的三个编辑器，保留原固定版本，不构成整站离线承诺。主线程与 Worker 复用相同文件；Worker 只加载源码登记的本站路径，不接受消息提供的任意 URL。信任边界是本站发布文件。

版本与许可证：Prettier 2.8.8（MIT）、highlight.js 11.7.0 / 11.9.0（BSD-3-Clause）、marked 12.0.1（MIT）、jsdiff 5.1.0（BSD-3-Clause）、diff2html 3.4.56（MIT）。各版本目录保留上游 LICENSE；diff2html bundle 中第三方声明按其原始内容保留。

manifest.json 记录每个文件原始下载 URL、字节数、SHA-256 和 SHA-512 SRI。下载文件不改写。HTTP(S) 主线程保留 SRI；file:// 本地文件加载省略跨源 SRI，仍只引用固定本地文件。Worker 使用本地白名单，无 CDN 回退。
