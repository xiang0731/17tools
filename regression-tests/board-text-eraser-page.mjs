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
assert.match(page, /\.toolbar-group\[hidden\],\s*\.tool-btn\[hidden\]/);
assert.match(page, /switch \(e\.key\.toLowerCase\(\)\)/);
assert.match(page, /case 'z':/);
assert.match(page, /case 'y':/);
assert.match(page, /case '0':/);
assert.match(page, /this\.updatePresetColors\(\);\s*this\.updateToolOptionsUI\(\);\s*this\.updateCursor\(\);/);
assert.match(page, /id="eraser-cursor"/);
assert.match(page, /['"]text-editor['"]/);
assert.match(page, /this\.eraserMode/);
assert.match(page, /this\.fontSize/);
assert.match(page, /this\.eraserSize/);
assert.match(page, /this\.arrowEnabled/);
assert.match(page, /settings:[\s\S]*fontSize/);
assert.match(page, /settings:[\s\S]*eraserSize/);
assert.match(page, /eraserSize \* (this\.scale|camera\.scale|scale)/);
assert.equal(/eraserScreenRadius\(\) \{\s*return this\.brushSize \* 2 \* this\.scale;/.test(page), false);
assert.equal(page.includes('id="mouse-x"'), false);
assert.equal(page.includes('id="mouse-y"'), false);
assert.equal(page.includes('坐标:'), false);
assert.equal(/cursorSize\s*=\s*Math\.min\(Math\.max\(size,\s*16\),\s*64\)/.test(page), false);
assert.equal(/Math\.min\(Math\.max\(size,\s*16\),\s*64\)/.test(page), false);

const history = fs.readFileSync('items/History.html', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');
assert.match(history, /<!-- 版本 2\.16\.7 -->/);
assert.match(history, /版本 2\.16\.7/);
assert.match(history, /点擦/);
assert.match(history, /消除/);
assert.match(history, /<!-- 版本 2\.16\.3 -->/);
assert.match(history, /文字工具/);
assert.match(readme, /文字/);
assert.match(readme, /点擦/);
assert.match(readme, /消除/);

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
        const initial = await page.evaluate(() => {
            const hidden = (id) => document.getElementById(id).hidden;
            const display = (id) => getComputedStyle(document.getElementById(id)).display;
            return {
                tool: window.whiteboard.currentTool,
                brush: hidden('brush-size-group'),
                brushDisplay: display('brush-size-group'),
                text: hidden('text-size-group'),
                textDisplay: display('text-size-group'),
                eraser: hidden('eraser-options-group'),
                eraserDisplay: display('eraser-options-group'),
                color: hidden('color-group'),
                colorDisplay: display('color-group'),
                arrow: hidden('line-arrow-toggle'),
                arrowDisplay: display('line-arrow-toggle')
            };
        });
        assert.equal(initial.tool, 'pen');
        assert.equal(initial.brush, false);
        assert.notEqual(initial.brushDisplay, 'none');
        assert.equal(initial.text, true);
        assert.equal(initial.textDisplay, 'none');
        assert.equal(initial.eraser, true);
        assert.equal(initial.eraserDisplay, 'none');
        assert.equal(initial.color, false);
        assert.notEqual(initial.colorDisplay, 'none');
        assert.equal(initial.arrow, true);
        assert.equal(initial.arrowDisplay, 'none');

        await page.click('#text-tool');
        const onText = await page.evaluate(() => ({
            brush: document.getElementById('brush-size-group').hidden,
            brushDisplay: getComputedStyle(document.getElementById('brush-size-group')).display,
            text: document.getElementById('text-size-group').hidden,
            textDisplay: getComputedStyle(document.getElementById('text-size-group')).display
        }));
        assert.equal(onText.brush, true);
        assert.equal(onText.brushDisplay, 'none');
        assert.equal(onText.text, false);
        assert.notEqual(onText.textDisplay, 'none');

        await page.click('#eraser-tool');
        const onEraser = await page.evaluate(() => ({
            color: document.getElementById('color-group').hidden,
            colorDisplay: getComputedStyle(document.getElementById('color-group')).display,
            eraser: document.getElementById('eraser-options-group').hidden,
            eraserDisplay: getComputedStyle(document.getElementById('eraser-options-group')).display,
            geometry: document.getElementById('eraser-geometry-group').hidden,
            sizeText: document.getElementById('eraser-size-display').textContent,
            mode: window.whiteboard.eraserMode
        }));
        assert.equal(onEraser.color, true);
        assert.equal(onEraser.colorDisplay, 'none');
        assert.equal(onEraser.eraser, false);
        assert.notEqual(onEraser.eraserDisplay, 'none');
        assert.equal(onEraser.geometry, false);
        assert.equal(onEraser.sizeText, '24px');
        assert.equal(onEraser.mode, 'point');

        await page.click('#eraser-mode-clear');
        const onClear = await page.evaluate(() => document.getElementById('eraser-geometry-group').hidden);
        assert.equal(onClear, true);
        await page.click('#eraser-mode-point');
        const onPoint = await page.evaluate(() => document.getElementById('eraser-geometry-group').hidden);
        assert.equal(onPoint, false);

        await page.click('#pen-tool');
        await page.locator('#brush-size').evaluate((el) => {
            el.value = '8';
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.click('#eraser-tool');
        const eraserStill = await page.evaluate(() => document.getElementById('eraser-size-display').textContent);
        assert.equal(eraserStill, '24px');
        await page.locator('#eraser-size').evaluate((el) => {
            el.value = '40';
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.click('#pen-tool');
        const brushBack = await page.evaluate(() => ({
            value: window.whiteboard.brushSize,
            text: document.getElementById('size-display').textContent
        }));
        assert.equal(brushBack.value, 8);
        assert.equal(brushBack.text, '8px');

        await page.click('#line-tool');
        const onLine = await page.evaluate(() => ({
            arrowHidden: document.getElementById('line-arrow-toggle').hidden,
            arrowDisplay: getComputedStyle(document.getElementById('line-arrow-toggle')).display,
            enabled: window.whiteboard.arrowEnabled
        }));
        assert.equal(onLine.arrowHidden, false);
        assert.notEqual(onLine.arrowDisplay, 'none');
        assert.equal(onLine.enabled, false);
        await page.click('#line-arrow-toggle');
        const afterToggle = await page.evaluate(() => window.whiteboard.arrowEnabled);
        assert.equal(afterToggle, true);
        assert.equal(await page.locator('#arrow-tool').count(), 0);

        const beforeTool = await page.evaluate(() => window.whiteboard.currentTool);
        await page.keyboard.press('e');
        await page.keyboard.press('t');
        await page.keyboard.press('a');
        const afterKeys = await page.evaluate(() => window.whiteboard.currentTool);
        assert.equal(afterKeys, beforeTool);

        await page.evaluate(() => window.whiteboard.setZoom(1.5));
        await page.keyboard.down('Control');
        await page.keyboard.press('0');
        await page.keyboard.up('Control');
        const zoom = await page.evaluate(() => window.whiteboard.scale);
        assert.equal(zoom, 1);
        await context.close();
    }

    {
        const { context, page } = await openBoard(browser);
        await page.click('#line-tool');
        await page.click('#line-arrow-toggle');
        const start = await canvasPoint(page, 80, 160);
        const end = await canvasPoint(page, 280, 160);
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 8 });
        await page.mouse.up();
        const ink = await page.evaluate(countInkSource());
        const flag = await page.evaluate(() => window.whiteboard.arrowEnabled);
        assert.equal(flag, true);
        assert.ok(ink > 20, `expected arrow ink, got ${ink}`);
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
            wb.eraserSize = 24;
            wb.setZoom(1.5);
            wb.selectTool('eraser');
            return wb.eraserScreenRadius();
        });
        assert.equal(radius, (24 / 2) * 1.5);
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

    {
        const { context, page } = await openBoard(browser);
        const result = await page.evaluate(() => {
            const wb = window.whiteboard;
            wb.selectTool('eraser');
            wb.setEraserMode('clear');
            const beforeCursor = document.querySelector('.canvas-wrapper').style.cursor;
            wb.loadFromData({
                settings: {
                    strokeColor: '#000000',
                    brushSize: 4,
                    fontSize: 24,
                    eraserSize: 24
                }
            });
            return {
                beforeCursor,
                mode: wb.eraserMode,
                shape: wb.eraserShape,
                cursor: document.querySelector('.canvas-wrapper').style.cursor
            };
        });
        assert.equal(result.beforeCursor, 'crosshair');
        assert.equal(result.mode, 'point');
        assert.equal(result.shape, 'round');
        assert.equal(result.cursor, 'none');
        await context.close();
    }

    {
        const { context, page } = await openBoard(browser);
        const drawn = await page.evaluate(() => {
            const wb = window.whiteboard;
            wb.paintSegment(80, 120, 220, 120, false);
            wb.saveState();
            const afterDraw = wb.historyIndex;
            wb.undo();
            return { afterDraw, afterUndo: wb.historyIndex };
        });
        assert.ok(drawn.afterUndo < drawn.afterDraw);
        await page.evaluate(() => {
            document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Z',
                code: 'KeyZ',
                ctrlKey: true,
                shiftKey: true,
                bubbles: true,
                cancelable: true
            }));
        });
        const afterRedo = await page.evaluate(() => window.whiteboard.historyIndex);
        assert.equal(afterRedo, drawn.afterDraw);
        await context.close();
    }
} finally {
    await browser.close();
}

console.log('board-text-eraser-page regression passed');
