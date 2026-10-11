/* 17Tools regex worker — classic script, loaded from js/regex-tool-worker.js */
importScripts('./regex-tool-core.js');

self.onmessage = function (event) {
    const msg = (event && event.data) || {};
    const requestId = msg.requestId;
    if (msg.type === 'ping') {
        self.postMessage({ type: 'ready', requestId: requestId });
        return;
    }
    if (msg.type !== 'run') {
        return;
    }
    try {
        const result = self.RegexToolCore.evaluateRegex(msg.payload || {});
        self.postMessage({ type: 'result', requestId: requestId, result: result });
    } catch (error) {
        self.postMessage({
            type: 'error',
            requestId: requestId,
            error: String(error && error.message ? error.message : error)
        });
    }
};
