/* 17Tools code-diff worker — classic script */
self.onmessage = function (event) {
    var msg = (event && event.data) || {};
    var requestId = msg.requestId;
    if (msg.type === 'ping') {
        self.postMessage({ type: 'ready', requestId: requestId });
        return;
    }
    if (msg.type === 'load') {
        try {
            var urls = Array.isArray(msg.urls) ? msg.urls : [];
            if (urls.length) {
                importScripts.apply(self, urls);
            }
            self.postMessage({ type: 'ready', requestId: requestId });
        } catch (error) {
            self.postMessage({
                type: 'error',
                requestId: requestId,
                error: String(error && error.message ? error.message : error)
            });
        }
        return;
    }
    if (msg.type !== 'diff') {
        return;
    }
    try {
        if (typeof Diff === 'undefined' || typeof Diff.createPatch !== 'function') {
            throw new Error('jsdiff 尚未加载');
        }
        var diff = Diff.createPatch(
            'file',
            String(msg.oldText || ''),
            String(msg.newText || ''),
            'Old',
            'New'
        );
        self.postMessage({ type: 'result', requestId: requestId, diff: diff });
    } catch (error) {
        self.postMessage({
            type: 'error',
            requestId: requestId,
            error: String(error && error.message ? error.message : error)
        });
    }
};
