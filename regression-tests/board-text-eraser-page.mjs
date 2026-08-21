import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('items/Board.html', 'utf8');

assert.match(page, /js\/board-flood\.js/);
assert.match(page, /class="toolbar-primary"/);
assert.match(page, /id="tool-options"/);
assert.match(page, /id="color-group"/);
assert.match(page, /id="brush-size-group"/);
assert.match(page, /id="text-size-group"/);
assert.match(page, /id="text-font-size"/);
assert.match(page, /id="text-font-size-display"/);
assert.match(page, /id="line-tool"/);
assert.match(page, /id="line-arrow-toggle"/);
assert.match(page, /id="eraser-options-group"/);
assert.match(page, /id="eraser-geometry-group"/);
assert.match(page, /id="eraser-shape-round"/);
assert.match(page, /id="eraser-shape-square"/);
assert.match(page, /id="eraser-size"/);
assert.match(page, /id="eraser-size-display"/);
assert.match(page, /id="eraser-mode-point"/);
assert.match(page, /id="eraser-mode-clear"/);
assert.match(page, />点擦</);
assert.match(page, />消除</);
assert.equal(page.includes('id="arrow-tool"'), false);
assert.equal(page.includes('id="eraser-mode-pixel"'), false);
assert.equal(page.includes('id="eraser-mode-connected"'), false);
assert.equal(page.includes('id="eraser-mode-group"'), false);
assert.equal(page.includes('>像素<'), false);
assert.equal(page.includes('>连通<'), false);
assert.equal(page.includes('文字 (T)'), false);
assert.equal(page.includes("case 't': this.selectTool('text')"), false);
assert.equal(page.includes("selectTool('arrow')"), false);
assert.equal(page.includes("case 'p':"), false);
assert.equal(page.includes("case 'e':"), false);
assert.equal(page.includes("case '1':"), false);
assert.equal(page.includes("case 's':"), false);
assert.equal(page.includes("e.key === 's' || e.key === 'S'"), false);
assert.match(page, /case 'z':/);
assert.match(page, /case 'y':/);
assert.match(page, /case '0':/);
assert.match(page, /id="eraser-cursor"/);
assert.match(page, /['"]text-editor['"]/);
assert.match(page, /this\.eraserMode/);
assert.match(page, /this\.fontSize/);
assert.match(page, /this\.eraserSize/);
assert.match(page, /this\.arrowEnabled/);
assert.match(page, /settings:[\s\S]*fontSize/);
assert.equal(page.includes('id="mouse-x"'), false);
assert.equal(page.includes('id="mouse-y"'), false);
assert.equal(page.includes('坐标:'), false);
assert.equal(/cursorSize\s*=\s*Math\.min\(Math\.max\(size,\s*16\),\s*64\)/.test(page), false);
assert.equal(/Math\.min\(Math\.max\(size,\s*16\),\s*64\)/.test(page), false);

const history = fs.readFileSync('items/History.html', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');
assert.match(history, /<!-- 版本 2\.16\.3 -->/);
assert.match(history, /文字工具/);
assert.match(history, /连通擦/);
assert.match(readme, /文字/);
assert.match(readme, /连通/);

console.log('board-text-eraser-page source regression passed');

import { pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwrightLookupPath = process.env.PLAYWRIGHT_LOOKUP_PATH || process.cwd();
const playwrightModulePath = require.resolve('playwright', { paths: [playwrightLookupPath] });
const playwright = await import(pathToFileURL(playwrightModulePath).href);
const { chromium } = playwright.default || playwright;

const __dirname = dirname(fileURLToPath(import.meta.url));
const boardUrl = pathToFileURL(resolve(__dirname, '../items/Board.html')).href;
const chromeExecutable = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function countInkSource() {
    return `(() => {
        const wb = window.whiteboard;
        let count = 0;
        wb.tiles.forEach((tile) => {
            const data = tile.ctx.getImageData(0, 0, tile.canvas.width, tile.canvas.height).data;
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] > 20) {
                    count++;
                }
            }
        });
        return count;
    })()`;
}

async function openBoard(browser) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(boardUrl);
    await page.waitForFunction(() => window.whiteboard && window.whiteboard.canvas.width > 0);
    return { context, page };
}

async function canvasPoint(page, x, y) {
    const box = await page.locator('#drawingCanvas').boundingBox();
    return { x: box.x + x, y: box.y + y };
}

const browser = await chromium.launch({
    executablePath: chromeExecutable,
    headless: true
});

try {
    {
        const { context, page } = await openBoard(browser);
        await page.evaluate(() => window.whiteboard.selectTool('text'));
        const start = await canvasPoint(page, 120, 90);
        const end = await canvasPoint(page, 340, 210);
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 8 });
        await page.mouse.up();
        await page.waitForSelector('#text-editor');
        await page.fill('#text-editor', 'Hi');
        const outside = await canvasPoint(page, 40, 40);
        await page.mouse.click(outside.x, outside.y);
        await page.waitForFunction(() => !document.getElementById('text-editor'));
        const ink = await page.evaluate(countInkSource());
        assert.ok(ink > 20, `expected baked text ink, got ${ink}`);
        await context.close();
    }

    {
        const { context, page } = await openBoard(browser);
        await page.evaluate(() => window.whiteboard.selectTool('text'));
        const start = await canvasPoint(page, 120, 90);
        const end = await canvasPoint(page, 340, 210);
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 8 });
        await page.mouse.up();
        await page.waitForSelector('#text-editor');
        await page.fill('#text-editor', 'Hi');
        await page.keyboard.press('Escape');
        const editorGone = await page.evaluate(() => !document.getElementById('text-editor'));
        const ink = await page.evaluate(countInkSource());
        assert.equal(editorGone, true);
        assert.equal(ink, 0);
        await context.close();
    }

    {
        const { context, page } = await openBoard(browser);
        const before = await page.evaluate(() => window.whiteboard.historyIndex);
        await page.evaluate(() => window.whiteboard.selectTool('text'));
        const start = await canvasPoint(page, 120, 90);
        const end = await canvasPoint(page, 340, 210);
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 8 });
        await page.mouse.up();
        await page.waitForSelector('#text-editor');
        const outside = await canvasPoint(page, 40, 40);
        await page.mouse.click(outside.x, outside.y);
        await page.waitForFunction(() => !document.getElementById('text-editor'));
        const after = await page.evaluate(() => window.whiteboard.historyIndex);
        const ink = await page.evaluate(countInkSource());
        assert.equal(after, before);
        assert.equal(ink, 0);
        await context.close();
    }

    {
        const { context, page } = await openBoard(browser);
        const radius = await page.evaluate(() => {
            const wb = window.whiteboard;
            wb.brushSize = 20;
            wb.setZoom(1.5);
            wb.selectTool('eraser');
            return wb.eraserScreenRadius();
        });
        assert.equal(radius, 20 * 2 * 1.5);
        await context.close();
    }

    {
        const { context, page } = await openBoard(browser);
        const result = await page.evaluate(() => {
            const wb = window.whiteboard;
            wb.strokeColor = '#000000';
            wb.brushSize = 8;
            wb.selectTool('pen');
            wb.paintSegment(80, 120, 220, 120, false);
            wb.paintSegment(150, 50, 150, 190, false);
            wb.redrawDisplay();
            wb.saveState();
            const before = (() => {
                let count = 0;
                wb.tiles.forEach((tile) => {
                    const data = tile.ctx.getImageData(0, 0, tile.canvas.width, tile.canvas.height).data;
                    for (let i = 3; i < data.length; i += 4) {
                        if (data[i] > 20) count++;
                    }
                });
                return count;
            })();
            wb.selectTool('eraser');
            wb.setEraserMode('clear');
            const cleared = wb.floodEraseAt(150, 120);
            wb.redrawDisplay();
            const after = (() => {
                let count = 0;
                wb.tiles.forEach((tile) => {
                    const data = tile.ctx.getImageData(0, 0, tile.canvas.width, tile.canvas.height).data;
                    for (let i = 3; i < data.length; i += 4) {
                        if (data[i] > 20) count++;
                    }
                });
                return count;
            })();
            const blankIndex = wb.historyIndex;
            const blankCleared = wb.floodEraseAt(10, 10);
            return { before, after, cleared, blankCleared, historyIndex: wb.historyIndex, blankIndex };
        });
        assert.ok(result.before > 50, `expected crossing ink, got ${result.before}`);
        assert.ok(result.cleared > 0, 'connected erase should clear ink');
        assert.ok(result.after < result.before * 0.2, `expected most ink gone, before=${result.before} after=${result.after}`);
        assert.equal(result.blankCleared, 0);
        assert.equal(result.historyIndex, result.blankIndex);
        await context.close();
    }
} finally {
    await browser.close();
}

console.log('board-text-eraser-page regression passed');
