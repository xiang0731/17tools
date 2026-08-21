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

const cases = [
    { name: '2560x1440 DPR 1', viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1, zoom: 1 },
    { name: '2056x1329 DPR 2', viewport: { width: 2056, height: 1329 }, deviceScaleFactor: 2, zoom: 1 },
    { name: '2056x1329 DPR 2 at 150% board zoom', viewport: { width: 2056, height: 1329 }, deviceScaleFactor: 2, zoom: 1.5 },
    { name: '1440x900 DPR 2', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, zoom: 1 }
];

const drawStart = { x: 100, y: 100 };
const drawEnd = { x: 180, y: 100 };
const probe = { x: 140, y: 100 };

async function runCase(browser, testCase) {
    const context = await browser.newContext({
        viewport: testCase.viewport,
        deviceScaleFactor: testCase.deviceScaleFactor
    });
    const page = await context.newPage();
    await page.goto(boardUrl);
    await page.waitForFunction(() => window.whiteboard && window.whiteboard.canvas.width > 0);

    await page.evaluate((zoom) => {
        window.whiteboard.brushSize = 12;
        window.whiteboard.strokeColor = '#000000';
        window.whiteboard.selectTool('pen');
        window.whiteboard.setZoom(zoom);
    }, testCase.zoom);

    const rect = await page.locator('#drawingCanvas').boundingBox();
    const metrics = await page.evaluate(() => {
        const canvas = window.whiteboard.canvas;
        const rect = canvas.getBoundingClientRect();
        return {
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
            rectWidth: rect.width,
            rectHeight: rect.height
        };
    });

    const visualScaleX = metrics.rectWidth / metrics.clientWidth;
    const visualScaleY = metrics.rectHeight / metrics.clientHeight;

    await page.mouse.move(rect.x + drawStart.x * visualScaleX, rect.y + drawStart.y * visualScaleY);
    await page.mouse.down();
    await page.mouse.move(rect.x + drawEnd.x * visualScaleX, rect.y + drawEnd.y * visualScaleY, { steps: 8 });
    await page.mouse.up();

    const result = await page.evaluate((probePoint) => {
        const canvas = window.whiteboard.canvas;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const radius = Math.ceil(18 * dpr);
        const centerX = Math.round(probePoint.x * dpr);
        const centerY = Math.round(probePoint.y * dpr);
        let inkPixels = 0;

        const left = Math.max(0, centerX - radius);
        const top = Math.max(0, centerY - radius);
        const width = Math.min(canvas.width - left, radius * 2 + 1);
        const height = Math.min(canvas.height - top, radius * 2 + 1);
        const pixels = ctx.getImageData(left, top, width, height).data;

        for (let index = 3; index < pixels.length; index += 4) {
            if (pixels[index] > 20) {
                inkPixels += 1;
            }
        }

        return {
            inkPixels,
            dpr,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            cssWidth: canvas.clientWidth,
            cssHeight: canvas.clientHeight
        };
    }, probe);

    await context.close();

    if (result.inkPixels < 25) {
        throw new Error(`${testCase.name}: expected ink near mouse probe (${probe.x}, ${probe.y}), found ${result.inkPixels} pixels. Metrics: ${JSON.stringify(result)}`);
    }

    return { name: testCase.name, inkPixels: result.inkPixels, dpr: result.dpr };
}

const browser = await chromium.launch({
    executablePath: chromeExecutable,
    headless: true
});

const results = [];
try {
    for (const testCase of cases) {
        results.push(await runCase(browser, testCase));
    }
} finally {
    await browser.close();
}

for (const result of results) {
    console.log(`PASS ${result.name}: inkPixels=${result.inkPixels}, dpr=${result.dpr}`);
}
