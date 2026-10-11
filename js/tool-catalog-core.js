(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.ToolCatalog = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var TOOLS = [
        ['Board.html', '智能白板', '主要工具', '画画 绘图 手写 画板'],
        ['Calculator.html', '极速计算', '主要工具', '算式 求和 加减乘除 计算器'],
        ['DealHunter.html', '优惠计算器', '主要工具', '折扣 打折 比价 单价 分摊'],
        ['ImageProcessor.html', '图片处理', '主要工具', '压缩 裁切 裁剪 水印 打码 隐私遮挡'],
        ['QRCode.html', '二维码工具', '主要工具', 'WiFi 读码 扫码 名片 二维码 qrcode'],
        ['Regex.html', '正则表达式', '主要工具', '正则 匹配 regex 替换规则'],
        ['Transformer.html', '文本转换', '文本工具', 'JSON数组 去重 引号 排序 Base64 大小写'],
        ['Replacer.html', '文本替换', '文本工具', '批量替换 查找 替换文字'],
        ['Divider.html', '文本分割', '文本工具', '分行 分份 拆分文本 分段'],
        ['LinkCleaner.html', '链接清理', '文本工具', '去追踪 清理链接 URL utm 去参数'],
        ['Markdown.html', 'Markdown 编辑器', '文本工具', 'md 文章 排版 HTML导出'],
        ['PrettyFormat.html', '代码格式化', '文本工具', '缩进 美化 JSON格式化 prettier'],
        ['CodeDiff.html', '代码对比', '文本工具', 'diff 补丁 比较文本 差异'],
        ['Calendar.html', '万年历', '时间工具', '农历 公历 日历 节日 工作日 调休'],
        ['DateCalculator.html', '时间计算', '时间工具', '日期 天数 工作日 间隔 加几天'],
        ['WorldTime.html', '世界时间', '时间工具', '时区 世界时钟 时差 夏令时'],
        ['EnergyCost.html', '汽车能耗成本', '其他工具', '油费 电费 充电 养车 年度成本'],
        ['TireSelector.html', '轮胎选择器', '其他工具', '轮胎 胎宽 外径 车速 轮毂'],
        ['MartianText.html', '火星文转换', '其他工具', '火星文字 花字 随机装饰'],
        ['Bandwidth.html', '接口带宽计算', '其他工具', 'USB 雷电 PCIe 带宽 容量 超载']
    ].map(function (row) { return Object.freeze({ file: row[0], name: row[1], group: row[2], aliases: row[3].split(' '), public: true }); });
    Object.freeze(TOOLS);
    function get(file) { return TOOLS.find(function (tool) { return tool.file === file; }) || null; }
    function matches(file, query) {
        var tool = get(file);
        return !!tool && [tool.name].concat(tool.aliases).join(' ').toLocaleLowerCase('zh-CN').includes(String(query || '').trim().toLocaleLowerCase('zh-CN'));
    }
    function cleanIds(value, max) {
        var parsed;
        try { parsed = typeof value === 'string' ? JSON.parse(value) : value; } catch (error) { parsed = []; }
        if (!Array.isArray(parsed)) return [];
        return Array.from(new Set(parsed.filter(function (file) { return !!get(file); }))).slice(0, max);
    }
    function createPreferences(store) {
        var keys = { favorites: '17tools-favorites', recent: '17tools-recent-tools' };
        function read(key, max) { try { return cleanIds(store.getItem(key), max); } catch (error) { return []; } }
        var favorites = read(keys.favorites, 20), recent = read(keys.recent, 5);
        function save(key, ids) {
            try {
                var value = JSON.stringify(ids), result = store.setItem(key, value);
                return (!result || result.verified !== false) && store.getItem(key) === value;
            } catch (error) { return false; }
        }
        return {
            favorites: function () { return favorites.slice(); }, recent: function () { return recent.slice(); },
            toggle: function (file) {
                if (!get(file)) return { ok: false, persisted: false };
                var exists = favorites.includes(file);
                favorites = exists ? favorites.filter(function (id) { return id !== file; }) : favorites.concat(file);
                return { ok: true, favorite: !exists, persisted: save(keys.favorites, favorites) };
            },
            record: function (file) {
                if (!get(file)) return false;
                recent = [file].concat(recent.filter(function (id) { return id !== file; })).slice(0, 5);
                return save(keys.recent, recent);
            }
        };
    }
    return { TOOLS: TOOLS, get: get, matches: matches, cleanIds: cleanIds, createPreferences: createPreferences };
}));
