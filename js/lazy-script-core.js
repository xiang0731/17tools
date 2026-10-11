(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.LazyScriptCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var DEFAULT_ALLOWED_HOSTS = Object.freeze([
        'cdnjs.cloudflare.com',
        'cdn.jsdelivr.net'
    ]);
    var DEFAULT_TIMEOUT_MS = 15000;

    function isHttpUrl(url) {
        return /^https?:\/\//i.test(String(url || ''));
    }

    function hostnameOf(url) {
        try {
            return new URL(String(url || '')).hostname.toLowerCase();
        } catch (error) {
            return '';
        }
    }

    function isAllowedHost(url, allowedHosts) {
        var href = String(url || '');
        if (!href) {
            return false;
        }
        if (!isHttpUrl(href)) {
            return true;
        }
        var host = hostnameOf(href);
        var hosts = Array.isArray(allowedHosts) ? allowedHosts : DEFAULT_ALLOWED_HOSTS;
        for (var i = 0; i < hosts.length; i += 1) {
            if (String(hosts[i] || '').toLowerCase() === host) {
                return true;
            }
        }
        return false;
    }

    function normalizeResource(spec) {
        if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
            return {
                url: String(spec.url || ''),
                integrity: spec.integrity ? String(spec.integrity) : '',
                timeout: spec.timeout,
                crossOrigin: spec.crossOrigin
            };
        }
        return {
            url: String(spec || ''),
            integrity: '',
            timeout: undefined,
            crossOrigin: undefined
        };
    }

    function createResourceLoader(env) {
        var host = env && typeof env === 'object' ? env : {};
        var doc = host.document || (typeof document !== 'undefined' ? document : null);
        var allowedHosts = Array.isArray(host.allowedHosts)
            ? host.allowedHosts.slice()
            : DEFAULT_ALLOWED_HOSTS.slice();
        var defaultTimeoutMs = host.timeoutMs == null ? DEFAULT_TIMEOUT_MS : Number(host.timeoutMs);
        var schedule = typeof host.setTimeout === 'function'
            ? host.setTimeout
            : (typeof setTimeout === 'function' ? setTimeout : function (fn) { fn(); });
        var cancel = typeof host.clearTimeout === 'function'
            ? host.clearTimeout
            : (typeof clearTimeout === 'function' ? clearTimeout : function () {});
        var scriptCache = new Map();
        var styleCache = new Map();
        var loadedScripts = new Set();
        var loadedStyles = new Set();
        var requested = [];

        function record(url) {
            requested.push(String(url));
        }

        function loadWithTag(kind, spec, cache, loadedSet) {
            var resource = normalizeResource(spec);
            var href = resource.url;
            if (!href) {
                return Promise.reject(new Error('缺少资源地址'));
            }
            if (!isAllowedHost(href, allowedHosts)) {
                return Promise.reject(new Error('不允许的资源主机: ' + href));
            }
            if (loadedSet.has(href)) {
                return Promise.resolve({ url: href, status: 'cached', kind: kind });
            }
            if (cache.has(href)) {
                return cache.get(href);
            }
            if (!doc || typeof doc.createElement !== 'function') {
                return Promise.reject(new Error('当前环境无法加载资源'));
            }

            record(href);
            var pending = new Promise(function (resolve, reject) {
                var el = doc.createElement(kind === 'style' ? 'link' : 'script');
                var settled = false;
                var timer = null;
                var timeoutMs = resource.timeout == null ? defaultTimeoutMs : Number(resource.timeout);

                function finishTimer() {
                    if (timer != null) {
                        cancel(timer);
                        timer = null;
                    }
                }

                function fail(message) {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    finishTimer();
                    el.onload = null;
                    el.onerror = null;
                    cache.delete(href);
                    if (el.parentNode) {
                        el.parentNode.removeChild(el);
                    }
                    reject(new Error(message));
                }

                if (kind === 'style') {
                    el.rel = 'stylesheet';
                    el.href = href;
                } else {
                    el.src = href;
                    el.async = false;
                }
                if (resource.integrity) {
                    el.integrity = resource.integrity;
                    el.setAttribute('integrity', resource.integrity);
                    var crossOrigin = resource.crossOrigin || 'anonymous';
                    el.crossOrigin = crossOrigin;
                    el.setAttribute('crossorigin', crossOrigin);
                }
                el.setAttribute('data-lazy-src', href);
                el.onload = function () {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    finishTimer();
                    loadedSet.add(href);
                    cache.delete(href);
                    resolve({ url: href, status: 'loaded', kind: kind });
                };
                el.onerror = function () {
                    fail('加载失败: ' + href);
                };
                if (timeoutMs > 0) {
                    timer = schedule(function () {
                        fail('加载超时: ' + href);
                    }, timeoutMs);
                }
                (doc.head || doc.documentElement).appendChild(el);
            });
            cache.set(href, pending);
            return pending;
        }

        function loadScript(url) {
            return loadWithTag('script', url, scriptCache, loadedScripts);
        }

        function loadStyle(url) {
            return loadWithTag('style', url, styleCache, loadedStyles);
        }

        function loadSequential(urls) {
            var list = Array.isArray(urls) ? urls.slice() : [];
            var chain = Promise.resolve([]);
            list.forEach(function (url) {
                chain = chain.then(function (acc) {
                    return loadScript(url).then(function (result) {
                        acc.push(result);
                        return acc;
                    });
                });
            });
            return chain;
        }

        return {
            loadScript: loadScript,
            loadStyle: loadStyle,
            loadSequential: loadSequential,
            isScriptLoaded: function (url) { return loadedScripts.has(String(url)); },
            isStyleLoaded: function (url) { return loadedStyles.has(String(url)); },
            requestedUrls: function () { return requested.slice(); },
            loadedScriptUrls: function () { return Array.from(loadedScripts); }
        };
    }

    return {
        DEFAULT_ALLOWED_HOSTS: DEFAULT_ALLOWED_HOSTS,
        DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
        isHttpUrl: isHttpUrl,
        isAllowedHost: isAllowedHost,
        createResourceLoader: createResourceLoader
    };
}));
