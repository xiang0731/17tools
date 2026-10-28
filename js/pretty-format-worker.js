/* 17Tools pretty-format worker — classic script */
// Only these release-pinned local files may execute in this Worker.
var TRUSTED_DEPENDENCIES = Object.freeze(['../vendor/editors/prettier/2.8.8/standalone.js', '../vendor/editors/prettier/2.8.8/parser-babel.js', '../vendor/editors/prettier/2.8.8/parser-typescript.js', '../vendor/editors/prettier/2.8.8/parser-html.js', '../vendor/editors/prettier/2.8.8/parser-postcss.js', '../vendor/editors/prettier/2.8.8/parser-yaml.js', '../vendor/editors/prettier/2.8.8/parser-markdown.js', '../vendor/editors/prettier/2.8.8/parser-graphql.js']);

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
            if (urls.some(function (url) { return TRUSTED_DEPENDENCIES.indexOf(url) === -1; })) {
                throw new Error('拒绝未登记的后台依赖');
            }
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
    if (msg.type === 'process') {
        try {
            if (typeof PrettyFormatCore === 'undefined') importScripts('./pretty-format-core.js');
            var outcome = PrettyFormatCore.processCode(String(msg.code || ''), msg.language);
            self.postMessage({ type: 'result', requestId: requestId, outcome: outcome });
        } catch (error) {
            self.postMessage({ type: 'error', requestId: requestId, error: String(error.message || error) });
        }
        return;
    }
    if (msg.type === 'json') {
        try {
            if (typeof PrettyFormatCore === 'undefined' || typeof PrettyFormatCore.processCode !== 'function') {
                importScripts('./pretty-format-core.js');
            }
            var jsonResult = PrettyFormatCore.processCode(String(msg.code || ''), 'json');
            if (!jsonResult.ok) {
                throw new Error(jsonResult.error || '格式化失败，请检查代码语法');
            }
            self.postMessage({ type: 'result', requestId: requestId, output: jsonResult.output });
        } catch (error) {
            self.postMessage({
                type: 'error',
                requestId: requestId,
                error: String(error && error.message ? error.message : error)
            });
        }
        return;
    }
    if (msg.type !== 'format') {
        return;
    }
    try {
        if (typeof prettier === 'undefined' || typeof prettier.format !== 'function') {
            throw new Error('Prettier 尚未加载');
        }
        var output = prettier.format(String(msg.code || ''), {
            parser: msg.parser,
            plugins: typeof prettierPlugins !== 'undefined' ? prettierPlugins : msg.plugins,
            singleQuote: msg.singleQuote !== false,
            trailingComma: msg.trailingComma || 'es5',
            tabWidth: msg.tabWidth || 2,
            semi: msg.semi !== false,
            htmlWhitespaceSensitivity: msg.htmlWhitespaceSensitivity,
            proseWrap: msg.proseWrap
        });
        self.postMessage({ type: 'result', requestId: requestId, output: output });
    } catch (error) {
        self.postMessage({
            type: 'error',
            requestId: requestId,
            error: String(error && error.message ? error.message : error)
        });
    }
};
