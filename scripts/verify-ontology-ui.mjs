import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const output = new URL('../screenshots/ontology/', import.meta.url);
mkdirSync(output, { recursive: true });
const failures = [];
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173/';
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto(base);
  const module = page.getByRole('region', { name: 'Ontology and decision evidence' });
  await module.waitFor();
  await module.scrollIntoViewIfNeeded();
  assert.ok(await module.locator('.react-flow__node').count() >= 11);
  await module.getByRole('button', { name: 'Freeze graph snapshot', exact: true }).click();
  const frozen = await module.locator('.ontology-inspector').innerText();
  await page.waitForTimeout(1700);
  assert.equal(await module.locator('.ontology-inspector').innerText(), frozen);
  await module.locator('.react-flow__node').filter({ hasText: 'Blade RUL estimate' }).click();
  assert.ok((await module.locator('.ontology-inspector').innerText()).includes('P10 / P50 / P90'));
  await module.screenshot({ path: fileURLToPath(new URL('live-desktop.png', output)) });
  const downloadPromise = page.waitForEvent('download');
  await module.getByRole('button', { name: 'Download evidence JSON' }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^ontology-.*\.json$/);
  await module.getByRole('tab', { name: 'Ontology Schema' }).click();
  await module.getByRole('textbox', { name: 'Search ontology classes' }).fill('RULEstimate');
  await module.locator('.ontology-class-list').getByRole('button', { name: 'RULEstimate', exact: true }).click();
  assert.ok((await module.locator('.ontology-schema-detail').innerText()).includes('iof:InformationContentEntity'));
  await module.screenshot({ path: fileURLToPath(new URL('schema-desktop.png', output)) });
  await module.getByRole('tab', { name: 'Decision Trace' }).click();
  // Acceleration only affects the simulator's 1400 ms interval, not browser or chart timers.
  const accelerated = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  accelerated.on('pageerror', (error) => failures.push(error.message));
  await accelerated.addInitScript(() => {
    const interval = window.setInterval.bind(window);
    window.setInterval = (handler, delay, ...args) => interval(handler, delay === 1400 ? 30 : delay, ...args);
  });
  await accelerated.goto(new URL('enhanced/', base).href);
  const traceModule = accelerated.getByRole('region', { name: 'Ontology and decision evidence' });
  await traceModule.getByRole('tab', { name: 'Decision Trace' }).click();
  await traceModule.locator('.ontology-event-list > button').first().waitFor({ timeout: 20000 });
  await accelerated.waitForFunction(() => [...document.querySelectorAll('.ontology-event-list > button')].some((button) => button.textContent.includes('Completed')), { timeout: 20000 });
  const completed = traceModule.locator('.ontology-event-list > button').filter({ hasText: 'Completed' }).first();
  await completed.click();
  assert.ok((await traceModule.locator('.ontology-trace-detail').innerText()).includes('Pending measured evidence'));
  await traceModule.screenshot({ path: fileURLToPath(new URL('trace-desktop.png', output)) });
  await traceModule.getByRole('button', { name: 'View graph' }).click();
  assert.ok(await traceModule.locator('.react-flow__node').filter({ hasText: 'sdt:ActionExecution' }).count() === 1);
  const historical = await traceModule.locator('.ontology-inspector').innerText();
  await accelerated.waitForTimeout(500);
  assert.equal(await traceModule.locator('.ontology-inspector').innerText(), historical);
  results.push('Standard and enhanced routes; live graph, freeze, node details, download, schema search, automatic execution trace and immutable history passed.');

  await page.setViewportSize({ width: 390, height: 844 });
  await module.getByRole('tab', { name: 'Live Graph' }).click();
  await module.getByRole('button', { name: 'Focus selected entity and neighbors' }).click();
  for (const [label, image] of [['Live Graph', 'live-mobile.png'], ['Ontology Schema', 'schema-mobile.png'], ['Decision Trace', 'trace-mobile.png']]) {
    await module.getByRole('tab', { name: label }).click();
    await module.scrollIntoViewIfNeeded();
    assert.ok(await module.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), `${label} overflow`);
    await module.screenshot({ path: fileURLToPath(new URL(image, output)) });
  }
  results.push('390 px mobile: all three views rendered without module overflow.');
  assert.deepEqual(failures, [], 'Browser runtime errors');
  results.push('No browser runtime errors.');
  writeFileSync(new URL('verification.json', output), JSON.stringify({ verifiedAt: new Date().toISOString(), base, results, failures }, null, 2) + '\n');
  console.log(results.join('\n'));
} finally {
  await browser.close();
}
