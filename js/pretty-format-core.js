(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.PrettyFormatCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function normalizePlainText(value) {
        const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');

        while (lines.length && lines[0].trim() === '') {
            lines.shift();
        }
        while (lines.length && lines[lines.length - 1].trim() === '') {
            lines.pop();
        }

        return lines.map((line) => line.replace(/[ \t]+$/g, '')).join('\n');
    }

    function formatJson(value) {
        return JSON.stringify(JSON.parse(String(value ?? '')), null, 2);
    }

    function formatGenericText(value) {
        const normalized = normalizePlainText(value);
        if (!normalized) return '';

        try {
            return formatJson(normalized);
        } catch (error) {
            return normalized;
        }
    }

    function looksLikeJson(value) {
        const code = String(value ?? '').trim();
        return (code.startsWith('{') && code.endsWith('}')) || (code.startsWith('[') && code.endsWith(']'));
    }

    function isKnownLanguage(language) {
        return KNOWN_LANGUAGES.indexOf(String(language || '')) !== -1;
    }

    function parsePreference(raw) {
        if (raw == null || raw === '') {
            return { language: 'auto' };
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && isKnownLanguage(parsed.language)) {
                return { language: parsed.language };
            }
        } catch (error) {
            /* 损坏或非 JSON 时走下方纯字符串回退 */
        }
        if (isKnownLanguage(raw)) {
            return { language: String(raw) };
        }
        return { language: 'auto' };
    }

    function serializePreference(pref) {
        const language = pref && isKnownLanguage(pref.language) ? pref.language : 'auto';
        return JSON.stringify({ language: language });
    }

    const FORMAT_LANGUAGES = Object.freeze([
        'babel', 'typescript', 'html', 'css', 'json', 'yaml', 'markdown', 'graphql'
    ]);
    const STORAGE_KEY = '17tools-prettyformat';
    const KNOWN_LANGUAGES = Object.freeze([
        'auto',
        'generic',
        'babel',
        'typescript',
        'html',
        'css',
        'json',
        'yaml',
        'markdown',
        'graphql',
        'php-highlight',
        'python-highlight',
        'java-highlight',
        'ruby-highlight',
        'go-highlight',
        'swift-highlight',
        'csharp-highlight',
        'cpp-highlight',
        'rust-highlight',
        'shell-highlight',
        'sql-highlight'
    ]);
    const PRETTIER_VERSION = '2.8.8';
    const HIGHLIGHT_VERSION = '11.7.0';
    const PRETTIER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/prettier/' + PRETTIER_VERSION;
    const HIGHLIGHT_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/' + HIGHLIGHT_VERSION;
    const PRETTIER_SRI = Object.freeze({
        'standalone.js': 'sha512-6CmYrGjyq2oxBGJ2S+foHLVexl2EbevOSGYSkITDKg1BliTkQSRgWH1M1KuA8grdRpV4k7COBf/ZO0j2y4lf3g==',
        'parser-babel.js': 'sha512-MNHrbW8Uz16VtO3XPAHbhdwlvPNU7IbNeKEt3Z3PtbspwWtcUvx68GC9NYCeqnC2bNYMANg45W5o68pZsFWPRA==',
        'parser-typescript.js': 'sha512-wTdWFr3uMGx0a0v8+50Cyr6GTr1KwJf1/q7IqlDdpOgm50ndgGR/8bOwc76/g01KlrF0BgyuadBxKGZL5N0ByQ==',
        'parser-html.js': 'sha512-2bZycb/wlWHOzvxh1ycky2/CXiw5xloxBNbjE9Hq4RV6Kpivwp2Kx1V4CpMEZSAhOIjRtjIf24zhI3WzI3lxkg==',
        'parser-postcss.js': 'sha512-E2R9e85w+oZZKIGZ/zSKs5KwEIPq2NT//jLO67RfDf2uu90Im9rZ8xXorEf5WHZFXJNrmq7HG+Zl9UoO+GhDOw==',
        'parser-yaml.js': 'sha512-ALiwzthsjepNM+urTVfcfcWnNiLIIs0NIJeZpB6+p448VgadcJQWENJGbSUVCPVitorJ3Qn2KbBZMf8nXJq8pw==',
        'parser-markdown.js': 'sha512-+3wrTjpi2RG6xEs6DwdrjMX6idsbGgmVuCBkP+WeS2xaTvjrC3RVXAFTVJ/ZegYzhmioy/82fSL4WcTitKHZ1A==',
        'parser-graphql.js': 'sha512-PRKFWXCYGiT/P9ddrTqyPOOLwVepgFJWSApvt4RuvgfjVcQ9GfJg1FavYqcv0BrsPDprMZe0QmCck/SGrXY3lw=='
    });
    const HIGHLIGHT_SRI = Object.freeze({
        script: 'sha512-bgHRAiTjGrzHzLyKOnpFvaEpGzJet3z4tZnXGjpsCcqOnAH6VGUx9frc5bcIhKTVLEiCO6vEhNAgx5jtLUYrfA==',
        style: 'sha512-0aPQyyeZrWj9sCA46UlmWgKOP0mUipLQ6OZXu8l4IcAmD2u31EPEy9VcIMvl7SoAaKe8bLXZhYoMaE/in+gcgA=='
    });
    const PRETTIER_PARSER_FILES = Object.freeze({
        babel: Object.freeze(['standalone.js', 'parser-babel.js']),
        typescript: Object.freeze(['standalone.js', 'parser-typescript.js']),
        html: Object.freeze(['standalone.js', 'parser-html.js']),
        css: Object.freeze(['standalone.js', 'parser-postcss.js']),
        yaml: Object.freeze(['standalone.js', 'parser-yaml.js']),
        markdown: Object.freeze(['standalone.js', 'parser-markdown.js']),
        graphql: Object.freeze(['standalone.js', 'parser-graphql.js'])
    });

    function prettierResourcesForLanguage(language) {
        const files = PRETTIER_PARSER_FILES[String(language || '')];
        if (!files) {
            return [];
        }
        return files.map(function (file) {
            return {
                url: PRETTIER_CDN + '/' + file,
                integrity: PRETTIER_SRI[file] || ''
            };
        });
    }

    function prettierUrlsForLanguage(language) {
        return prettierResourcesForLanguage(language).map(function (item) {
            return item.url;
        });
    }

    function highlightAssets() {
        return {
            script: HIGHLIGHT_CDN + '/highlight.min.js',
            style: HIGHLIGHT_CDN + '/styles/github.min.css',
            scriptIntegrity: HIGHLIGHT_SRI.script,
            styleIntegrity: HIGHLIGHT_SRI.style
        };
    }

    function classifyLanguage(language) {
        const lang = String(language || '');
        if (lang === 'generic') return 'generic';
        if (FORMAT_LANGUAGES.includes(lang)) return 'format';
        return 'highlight';
    }

    function isEmptyInput(raw, mode) {
        if (mode === 'highlight') return String(raw ?? '') === '';
        return String(raw ?? '').trim() === '';
    }

    function recoverRawInput(domValue, pendingPasteRaw) {
        const visible = String(domValue ?? '');
        if (pendingPasteRaw == null) return visible;
        const normalize = (value) => String(value).replace(/\r\n?/g, '\n');
        if (normalize(pendingPasteRaw) === normalize(visible)) {
            return String(pendingPasteRaw);
        }
        return visible;
    }

    function processCode(raw, language, formatter) {
        const mode = classifyLanguage(language);
        const input = String(raw ?? '');

        if (isEmptyInput(input, mode)) {
            return {
                ok: false,
                mode: mode,
                status: 'empty',
                output: '',
                error: '请输入要格式化的代码'
            };
        }

        if (mode === 'highlight') {
            return { ok: true, mode: mode, status: 'valid', output: input, error: '' };
        }

        if (mode === 'generic') {
            return {
                ok: true,
                mode: mode,
                status: 'valid',
                output: formatGenericText(input),
                error: ''
            };
        }

        if (String(language) === 'json') {
            try {
                return {
                    ok: true,
                    mode: mode,
                    status: 'valid',
                    output: formatJson(input),
                    error: ''
                };
            } catch (error) {
                return {
                    ok: false,
                    mode: mode,
                    status: 'failed',
                    output: '',
                    error: error && error.message ? error.message : String(error)
                };
            }
        }

        try {
            if (typeof formatter !== 'function') {
                throw new Error('缺少格式化器');
            }
            const output = formatter(input, language);
            return {
                ok: true,
                mode: mode,
                status: 'valid',
                output: String(output ?? ''),
                error: ''
            };
        } catch (error) {
            return {
                ok: false,
                mode: mode,
                status: 'failed',
                output: '',
                error: error && error.message ? error.message : String(error)
            };
        }
    }

    function applyProcessOutcome(state, outcome) {
        const prev = state && typeof state === 'object' ? state : {};
        if (outcome && outcome.ok) {
            return {
                input: prev.input,
                lastValid: outcome.output,
                displayed: outcome.output,
                status: 'valid',
                error: ''
            };
        }
        if (outcome && outcome.status === 'empty') {
            return {
                input: prev.input,
                lastValid: null,
                displayed: '',
                status: 'empty',
                error: outcome.error || ''
            };
        }
        return {
            input: prev.input,
            lastValid: prev.lastValid != null ? prev.lastValid : null,
            displayed: prev.lastValid != null ? prev.lastValid : '',
            status: 'failed',
            error: (outcome && outcome.error) || '格式化失败，请检查代码语法'
        };
    }

    function nextInputState(state, nextInput, language) {
        const prev = state && typeof state === 'object' ? state : {};
        const input = String(nextInput ?? '');
        const mode = classifyLanguage(language);
        if (isEmptyInput(input, mode)) {
            return {
                input: input,
                lastValid: null,
                displayed: '',
                status: 'empty',
                error: ''
            };
        }
        const hasResult = prev.lastValid != null || prev.status === 'valid' || prev.status === 'failed';
        return {
            input: input,
            lastValid: prev.lastValid != null ? prev.lastValid : null,
            displayed: prev.lastValid != null ? prev.lastValid : (prev.displayed || ''),
            status: hasResult ? 'stale' : (prev.status || 'empty'),
            error: prev.error || ''
        };
    }

    return {
        FORMAT_LANGUAGES,
        STORAGE_KEY,
        KNOWN_LANGUAGES,
        PRETTIER_VERSION,
        HIGHLIGHT_VERSION,
        PRETTIER_CDN,
        HIGHLIGHT_CDN,
        PRETTIER_SRI,
        HIGHLIGHT_SRI,
        prettierResourcesForLanguage,
        prettierUrlsForLanguage,
        highlightAssets,
        formatJson,
        formatGenericText,
        looksLikeJson,
        isKnownLanguage,
        parsePreference,
        serializePreference,
        normalizePlainText,
        classifyLanguage,
        isEmptyInput,
        recoverRawInput,
        processCode,
        applyProcessOutcome,
        nextInputState
    };
}));
