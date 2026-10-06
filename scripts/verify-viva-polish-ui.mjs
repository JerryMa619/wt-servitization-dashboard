import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173/';
const published = !['localhost', '127.0.0.1'].includes(new URL(base).hostname);
const out = new URL(published ? '../screenshots/viva-polish/public/' : '../screenshots/viva-polish/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const errors = [], results = [];
const adjusted = 'Adjusted lower / P50 / Adjusted upper';
try {
  for (const route of ['', 'enhanced/']) {
    const name = route ? 'enhanced' : 'standard';
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*.tile.openstreetmap.org/**', request => request.abort());
    await page.goto(new URL(route, base).href);
    await page.getByRole('combobox', { name: 'WT viva case' }).selectOption('service');
    const metric = page.locator('.metric').filter({ hasText: 'Blade RUL' });
    assert.ok((await metric.innerText()).includes(adjusted));
    const twin = page.getByRole('region', { name: 'Integrated wind turbine digital twin' });
    await twin.getByRole('button', { name: 'RUL evidence', exact: true }).click();
    assert.ok((await twin.getByLabel('Architecture module details').innerText()).includes(adjusted));
    await page.locator('.wt-map-pin').click();
    assert.ok((await page.locator('.leaflet-popup-content').innerText()).includes(adjusted));
    await page.locator('.leaflet-popup-close-button').click();
    await page.getByRole('button', { name: 'Evidence chain', exact: true }).click();
    const evidence = page.getByRole('dialog', { name: 'Evidence chain', exact: true });
    assert.ok((await evidence.innerText()).includes(adjusted));
    await page.getByRole('button', { name: 'Close evidence chain', exact: true }).click();
    const tcs = page.locator('#tcs-panel');
    assert.match(await tcs.locator('.tcs-allocation-note').innerText(), /Illustrative cost allocation; not measured expenditure/);
    await tcs.locator('.tcs-option').first().focus();
    assert.equal(await tcs.locator('.tcs-option').first().locator('.tcs-breakdown').isVisible(), true);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await tcs.scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.ok(await tcs.locator('.tcs-allocation-note').evaluate(node => node.scrollHeight <= node.clientHeight + 1));
      await tcs.screenshot({ path: fileURLToPath(new URL(`${name}-tcs-${width}.png`, out)) });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await twin.screenshot({ path: fileURLToPath(new URL(`${name}-architecture.png`, out)) });
    await page.getByRole('tab', { name: 'Semantic Check', exact: true }).click();
    const semantic = page.getByRole('region', { name: 'WT executable semantic validation' });
    await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL' }).click();
    await semantic.getByTestId('wt-shacl-result').waitFor({ timeout: 60000 });
    assert.match(await semantic.getByTestId('wt-shacl-result').innerText(), /^CONFORMS/);
    assert.equal(await semantic.getByRole('columnheader', { name: 'Adjusted lower / pseudo-h', exact: true }).count(), 1);
    assert.equal(await semantic.getByRole('columnheader', { name: 'Adjusted upper / pseudo-h', exact: true }).count(), 1);
    await semantic.screenshot({ path: fileURLToPath(new URL(`${name}-semantic.png`, out)) });
    await page.getByRole('button', { name: 'Input scenario', exact: true }).click();
    const input = page.getByRole('dialog', { name: 'Input WT scenario data', exact: true });
    const point = input.getByRole('spinbutton', { name: 'RUL P50 / pseudo-h', exact: true });
    await point.fill(String(Number(await point.inputValue()) + 20));
    await input.getByRole('button', { name: 'Apply to dashboard', exact: true }).click();
    assert.match(await metric.innerText(), /Lower \/ P50 \/ Upper.*Manual RUL assumption/);
    assert.ok(!(await metric.innerText()).includes('Adjusted'));
    const rulChart = page.getByRole('region', { name: 'Blade RUL Uncertainty', exact: true });
    assert.match(await rulChart.locator('.telemetry-subtitle').innerText(), /manual and historical bounds are not active-model calibrated uncertainty/);
    await rulChart.scrollIntoViewIfNeeded();
    await rulChart.locator('canvas').waitFor();
    await page.waitForTimeout(1000);
    assert.ok(await rulChart.locator('canvas').evaluate(canvas => {
      const { width, height } = canvas;
      const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
      let colored = 0;
      for (let y = Math.round(height * .25); y < height * .8; y++) for (let x = Math.round(width * .2); x < width * .85; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] && data[i + 1] > 110 && ((data[i] > 170 && data[i + 2] < 140) || (data[i] < 140 && data[i + 2] > 130))) colored++;
      }
      return colored > 20;
    }), 'Single-reading RUL markers must render inside the plot');
    await rulChart.screenshot({ path: fileURLToPath(new URL(`${name}-manual-rul.png`, out)) });
    await page.getByRole('tab', { name: 'Live Graph', exact: true }).click();
    await page.getByRole('button', { name: 'Resume live graph', exact: true }).click();
    await page.getByRole('tab', { name: 'Semantic Check', exact: true }).click();
    await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL' }).click();
    await semantic.getByTestId('wt-shacl-result').waitFor({ timeout: 60000 });
    assert.equal(await semantic.getByRole('columnheader', { name: 'Lower / pseudo-h', exact: true }).count(), 1);
    assert.equal(await semantic.getByRole('columnheader', { name: 'Upper / pseudo-h', exact: true }).count(), 1);
    results.push({ route: page.url(), checks: ['Adjusted labels in metrics, map, architecture, evidence and executed semantic results', 'Manual override not labelled calibrated', 'Cost-allocation disclosure and keyboard-accessible breakdown', '1440/390/320 px layouts without page overflow'] });
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(new URL('verification.json', out), JSON.stringify({ base, results, errors }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
