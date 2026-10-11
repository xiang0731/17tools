(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./text-budget-core.js'));
    } else {
        root.LinkCleanerCore = factory(root.TextBudgetCore);
    }
})(typeof window !== 'undefined' ? window : globalThis, function (budget) {
    'use strict';

    const MAX_HISTORY = 50;

    const LINE_STATUS = Object.freeze({
        CLEANED: 'cleaned',
        INVALID: 'invalid',
        ALREADY_CLEAN: 'already-clean'
    });

    const LINE_STATUS_LABELS = Object.freeze({
        cleaned: '已清理',
        invalid: '无法解析',
        'already-clean': '本来就干净'
    });

    const MESSAGES = Object.freeze({
        emptyInput: '请输入需要清理的链接',
        clipboardDenied: '无法读取剪贴板，请手动粘贴',
        nothingToCopy: '没有可复制的有效链接',
        copied: '已复制干净链接',
        copiedValid: '已复制有效链接',
        copiedKeepInvalid: '已复制，无效行保留占位',
        copyFailed: '复制失败，请手动复制'
    });

    const INVALID_LINE_PREFIX = '[无法解析] ';

    // 登记与输入匹配使用同一规则：参数名不区分大小写，其余字节不改写。
    function normalizeParamName(value) {
        return String(value == null ? '' : value).toLowerCase();
    }

    // 仅保留含义明确、移除后不会改变页面内容的追踪参数。
    // q、variant、app、from、ref 等可能承载业务状态，不在全局规则中删除。
    const TRACKING_PARAMS = new Set([
        // Google Analytics & Ads
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',

        // Facebook
        'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',

        // Twitter
        'twclid', 'ref_src', 'ref_url',

        // LinkedIn
        'li_fat_id', 'trk', 'trkCampaign',

        // TikTok
        'ttclid',

        // Microsoft/Bing
        'msclkid',

        // Email tracking
        'mc_cid', 'mc_eid', 'mkt_tok',

        // 明确的分析/分享追踪参数
        '_ga', '_gl', 'igshid', 'ved', 'usg',

        // Shopify 列表来源信息（保留决定商品规格的 variant）
        '_pos', '_sid', '_ss',

        // Other common tracking parameters
        'spm', 'scm', 'share_medium', 'share_source',
        'vn_medium', 'vn_campaign', 'vn_source', 'vn_term', 'vn_content'
    ].map(normalizeParamName));

    const AMAZON_HOST_PATTERN = /(^|\.)amazon\.[a-z]{2,3}(\.[a-z]{2})?$/i;

    function statusLabel(status) {
        return LINE_STATUS_LABELS[status] || LINE_STATUS_LABELS.invalid;
    }

    function isYouTubeHost(hostname) {
        const host = String(hostname || '').toLowerCase();
        return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
    }

    function isPlausibleHost(hostname) {
        if (!hostname) {
            return false;
        }
        const host = String(hostname).replace(/^\[|\]$/g, '').toLowerCase();
        if (host === 'localhost') {
            return true;
        }
        return host.indexOf('.') !== -1;
    }

    function isTrackingParameter(paramName, hostname) {
        const name = normalizeParamName(paramName);
        const host = String(hostname || '');

        if (name.indexOf('utm_') === 0 || TRACKING_PARAMS.has(name)) {
            return true;
        }

        // 这些名称过于通用，只能在确定的站点上按追踪参数处理。
        if (AMAZON_HOST_PATTERN.test(host) &&
            (name === 'tag' || name === 'ref' || name === 'ref_' || name.indexOf('pf_rd_') === 0)) {
            return true;
        }

        if (isYouTubeHost(host) && (name === 'feature' || name === 'si')) {
            return true;
        }

        return false;
    }

    function parseHttpUrl(raw) {
        const text = String(raw || '').trim();
        if (!text || /\s/.test(text)) {
            return null;
        }

        let parsed;
        let inferredScheme = false;

        try {
            parsed = new URL(text);
        } catch (error) {
            inferredScheme = true;
            try {
                parsed = text.indexOf('//') === 0
                    ? new URL('https:' + text)
                    : new URL('https://' + text);
            } catch (retryError) {
                return null;
            }
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }

        if (inferredScheme && !isPlausibleHost(parsed.hostname)) {
            return null;
        }

        return parsed;
    }

    function cleanSingleLink(raw) {
        const original = String(raw == null ? '' : raw).trim();
        if (!original) {
            return {
                original: original,
                url: original,
                removed: [],
                status: LINE_STATUS.INVALID,
                statusLabel: statusLabel(LINE_STATUS.INVALID)
            };
        }

        const urlObj = parseHttpUrl(original);
        if (!urlObj) {
            return {
                original: original,
                url: original,
                removed: [],
                status: LINE_STATUS.INVALID,
                statusLabel: statusLabel(LINE_STATUS.INVALID)
            };
        }

        const removed = [];
        // Validate with URL, but do not reserialize untouched query bytes.
        const hashAt = original.indexOf('#');
        const fragment = hashAt < 0 ? '' : original.slice(hashAt);
        const head = hashAt < 0 ? original : original.slice(0, hashAt);
        const queryAt = head.indexOf('?');
        const prefix = queryAt < 0 ? head : head.slice(0, queryAt);
        const segments = queryAt < 0 ? [] : head.slice(queryAt + 1).split('&');
        let signed = false;
        const kept = segments.filter(function (segment) {
            const key = new URLSearchParams(segment).keys().next().value || '';
            if (/^(sig|signature|token|x-amz-signature|x-goog-signature|access_token)$/i.test(key)) signed = true;
            if (!isTrackingParameter(key, urlObj.hostname)) return true;
            removed.push(key);
            return false;
        });

        if (removed.length === 0) {
            return {
                original: original,
                url: original,
                removed: [],
                status: LINE_STATUS.ALREADY_CLEAN,
                statusLabel: statusLabel(LINE_STATUS.ALREADY_CLEAN)
            };
        }

        let outputPrefix = prefix;
        if (prefix.indexOf('//') === 0) outputPrefix = 'https:' + prefix;
        else if (!/^https?:/i.test(prefix)) outputPrefix = 'https://' + prefix;
        else if (!/^https?:\/\//i.test(prefix)) outputPrefix = urlObj.origin + urlObj.pathname;
        return {
            original: original,
            url: outputPrefix + (kept.length ? '?' + kept.join('&') : '') + fragment,
            removed: removed,
            signed: signed,
            warning: signed ? '含签名或令牌，清理可能影响访问；可复制原链接回退' : '',
            status: LINE_STATUS.CLEANED,
            statusLabel: statusLabel(LINE_STATUS.CLEANED)
        };
    }

    function splitLines(text) {
        return String(text || '')
            .split(/\r\n|\r|\n/)
            .map(function (line) {
                return line.trim();
            })
            .filter(function (line) {
                return line.length > 0;
            });
    }

    function formatLineSummary(total, valid, skipped) {
        return '原始 ' + total + ' 行，有效 ' + valid + ' 行，跳过 ' + skipped + ' 行';
    }

    function formatValidCopyNote(valid, skipped) {
        return '将复制 ' + valid + ' 行，跳过 ' + skipped + ' 行';
    }

    function formatKeepInvalidCopyNote(total, skipped) {
        return '将复制 ' + total + ' 行，其中 ' + skipped + ' 行保留无效占位';
    }

    function formatInvalidPlaceholder(original) {
        return INVALID_LINE_PREFIX + String(original == null ? '' : original);
    }

    function copyTextValidOnly(lines) {
        return lines
            .filter(function (line) {
                return line.status !== LINE_STATUS.INVALID;
            })
            .map(function (line) {
                return line.url;
            })
            .join('\n');
    }

    function copyTextKeepInvalid(lines) {
        return lines
            .map(function (line) {
                if (line.status === LINE_STATUS.INVALID) {
                    return formatInvalidPlaceholder(line.original);
                }
                return line.url;
            })
            .join('\n');
    }

    function cleanInput(text) {
        if (budget) budget.assert(text, 0, 2000);
        const lines = splitLines(text).map(cleanSingleLink);
        const removedParams = [];
        let cleanedLinks = 0;
        let alreadyCleanLinks = 0;
        let invalidLinks = 0;

        lines.forEach(function (line) {
            if (line.status === LINE_STATUS.CLEANED) {
                cleanedLinks += 1;
                removedParams.push.apply(removedParams, line.removed);
            } else if (line.status === LINE_STATUS.ALREADY_CLEAN) {
                alreadyCleanLinks += 1;
            } else {
                invalidLinks += 1;
            }
        });

        const total = lines.length;
        const valid = cleanedLinks + alreadyCleanLinks;
        const skipped = invalidLinks;

        return {
            empty: lines.length === 0,
            lines: lines,
            copyText: copyTextValidOnly(lines),
            copyTextKeepInvalid: copyTextKeepInvalid(lines),
            summary: formatLineSummary(total, valid, skipped),
            validCopyNote: formatValidCopyNote(valid, skipped),
            keepCopyNote: formatKeepInvalidCopyNote(total, skipped),
            stats: {
                totalLinks: total,
                cleanedLinks: cleanedLinks,
                alreadyCleanLinks: alreadyCleanLinks,
                invalidLinks: invalidLinks,
                validLinks: valid,
                skippedLinks: skipped,
                removedParams: removedParams
            }
        };
    }

    function historyItemFromLine(line, timestamp) {
        if (!line || line.status !== LINE_STATUS.CLEANED) {
            return null;
        }
        return {
            original: line.original,
            cleaned: line.url,
            timestamp: timestamp || '',
            removedParams: line.removed.slice()
        };
    }

    function appendHistory(history, items, maxItems) {
        const limit = Number.isFinite(maxItems) && maxItems > 0 ? Math.floor(maxItems) : MAX_HISTORY;
        const previous = Array.isArray(history) ? history.slice() : [];
        const incoming = Array.isArray(items)
            ? items.filter(function (item) {
                return item && typeof item === 'object';
            })
            : [];
        return incoming.concat(previous).slice(0, limit);
    }

    return {
        MAX_HISTORY: MAX_HISTORY,
        LINE_STATUS: LINE_STATUS,
        LINE_STATUS_LABELS: LINE_STATUS_LABELS,
        INVALID_LINE_PREFIX: INVALID_LINE_PREFIX,
        MESSAGES: MESSAGES,
        formatLineSummary: formatLineSummary,
        formatValidCopyNote: formatValidCopyNote,
        formatKeepInvalidCopyNote: formatKeepInvalidCopyNote,
        formatInvalidPlaceholder: formatInvalidPlaceholder,
        TRACKING_PARAMS: TRACKING_PARAMS,
        normalizeParamName: normalizeParamName,
        isTrackingParameter: isTrackingParameter,
        parseHttpUrl: parseHttpUrl,
        cleanSingleLink: cleanSingleLink,
        splitLines: splitLines,
        cleanInput: cleanInput,
        historyItemFromLine: historyItemFromLine,
        appendHistory: appendHistory
    };
});
