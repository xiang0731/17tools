(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.BandwidthBudgetCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var MAX_LOADS = 100;

    function finiteCount(count) {
        var current = Number(count);
        if (!Number.isFinite(current) || current < 0) return null;
        return current;
    }

    function canAddLoad(count) {
        var current = finiteCount(count);
        return current !== null && current < MAX_LOADS;
    }

    function shouldRenderLoads(count) {
        var current = finiteCount(count);
        return current !== null && current <= MAX_LOADS;
    }

    function loadLimitMessage() {
        return '最多 100 条负载，请先删除再添加';
    }

    function attemptAddLoad(count) {
        var current = finiteCount(count);
        if (current === null) current = 0;
        if (!canAddLoad(current)) {
            return {
                accepted: false,
                nextCount: current,
                render: false,
                reason: loadLimitMessage()
            };
        }
        var nextCount = current + 1;
        return {
            accepted: true,
            nextCount: nextCount,
            render: shouldRenderLoads(nextCount),
            reason: ''
        };
    }

    function capability(value, manual) {
        const raw = manual == null ? '' : String(manual).trim();
        if (raw) {
            const number = Number(raw);
            if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw) || !Number.isFinite(number) || number < 0 || number > 1000000) {
                return { state: 'unknown', capacity: null, source: 'manual-invalid', message: '手动容量请填写 0–1000000 Gbps；0 表示已确认不支持' };
            }
            return { state: number === 0 ? 'unsupported' : 'supported', capacity: number, source: 'manual', message: '手动填写，请以设备手册或实测为依据' };
        }
        if (value == null || !Number.isFinite(Number(value)) || Number(value) < 0) {
            return { state: 'unknown', capacity: null, source: 'device', message: '需核对设备，PCIe 隧道非通用保证' };
        }
        const capacity = Number(value);
        return { state: capacity === 0 ? 'unsupported' : 'supported', capacity: capacity, source: 'standard', message: capacity === 0 ? '明确不支持' : '页面固定表' };
    }

    function getUsageStatus(used, info) {
        const cap = info && typeof info === 'object' ? info : capability(info);
        if (!Number.isFinite(used) || used < 0 || cap.source === 'manual-invalid') return 'invalid';
        if (cap.state === 'unknown') return used > 0 ? 'unknown' : 'ok';
        if (cap.state === 'unsupported') return used > 0 ? 'danger' : 'ok';
        const ratio = used / cap.capacity;
        if (ratio > 1) return 'danger';
        return ratio >= 0.9 ? 'warn' : 'ok';
    }

    function getOverallStatus(statuses) {
        if (statuses.includes('invalid')) return 'invalid';
        if (statuses.includes('danger')) return 'danger';
        if (statuses.includes('unknown')) return 'unknown';
        if (statuses.includes('warn')) return 'warn';
        return 'ok';
    }

    function totalLoads(loads) {
        const list = Array.isArray(loads) ? loads : [];
        if (list.length > MAX_LOADS) return { error: loadLimitMessage() };
        const totals = { tx: 0, rx: 0, pcie: 0, displayTx: 0, error: '' };
        for (const load of list) {
            const bandwidth = Number(load.bandwidth);
            if (!Number.isFinite(bandwidth) || bandwidth < 0) return { error: '负载带宽必须是有限的非负数字' };
            if (load.direction === 'tx' || load.direction === 'both') totals.tx += bandwidth;
            if (load.direction === 'rx' || load.direction === 'both') totals.rx += bandwidth;
            if (load.category === 'pcie') totals.pcie += bandwidth;
            if (load.category === 'display' && (load.direction === 'tx' || load.direction === 'both')) totals.displayTx += bandwidth;
        }
        if (Object.values(totals).some(value => typeof value === 'number' && !Number.isFinite(value))) return { error: '负载合计超过可计算范围' };
        return totals;
    }

    // 容量与预设带宽来自页面固定表，文件里没有单独的认证日期。
    var RESULT_ASSUMPTIONS = {
        source: '容量和设备带宽来自页面内固定表，没有单独的认证日期。',
        units: '单位是 Gbps。',
        overhead: '显示器估算含页面已有的开销 1.2，用来覆盖消隐、编码和协议损耗；不同显示协议实际值会有差异。',
        excluded: '不含线材、扩展坞、主机控制器和真实测量。',
        check: '建议核对设备实测，以手册或实测为准。'
    };

    function getResultAssumptions() {
        return {
            source: RESULT_ASSUMPTIONS.source,
            units: RESULT_ASSUMPTIONS.units,
            overhead: RESULT_ASSUMPTIONS.overhead,
            excluded: RESULT_ASSUMPTIONS.excluded,
            check: RESULT_ASSUMPTIONS.check
        };
    }

    function assumptionLines(assumptions) {
        return [
            assumptions.source,
            assumptions.units,
            assumptions.overhead,
            assumptions.excluded,
            assumptions.check
        ];
    }

    function buildResultCopy(input) {
        var data = input || {};
        var assumptions = getResultAssumptions();
        var loads = Array.isArray(data.loads) ? data.loads : [];
        var lines = [
            '参数',
            '接口：' + String(data.interfaceName == null ? '' : data.interfaceName),
            '模式：' + String(data.modeLabel == null ? '' : data.modeLabel)
        ];
        if (!loads.length) {
            lines.push('负载：无');
        } else {
            lines.push('负载：');
            for (var i = 0; i < loads.length; i += 1) {
                var load = loads[i] || {};
                lines.push(
                    String(load.name == null ? '' : load.name) +
                    '；方向：' + String(load.directionLabel == null ? '' : load.directionLabel) +
                    '；预设带宽：' + String(load.bandwidthLabel == null ? '' : load.bandwidthLabel)
                );
            }
        }
        lines.push('');
        lines.push('假设');
        var texts = assumptionLines(assumptions);
        for (var j = 0; j < texts.length; j += 1) {
            lines.push(texts[j]);
        }
        lines.push('');
        lines.push('合计');
        lines.push('TX ' + String(data.tx == null ? '' : data.tx));
        lines.push('RX ' + String(data.rx == null ? '' : data.rx));
        lines.push('PCIe ' + String(data.pcie == null ? '' : data.pcie));
        if (data.pcieCapability) {
            const info = data.pcieCapability;
            lines.push('PCIe 容量：' + (info.capacity == null ? '未知，需核对设备' : info.capacity + ' Gbps') + '；来源：' + (info.source === 'manual' ? '手动' : info.source === 'standard' ? '固定表' : info.source === 'manual-invalid' ? '手动输入无效' : '设备相关'));
            lines.push(info.message);
        }
        if (data.statusLabel) lines.push('总体判断：' + data.statusLabel);
        return {
            assumptions: assumptions,
            text: lines.join('\n')
        };
    }

    return {
        capability: capability,
        getUsageStatus: getUsageStatus,
        getOverallStatus: getOverallStatus,
        totalLoads: totalLoads,
        MAX_LOADS: MAX_LOADS,
        canAddLoad: canAddLoad,
        shouldRenderLoads: shouldRenderLoads,
        loadLimitMessage: loadLimitMessage,
        attemptAddLoad: attemptAddLoad,
        getResultAssumptions: getResultAssumptions,
        buildResultCopy: buildResultCopy
    };
}));
