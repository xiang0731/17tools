import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');
const playwrightLookupPath = process.env.PLAYWRIGHT_LOOKUP_PATH || rootDir;
const playwrightModulePath = require.resolve('playwright', { paths: [playwrightLookupPath] });
const playwright = await import(pathToFileURL(playwrightModulePath).href);
const { chromium } = playwright.default || playwright;

const defaultChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.CHROME_PATH || (fs.existsSync(defaultChromePath) ? defaultChromePath : undefined);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

function pageUrl(relativePath) {
    return pathToFileURL(path.join(rootDir, relativePath)).href;
}

async function assertNoScriptExecution(page, label) {
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__securityRegressionExecuted), 0, `${label} executed injected markup`);
}

try {
    const page = await browser.newPage();

    await page.goto(pageUrl('items/Markdown.html'));
    await page.evaluate(() => { window.__securityRegressionExecuted = 0; });
    await page.locator('#md-input').fill('<section><img src=x onerror="window.__securityRegressionExecuted=1"></section>');
    await assertNoScriptExecution(page, 'Markdown preview');
    assert.ok(!(await page.locator('#md-preview').innerHTML()).includes('onerror'), 'Markdown preview should remove event handlers');

    await page.goto(pageUrl('items/Calculator.html'));
    await page.evaluate(() => { window.__securityRegressionExecuted = 0; });
    const calculatorPayload = '1\n<img src=x onerror="window.__securityRegressionExecuted=1">';
    await page.locator('#numbers').fill(calculatorPayload);
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: '保存结果' }).click();
    await assertNoScriptExecution(page, 'Calculator history');
    assert.equal(await page.locator('.history-expression img').count(), 0, 'Calculator history should render expressions as text');

    await page.goto(pageUrl('items/PrettyFormat.html'));
    await page.evaluate(() => { window.__securityRegressionExecuted = 0; });
    await page.locator('#language').selectOption('babel');
    await page.locator('#input-code').fill('const <img src=x onerror="window.__securityRegressionExecuted=1">');
    await page.locator('#format-btn').click();
    await assertNoScriptExecution(page, 'PrettyFormat status');
    assert.equal(await page.locator('#status-message img').count(), 0, 'PrettyFormat errors should render as text');

    await page.goto(pageUrl('items/DevTool2.html'));
    await page.evaluate(() => { window.__securityRegressionExecuted = 0; });
    await page.locator('.tool-card:nth-child(4) input.demo-input')
        .fill('<img src=x onerror="window.__securityRegressionExecuted=1">');
    await page.waitForTimeout(1700);
    await assertNoScriptExecution(page, 'DevTool2 code preview');
    assert.equal(await page.locator('.tool-card:nth-child(4) .demo-output img').count(), 0, 'DevTool2 preview should render code as text');

    await page.goto(pageUrl('items/LinkCleaner.html'));
    const cleanedLinks = await page.evaluate(() => [
        cleanSingleLink('https://www.google.com/search?q=17tools&utm_source=test').url,
        cleanSingleLink('https://shop.example/product?variant=blue&utm_campaign=test').url,
        cleanSingleLink('https://example.com/page?preferred_language=zh&safe=1').url,
        cleanSingleLink('https://www.amazon.com/s?k=keyboard&tag=affiliate-20&pf_rd_p=tracking').url
    ]);
    assert.deepEqual(cleanedLinks, [
        'https://www.google.com/search?q=17tools',
        'https://shop.example/product?variant=blue',
        'https://example.com/page?preferred_language=zh&safe=1',
        'https://www.amazon.com/s?k=keyboard'
    ]);

    await page.close();

    const dateContext = await browser.newContext({ timezoneId: 'America/New_York' });
    const datePage = await dateContext.newPage();
    await datePage.goto(pageUrl('items/DateCalculator.html'));

    await datePage.locator('[data-function="B"]').click();
    await datePage.locator('#date1').fill('2026-11-01');
    await datePage.locator('#date2').fill('2026-11-02');
    await datePage.locator('#calculateBtn').click();
    assert.match(await datePage.locator('#result').innerText(), /相差\s*1\s*天/, 'DST boundary should still be one calendar day');

    await datePage.locator('[data-function="A"]').click();
    await datePage.locator('#startDate').fill('2026-01-31');
    await datePage.locator('#timeValue').fill('1');
    await datePage.locator('#timeUnit').selectOption('months');
    await datePage.locator('#calculateBtn').click();
    assert.match(await datePage.locator('#result').innerText(), /2026-02-28/, 'Natural-month arithmetic should clamp to month end');

    const lunarRoundTrip = await datePage.evaluate(() => {
        const lunar = lunarCalendar.solarToLunar(2026, 2, 17);
        return lunarCalendar.lunarToSolar(lunar.year, lunar.month, lunar.day, lunar.isLeap);
    });
    assert.deepEqual(lunarRoundTrip, { year: 2026, month: 2, day: 17 }, 'Lunar conversion should be timezone-independent');

    await datePage.goto(pageUrl('items/Calendar.html'));
    const calendarDayDifference = await datePage.evaluate(() => {
        return getCalendarDayNumber(new Date(2026, 2, 9)) - getCalendarDayNumber(new Date(2026, 2, 8));
    });
    assert.equal(calendarDayDifference, 1, 'Calendar relative-day labels should ignore DST hour changes');

    await dateContext.close();
    console.log('security-date-browser regression passed');
} finally {
    await browser.close();
}
