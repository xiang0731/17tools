(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./text-budget-core.js'));
    } else {
        root.TransformerCore = factory(root.TextBudgetCore);
    }
})(typeof window !== 'undefined' ? window : globalThis, function (budget) {
    'use strict';

    function incrementLetterSequence(sequence, increment) {
        if (increment === 0) return sequence;

        var chars = sequence.split('');
        var carry = increment;

        for (var i = chars.length - 1; i >= 0 && carry > 0; i--) {
            var charCode = chars[i].charCodeAt(0);
            var isLower = chars[i] >= 'a' && chars[i] <= 'z';
            var minCode = isLower ? 'a'.charCodeAt(0) : 'A'.charCodeAt(0);
            var maxCode = isLower ? 'z'.charCodeAt(0) : 'Z'.charCodeAt(0);

            charCode += carry;

            if (charCode > maxCode) {
                var overflow = charCode - maxCode;
                chars[i] = String.fromCharCode(minCode + (overflow - 1) % 26);
                carry = Math.floor((overflow - 1) / 26) + 1;
            } else {
                chars[i] = String.fromCharCode(charCode);
                carry = 0;
            }
        }

        if (carry > 0) {
            var isUpper = sequence.length > 0 && (sequence[0] >= 'A' && sequence[0] <= 'Z');
            var padChar = isUpper ? 'A' : 'a';
            while (carry > 0) {
                chars.unshift(padChar);
                carry--;
            }
        }

        return chars.join('');
    }

    function incrementComplexSequence(sequence, increment) {
        if (increment === 0) return sequence;

        var segments = [];
        var currentSegment = '';
        var currentType = null;

        for (var i = 0; i < sequence.length; i++) {
            var char = sequence[i];
            var type = null;

            if (char >= '0' && char <= '9') {
                type = 'number';
            } else if (char >= 'a' && char <= 'z') {
                type = 'lower';
            } else if (char >= 'A' && char <= 'Z') {
                type = 'upper';
            } else {
                type = 'other';
            }

            if (type === currentType) {
                currentSegment += char;
            } else {
                if (currentSegment) {
                    segments.push({ type: currentType, value: currentSegment });
                }
                currentSegment = char;
                currentType = type;
            }
        }

        if (currentSegment) {
            segments.push({ type: currentType, value: currentSegment });
        }

        var carry = increment;

        for (var j = segments.length - 1; j >= 0 && carry > 0; j--) {
            var segment = segments[j];

            if (segment.type === 'number') {
                try {
                    var bigNumber = BigInt(segment.value) + BigInt(carry);
                    segment.value = bigNumber.toString();
                    carry = 0;
                } catch (error) {
                    // 忽略错误
                }
            } else if (segment.type === 'lower' || segment.type === 'upper') {
                segment.value = incrementLetterSequence(segment.value, carry);
                carry = 0;
            }
        }

        return segments.map(function (item) {
            return item.value;
        }).join('');
    }

    function decrementComplexSequence(sequence, decrement) {
        if (decrement === 0) return { value: sequence, isUnderflow: false };

        var segments = [];
        var currentSegment = '';
        var currentType = null;

        for (var i = 0; i < sequence.length; i++) {
            var char = sequence[i];
            var type = (char >= '0' && char <= '9') ? 'number' :
                (char >= 'a' && char <= 'z') ? 'lower' :
                    (char >= 'A' && char <= 'Z') ? 'upper' : 'other';

            if (type === currentType) {
                currentSegment += char;
            } else {
                if (currentSegment) segments.push({ type: currentType, value: currentSegment });
                currentSegment = char;
                currentType = type;
            }
        }
        if (currentSegment) segments.push({ type: currentType, value: currentSegment });

        var carry = decrement;
        var isUnderflow = false;
        var resultSegments = segments.map(function (item) {
            return { type: item.type, value: item.value };
        });

        for (var k = resultSegments.length - 1; k >= 0 && carry > 0; k--) {
            var segment = resultSegments[k];
            if (segment.type === 'number') {
                var val = BigInt(segment.value);
                if (val > BigInt(carry)) {
                    segment.value = (val - BigInt(carry)).toString();
                    carry = 0;
                } else {
                    isUnderflow = true;
                    segment.value = '';
                    carry = 0;
                }
            } else if (segment.type === 'lower' || segment.type === 'upper') {
                var chars = segment.value.split('');
                var minCode = (segment.type === 'lower' ? 'a' : 'A').charCodeAt(0);

                for (var n = chars.length - 1; n >= 0 && carry > 0; n--) {
                    var code = chars[n].charCodeAt(0);
                    var letterVal = code - minCode;
                    if (letterVal >= carry) {
                        chars[n] = String.fromCharCode(code - carry);
                        carry = 0;
                    } else {
                        isUnderflow = true;
                        chars[n] = '';
                        carry = 0;
                    }
                }
                segment.value = chars.join('');
            }
        }

        var finalValue = resultSegments.map(function (item) {
            return item.value;
        }).join('');
        return {
            value: finalValue,
            isUnderflow: isUnderflow || (finalValue === '' && decrement > 0)
        };
    }

    function utf8ToLatin1(text) {
        return encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, function (match, hex) {
            return String.fromCharCode('0x' + hex);
        });
    }

    function latin1ToUtf8(binary) {
        return decodeURIComponent(binary.split('').map(function (char) {
            return '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    }

    function encodeUtf8Base64(text) {
        var latin1 = utf8ToLatin1(String(text == null ? '' : text));
        if (typeof btoa === 'function') {
            return btoa(latin1);
        }
        return Buffer.from(latin1, 'latin1').toString('base64');
    }

    function decodeUtf8Base64(text) {
        var trimmed = String(text == null ? '' : text).trim();
        if (!trimmed) return '';
        var latin1 = typeof atob === 'function'
            ? atob(trimmed)
            : Buffer.from(trimmed, 'base64').toString('latin1');
        return latin1ToUtf8(latin1);
    }

    var TRANSFORMERS = {
        A: {
            name: '添加单引号和逗号',
            description: '为每一行添加单引号和逗号，例如: Item -> \'Item\',',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.map(function (line) {
                    return "'" + line + "',";
                }).join('\n');
            },
            example: { input: '17\nTools', auxiliary: '', output: "'17',\n'Tools'," }
        },
        B: {
            name: '添加双引号和逗号',
            description: '为每一行添加双引号和逗号，例如: Item -> "Item",',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.map(function (line) {
                    return '"' + line + '",';
                }).join('\n');
            },
            example: { input: '17\nTools', auxiliary: '', output: '"17",\n"Tools",' }
        },
        C: {
            name: '句首字母大写',
            description: '将每一行的首字母转换为大写',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.map(function (line) {
                    return line.charAt(0).toUpperCase() + line.slice(1);
                }).join('\n');
            },
            example: { input: 'hello world\ngood morning', auxiliary: '', output: 'Hello world\nGood morning' }
        },
        D: {
            name: '单词首字母大写',
            description: '将每个单词的首字母转换为大写',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.map(function (line) {
                    return line.split(' ').map(function (word) {
                        return word.charAt(0).toUpperCase() + word.slice(1);
                    }).join(' ');
                }).join('\n');
            },
            example: { input: 'hello world\ngood morning', auxiliary: '', output: 'Hello World\nGood Morning' }
        },
        E: {
            name: '添加__c',
            description: '在每一行末尾添加 "__c" (通常用于Salesforce字段名)',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.map(function (line) {
                    return line + '__c';
                }).join('\n');
            },
            example: { input: '17\nTools', auxiliary: '', output: '17__c\nTools__c' }
        },
        F: {
            name: '去除空格',
            description: '去除每一行中的所有空格',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.map(function (line) {
                    return line.replace(/\s/g, '');
                }).join('\n');
            },
            example: { input: 'hello world\ngood morning', auxiliary: '', output: 'helloworld\ngoodmorning' }
        },
        G: {
            name: '转换小写',
            description: '将所有字符转换为小写',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.map(function (line) {
                    return line.toLowerCase();
                }).join('\n');
            },
            example: { input: 'Hello World', auxiliary: '', output: 'hello world' }
        },
        H: {
            name: '转换大写',
            description: '将所有字符转换为大写',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.map(function (line) {
                    return line.toUpperCase();
                }).join('\n');
            },
            example: { input: 'Hello World', auxiliary: '', output: 'HELLO WORLD' }
        },
        I: {
            name: '提取首个单词',
            description: '提取每一行的第一个单词（或第一列数据）',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.map(function (line) {
                    var match = line.match(/^([^\s\t]+)/);
                    return match ? match[1] : line;
                }).join('\n');
            },
            example: { input: '17 123\nTools test abc', auxiliary: '', output: '17\nTools' }
        },
        J: {
            name: '添加前缀',
            description: '在每一行开头添加指定内容',
            needsAuxiliary: true,
            auxiliaryPlaceholder: '请输入前缀内容...',
            transform: function (lines, prefix) {
                return lines.map(function (line) {
                    return prefix + line;
                }).join('\n');
            },
            example: { input: 'A\nB', auxiliary: 'a.', output: 'a.A\na.B' }
        },
        K: {
            name: '添加后缀',
            description: '在每一行末尾添加指定内容',
            needsAuxiliary: true,
            auxiliaryPlaceholder: '请输入后缀内容...',
            transform: function (lines, suffix) {
                return lines.map(function (line) {
                    return line + suffix;
                }).join('\n');
            },
            example: { input: 'A\nB', auxiliary: '.a', output: 'A.a\nB.a' }
        },
        L: {
            name: '提取特定前值',
            description: '提取指定字符之前的所有内容',
            needsAuxiliary: true,
            auxiliaryPlaceholder: '请输入分隔符...',
            transform: function (lines, separator) {
                return lines.map(function (line) {
                    var index = line.indexOf(separator);
                    return index !== -1 ? line.substring(0, index) : line;
                }).join('\n');
            },
            example: { input: 'a-123\nb-456', auxiliary: '-', output: 'a\nb' }
        },
        M: {
            name: '提取特定后值',
            description: '提取指定字符之后的所有内容',
            needsAuxiliary: true,
            auxiliaryPlaceholder: '请输入分隔符...',
            transform: function (lines, separator) {
                return lines.map(function (line) {
                    var index = line.lastIndexOf(separator);
                    return index !== -1 ? line.substring(index + separator.length) : line;
                }).join('\n');
            },
            example: { input: 'a-123\nb-456', auxiliary: '-', output: '123\n456' }
        },
        N: {
            name: '添加顺序前缀',
            description: '添加自动递增的前缀序列 (如 1. 2. 3. 或 A. B. C.)',
            needsAuxiliary: true,
            auxiliaryPlaceholder: '请输入起始序号 (如 "1." 或 "a.")',
            transform: function (lines, suffix) {
                var separatorMatch = suffix.match(/^([a-zA-Z0-9]+)(.*)$/);
                if (separatorMatch) {
                    var incrementablePart = separatorMatch[1];
                    var punctuationPart = separatorMatch[2];
                    return lines.map(function (line, index) {
                        return incrementComplexSequence(incrementablePart, index) + punctuationPart + line;
                    }).join('\n');
                }
                return lines.map(function (line) {
                    return suffix + line;
                }).join('\n');
            },
            example: { input: '苹果\n香蕉\n橙子', auxiliary: '1a.', output: '1a.苹果\n1b.香蕉\n1c.橙子' }
        },
        O: {
            name: '添加倒序前缀',
            description: '添加自动递减的前缀序列 (如 3. 2. 1. 或 C. B. A.)',
            needsAuxiliary: true,
            auxiliaryPlaceholder: '请输入起始序号 (如 "10." 或 "c.")',
            transform: function (lines, suffix) {
                var separatorMatch = suffix.match(/^([a-zA-Z0-9]+)(.*)$/);
                if (separatorMatch) {
                    var incrementablePart = separatorMatch[1];
                    var punctuationPart = separatorMatch[2];
                    var hasUnderflow = false;

                    var resultLines = lines.map(function (line, index) {
                        var decResult = decrementComplexSequence(incrementablePart, index);
                        if (decResult.isUnderflow) {
                            hasUnderflow = true;
                            return '[序号不足]' + line;
                        }
                        return decResult.value + punctuationPart + line;
                    });

                    if (hasUnderflow) {
                        resultLines.unshift('温馨提示：当前前缀不足以填充全部数据');
                    }
                    return resultLines.join('\n');
                }
                return lines.map(function (line) {
                    return suffix + line;
                }).join('\n');
            },
            example: { input: '苹果\n香蕉\n橙子', auxiliary: '10.', output: '10.苹果\n9.香蕉\n8.橙子' }
        },
        P: {
            name: '空格换行',
            description: '将行内的空格转换为换行符',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.map(function (line) {
                    var trimmedLine = line.trim();
                    if (trimmedLine === '') return '';
                    return trimmedLine.split(/\s+/).join('\n');
                }).join('\n');
            },
            example: { input: '1 2\n3 4', auxiliary: '', output: '1\n2\n3\n4' }
        },
        Q: {
            name: '合并为一行',
            description: '将多行文本合并为一行，可自定义分隔符',
            needsAuxiliary: true,
            auxiliaryPlaceholder: '请输入分隔符（不填则直接合并）...',
            transform: function (lines, separator) {
                return lines.join(separator);
            },
            example: { input: '17\nTools', auxiliary: ',', output: '17,Tools' }
        },
        R: {
            name: 'Base64编码',
            description: '每行分别进行 UTF-8 Base64 编码，换行只作分隔；全文编码会把换行一起编码，本页采用逐行模式（不是加密）',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.map(function (line) {
                    try {
                        return encodeUtf8Base64(line);
                    } catch (error) {
                        return '[编码失败: ' + line + ']';
                    }
                }).join('\n');
            },
            example: { input: 'Hello\n你好', auxiliary: '', output: 'SGVsbG8=\n5L2g5aW9' }
        },
        S: {
            name: 'Base64解码',
            description: '每行分别将 UTF-8 Base64 编码还原为文本，结果行以换行分隔；本页采用逐行模式（不是解密）',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.map(function (line) {
                    try {
                        return decodeUtf8Base64(line);
                    } catch (error) {
                        return '[解码失败: ' + line + ']';
                    }
                }).join('\n');
            },
            example: { input: 'SGVsbG8=\n5L2g5aW9', auxiliary: '', output: 'Hello\n你好' }
        },
        T: {
            name: '顺序排序',
            description: '对每一行文本按字母/数字顺序进行正序排列',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.slice().sort(function (a, b) {
                    return a.localeCompare(b, 'zh-Hans-CN', { numeric: true });
                }).join('\n');
            },
            example: { input: 'Banana\nApple\nCherry', auxiliary: '', output: 'Apple\nBanana\nCherry' }
        },
        U: {
            name: '倒序排序',
            description: '对每一行文本按字母/数字顺序进行倒序排列',
            needsAuxiliary: false,
            transform: function (lines) {
                return lines.slice().sort(function (a, b) {
                    return b.localeCompare(a, 'zh-Hans-CN', { numeric: true });
                }).join('\n');
            },
            example: { input: 'Apple\nBanana\nCherry', auxiliary: '', output: 'Cherry\nBanana\nApple' }
        }
    };

    TRANSFORMERS.V = {
        name: '逐行转JSON数组', description: '每行作为一个字符串，保留空行；生成标准JSON数组', needsAuxiliary: false,
        transform: function (lines) { return JSON.stringify(lines, null, 2); },
        example: { input: '你好\n"引号"', auxiliary: '', output: '[\n  "你好",\n  "\\\"引号\\\""\n]' }
    };
    TRANSFORMERS.W = {
        name: '保留顺序去重', description: '默认精确比较每行；保留首次出现的原文和原顺序', needsAuxiliary: false,
        transform: function (lines, auxiliary, options) {
            var opts = options || {};
            var seen = new Set();
            return lines.filter(function (line) {
                var key = opts.trim ? line.trim() : line;
                if (opts.ignoreCase) key = key.toLocaleLowerCase('zh-CN');
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            }).join('\n');
        },
        example: { input: 'A\nB\nA', auxiliary: '', output: 'A\nB' }
    };

    // 与现有编号规则保持一致，只算长度，不创建可能迅速扩张的字母前缀。
    function sequentialOutputSize(lines, extra) {
        var match = extra.match(/^([a-zA-Z0-9]+)(.*)$/);
        var sequence = match ? match[1] : '';
        var trailing = sequence.match(/([0-9]+|[a-z]+|[A-Z]+)$/);
        var segment = trailing ? trailing[1] : '';
        var fixedLength = extra.length - segment.length;
        var numeric = /^\d+$/.test(segment), number = numeric ? BigInt(segment) : null;
        var size = Math.max(0, lines.length - 1);
        for (var i = 0; i < lines.length; i++) {
            var prefixLength = extra.length;
            if (match && i > 0) {
                if (numeric) prefixLength = fixedLength + (number + BigInt(i)).toString().length;
                else {
                    var carry = i, maximum = segment[0] === segment[0].toUpperCase() ? 90 : 122;
                    for (var j = segment.length - 1; j >= 0 && carry > 0; j--) {
                        var overflow = segment.charCodeAt(j) + carry - maximum;
                        carry = overflow > 0 ? Math.floor((overflow - 1) / 26) + 1 : 0;
                    }
                    prefixLength = extra.length + carry;
                }
            }
            size += lines[i].length + prefixLength;
            if (budget && size > budget.LIMITS.outputChars) return size;
        }
        return size;
    }

    function transform(id, input, auxiliary, options) {
        var spec = TRANSFORMERS[id];
        if (!spec) {
            throw new Error('未知的转换功能');
        }
        var source = String(input == null ? '' : input);
        var extra = auxiliary == null ? '' : String(auxiliary);
        var check = budget ? budget.assert(source) : { lines: source.split(/\r\n|\r|\n/).length };
        if (extra.length > 10000) throw new Error('附加内容超过1万字符，请缩短后重试');
        var lines = source.split(/\r\n|\r|\n/);
        var estimate = id === 'V'
            ? lines.reduce(function (length, line) { return length + JSON.stringify(line).length; }, lines.length * 4 + 2)
            : source.length * (id === 'R' ? 4 : 1) + check.lines * ((spec.needsAuxiliary ? extra.length : 0) + 12);
        if (id === 'N') estimate = sequentialOutputSize(lines, extra);
        if (budget) budget.assert(source, estimate);
        var output = spec.transform(lines, extra, options);
        if (budget && output.length > budget.LIMITS.outputChars) throw new Error('结果超过400万字符，请分批处理；原文已保留');
        return output;
    }

    return {
        TRANSFORMERS: TRANSFORMERS,
        transform: transform,
        encodeUtf8Base64: encodeUtf8Base64,
        decodeUtf8Base64: decodeUtf8Base64
    };
});
