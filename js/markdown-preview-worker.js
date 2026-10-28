/* 17Tools markdown preview worker — classic script */
importScripts('./markdown-preview-core.js');

// Only these release-pinned local files may execute in this Worker.
var TRUSTED_DEPENDENCIES = Object.freeze(['../vendor/editors/marked/12.0.1/marked.min.js', '../vendor/editors/highlight.js/11.9.0/highlight.min.js']);

self.onmessage = function (event) {
    var msg = (event && event.data) || {};
    var requestId = msg.requestId;
    var core = self.MarkdownPreviewCore;
    if (msg.type === 'ping') {
        self.postMessage({ type: 'ready', requestId: requestId });
        return;
    }
    if (msg.type === 'load') {
        try {
            var urls = Array.isArray(msg.urls) ? msg.urls : [];
            if (urls.some(function (url) { return TRUSTED_DEPENDENCIES.indexOf(url) === -1; })) {
                throw new Error('拒绝未登记的后台依赖');
            }
            if (urls.length !== TRUSTED_DEPENDENCIES.length || urls.some(function (url, index) { return url !== TRUSTED_DEPENDENCIES[index]; })) throw new Error('后台依赖清单不完整');
            var warning = '';
            if (urls.length) importScripts(urls[0]);
            if (urls.length > 1) try { importScripts.apply(self, urls.slice(1)); }
            catch (error) { warning = '高亮库加载失败，代码将安全显示为普通文本'; }
            if (typeof marked === 'undefined' || typeof marked.parse !== 'function') {
                throw new Error('marked 尚未加载');
            }
            core.configureMarked(marked, typeof hljs !== 'undefined' ? hljs : null);
            self.postMessage({ type: 'ready', requestId: requestId, warning: warning });
        } catch (error) {
            self.postMessage({
                type: 'error',
                requestId: requestId,
                error: String(error && error.message ? error.message : error)
            });
        }
        return;
    }
    if (msg.type !== 'parse') {
        return;
    }
    try {
        var html = core.parseMarkdown(typeof marked !== 'undefined' ? marked : null, msg.markdown);
        self.postMessage({ type: 'result', requestId: requestId, html: html });
    } catch (error) {
        self.postMessage({
            type: 'error',
            requestId: requestId,
            error: String(error && error.message ? error.message : error)
        });
    }
};
