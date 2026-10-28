(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.MarkdownPreviewCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const TIMEOUT_MS = 15000;
    const THEME_VAR_NAMES = Object.freeze([
        '--text-primary',
        '--text-secondary',
        '--background-primary',
        '--background-secondary',
        '--background-tertiary',
        '--border-color',
        '--border-light',
        '--primary-color',
        '--warning-color',
        '--font-family',
        '--radius-sm',
        '--radius-md'
    ]);

    const MESSAGES = Object.freeze({
        timeout: '预览超时，已中止本次计算。可以继续输入，或点击「渲染预览」。',
        cancelled: '已取消上一次预览',
        unavailable: '当前环境无法使用后台预览，已在页面内执行'
    });

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function tokenText(item) {
        if (item && typeof item === 'object' && item.text !== undefined) {
            return String(item.text == null ? '' : item.text);
        }
        return String(item == null ? '' : item);
    }

    function renderListItem(item) {
        let text = tokenText(item);
        const taskFromToken = !!(item && typeof item === 'object' && item.task);
        const checkedFromToken = !!(item && typeof item === 'object' && item.checked);
        const taskFromText = /^\s*\[[ xX]\]\s*/.test(text);
        const checkedFromText = /^\s*\[x\]\s*/i.test(text);
        const task = taskFromToken || taskFromText;
        const checked = checkedFromToken || checkedFromText;
        if (task) {
            text = text
                .replace(/^\s*<input\b[^>]*>\s*/i, '')
                .replace(/^\s*\[[ xX]\]\s*/, '');
            return '<li class="task-list-item"><input type="checkbox"' +
                (checked ? ' checked' : '') +
                ' disabled> ' + text + '</li>\n';
        }
        return '<li>' + text + '</li>\n';
    }

    function renderParagraph(item) {
        const text = tokenText(item).replace(/==([^=]+)==/g, '<mark>$1</mark>');
        return '<p>' + text + '</p>\n';
    }

    function createCodeRenderer(hljsLib) {
        // marked 12.0.1 uses positional code / infostring / escaped arguments.
        return function (code, infostring) {
            code = String(code == null ? '' : code);
            const lang = String(infostring || '').trim().split(/\s+/)[0];
            let content = escapeHtml(code);
            try {
                if (lang && hljsLib && typeof hljsLib.getLanguage === 'function' && hljsLib.getLanguage(lang)) {
                    content = hljsLib.highlight(code, { language: lang, ignoreIllegals: true }).value;
                }
            } catch (error) { /* retain escaped original */ }
            return '<pre><code class="hljs' + (lang ? ' language-' + escapeHtml(lang) : '') + '">' + content + '</code></pre>\n';
        };
    }

    function configureMarked(markedLib, hljsLib) {
        if (!markedLib || typeof markedLib.setOptions !== 'function') {
            throw new Error('marked 尚未加载');
        }
        const Renderer = markedLib.Renderer;
        const renderer = typeof Renderer === 'function' ? new Renderer() : {};
        renderer.listitem = renderListItem;
        renderer.paragraph = renderParagraph;
        renderer.code = createCodeRenderer(hljsLib);
        markedLib.setOptions({
            gfm: true,
            breaks: true,
            renderer: renderer
        });
        return renderer;
    }

    function enhanceParsedHtml(html) {
        return String(html || '').replace(
            /<li\b([^>]*)>(\s*<input\b[^>]*\btype=(["']?)checkbox\3[^>]*>)/gi,
            function (full, attrs, input) {
                if (/\btask-list-item\b/.test(attrs)) {
                    return full;
                }
                if (/\bclass\s*=/.test(attrs)) {
                    return '<li' + attrs.replace(/\bclass=(["'])([^"']*)\1/i, function (match, quote, cls) {
                        return 'class=' + quote + cls + ' task-list-item' + quote;
                    }) + '>' + input;
                }
                return '<li class="task-list-item"' + attrs + '>' + input;
            }
        );
    }

    function parseMarkdown(markedLib, markdown) {
        if (!markedLib || typeof markedLib.parse !== 'function') {
            throw new Error('marked 尚未加载');
        }
        return enhanceParsedHtml(markedLib.parse(String(markdown || '')));
    }

    function shouldIgnoreStaleResult(currentRequestId, resultRequestId) {
        return Number(currentRequestId) !== Number(resultRequestId);
    }

    function handleWorkerMessage(currentRequestId, message) {
        const msg = message && typeof message === 'object' ? message : {};
        if (shouldIgnoreStaleResult(currentRequestId, msg.requestId)) {
            return { ignore: true, kind: 'stale', html: '', error: '' };
        }
        if (msg.type === 'error') {
            return {
                ignore: false,
                kind: 'error',
                html: '',
                error: String(msg.error || 'Worker 失败')
            };
        }
        if (msg.type === 'ready') {
            return { ignore: false, kind: 'ready', html: '', error: '', warning: String(msg.warning || '') };
        }
        if (msg.type === 'result') {
            return {
                ignore: false,
                kind: 'result',
                html: String(msg.html || ''),
                error: ''
            };
        }
        return { ignore: true, kind: 'unknown', html: '', error: '' };
    }

    function disposeReason(reason) {
        if (reason === 'timeout') {
            return { kind: 'timeout', message: MESSAGES.timeout, apply: false };
        }
        return { kind: 'cancelled', message: MESSAGES.cancelled, apply: false };
    }

    function isEmbeddedImage(source) {
        return /^data:image\/(?:png|gif|jpe?g|webp);base64,/i.test(String(source || '').trim());
    }

    function createLoadRequest(requestId, urls) {
        return {
            type: 'load',
            requestId: requestId,
            urls: Array.isArray(urls) ? urls.slice() : []
        };
    }

    function createParseRequest(requestId, markdown) {
        return {
            type: 'parse',
            requestId: requestId,
            markdown: String(markdown || '')
        };
    }

    function readThemeVars(getter) {
        const vars = {};
        let i;
        for (i = 0; i < THEME_VAR_NAMES.length; i += 1) {
            const name = THEME_VAR_NAMES[i];
            vars[name] = String(typeof getter === 'function' ? getter(name) : '').trim();
        }
        return vars;
    }

    function rootCssFromVars(vars) {
        const map = vars && typeof vars === 'object' ? vars : {};
        const decls = [];
        let i;
        for (i = 0; i < THEME_VAR_NAMES.length; i += 1) {
            const name = THEME_VAR_NAMES[i];
            const value = String(map[name] || '').trim();
            if (value) {
                decls.push(name + ': ' + value);
            }
        }
        return ':root { ' + decls.join('; ') + (decls.length ? ';' : '') + ' }';
    }

    function highlightCss() {
        return [
            '.hljs { color: var(--text-primary); background: var(--background-secondary); }',
            '.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-name { color: var(--primary-color); font-weight: 600; }',
            '.hljs-string,.hljs-attr,.hljs-number,.hljs-symbol,.hljs-title { color: var(--text-primary); font-weight: 600; }',
            '.hljs-comment,.hljs-quote,.hljs-meta { color: var(--text-secondary); font-style: italic; }',
            '.hljs-addition { background: var(--background-tertiary); } .hljs-deletion { text-decoration: line-through; }'
        ].join('\n');
    }

    function exportDocumentCss() {
        return [
            'html, body { background: var(--background-primary); color: var(--text-primary); }',
            "body { max-width: 800px; margin: 40px auto; padding: 0 20px; font-family: var(--font-family); line-height: 1.8; }",
            'h1,h2,h3,h4,h5,h6 { margin-top: 1.2em; margin-bottom: 0.4em; }',
            'h1 { border-bottom: 2px solid var(--border-color); padding-bottom: 0.3em; }',
            'h2 { border-bottom: 1px solid var(--border-color); padding-bottom: 0.2em; }',
            'code { background: var(--border-light); padding: 2px 6px; border-radius: var(--radius-sm); font-size: 0.9em; }',
            'pre { background: var(--background-secondary); padding: 16px; border-radius: var(--radius-md); overflow-x: auto; border: 1px solid var(--border-color); }',
            'pre code { background: none; padding: 0; }',
            highlightCss(),
            'blockquote { border-left: 4px solid var(--primary-color); padding: 8px 16px; margin: 1em 0; background: var(--background-secondary); color: var(--text-secondary); }',
            'table { border-collapse: collapse; width: 100%; margin: 1em 0; }',
            'th, td { padding: 10px 14px; border: 1px solid var(--border-color); text-align: left; }',
            'th { background: var(--background-secondary); font-weight: 600; }',
            'img { max-width: 100%; height: auto; }',
            'a { color: var(--primary-color); }',
            'mark { background: color-mix(in srgb, var(--warning-color) 25%, transparent); padding: 1px 4px; border-radius: 2px; }',
            'hr { border: none; border-top: 2px solid var(--border-color); margin: 1.5em 0; }',
            '.task-list-item { list-style: none; }',
            '.task-list-item input[type="checkbox"] { margin-right: 6px; accent-color: var(--primary-color); }'
        ].join('\n');
    }

    function buildExportDocument(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const theme = opts.theme === 'dark' ? 'dark' : 'light';
        const vars = readThemeVars(function (name) {
            return opts.vars && opts.vars[name];
        });
        const title = escapeHtml(opts.title || '');
        const bodyHtml = String(opts.bodyHtml || '');
        return '<!DOCTYPE html>\n'
            + '<html lang="zh" data-theme="' + theme + '">\n'
            + '<head>\n'
            + '<meta charset="UTF-8">\n'
            + '<meta name="referrer" content="no-referrer">\n'
            + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
            + '<title>' + title + '</title>\n'
            + '<style>\n'
            + rootCssFromVars(vars) + '\n'
            + exportDocumentCss() + '\n'
            + '</style>\n'
            + '</head>\n'
            + '<body>\n'
            + bodyHtml + '\n'
            + '</body>\n'
            + '</html>';
    }

    return {
        TIMEOUT_MS: TIMEOUT_MS,
        THEME_VAR_NAMES: THEME_VAR_NAMES,
        MESSAGES: MESSAGES,
        escapeHtml: escapeHtml,
        renderListItem: renderListItem,
        renderParagraph: renderParagraph,
        enhanceParsedHtml: enhanceParsedHtml,
        configureMarked: configureMarked,
        parseMarkdown: parseMarkdown,
        shouldIgnoreStaleResult: shouldIgnoreStaleResult,
        handleWorkerMessage: handleWorkerMessage,
        disposeReason: disposeReason,
        isEmbeddedImage: isEmbeddedImage,
        createLoadRequest: createLoadRequest,
        createParseRequest: createParseRequest,
        readThemeVars: readThemeVars,
        buildExportDocument: buildExportDocument,
        highlightCss: highlightCss
    };
}));
