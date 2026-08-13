import assert from 'node:assert/strict';
import fs from 'node:fs';

const history = fs.readFileSync('items/History.html', 'utf8');
const versionBlocks = [...history.matchAll(
    /<!-- 版本 ([\d.]+) -->([\s\S]*?)(?=<!-- 版本 |<\/div>\s*<\/div>\s*<script)/g
)];
const categoryOrder = ['新功能', '逻辑改动与优化', '缺陷修复'];
const allowedTags = new Map([
    ['新功能', new Set(['new'])],
    ['逻辑改动与优化', new Set(['improved', 'ui', 'ux', 'deprecated'])],
    ['缺陷修复', new Set(['fixed', 'critical'])]
]);

assert.ok(versionBlocks.length > 0, '更新历史中至少应包含一个版本');

for (const [, version, block] of versionBlocks) {
    const cards = block.match(/<div class="update-list">/g) ?? [];
    assert.equal(cards.length, 1, `${version} 应只包含一个更新卡片`);

    const sections = [...block.matchAll(
        /<div class="feature-category">([^<]+)<\/div>\s*<ul>([\s\S]*?)<\/ul>/g
    )];
    const categories = sections.map((section) => section[1]);
    const expectedOrder = categoryOrder.filter((category) => categories.includes(category));

    assert.ok(sections.length > 0, `${version} 至少应包含一个更新分类`);
    assert.equal(new Set(categories).size, categories.length, `${version} 不应包含重复分类`);
    assert.deepEqual(categories, expectedOrder, `${version} 的分类名称或顺序不正确`);

    for (const [, category, list] of sections) {
        const items = [...list.matchAll(/<li>[\s\S]*?<\/li>/g)];
        assert.ok(items.length > 0, `${version} 的“${category}”分类不应为空`);

        for (const item of items) {
            const tag = item[0].match(/class="tag ([^"]+)"/)?.[1];
            assert.ok(tag, `${version} 的“${category}”条目缺少类型标签`);
            assert.ok(
                allowedTags.get(category).has(tag),
                `${version} 的“${category}”中存在不匹配的 ${tag} 标签`
            );
        }
    }
}

console.log(`history-layout regression passed (${versionBlocks.length} versions)`);
