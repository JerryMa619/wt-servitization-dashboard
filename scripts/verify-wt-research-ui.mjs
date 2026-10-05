import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173/';
const published = !['localhost', '127.0.0.1'].includes(new URL(base).hostname);
const out = new URL(published ? '../screenshots/wt-research/public/' : '../screenshots/wt-research/', import.meta.url); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const errors = [], results = [];
const session = page => page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('wt-servitization-session-v1:')))));
try {
  for (const route of ['', 'enhanced/']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*.tile.openstreetmap.org/**', r => r.abort());
    await page.goto(new URL(route, base).href);
    await page.getByRole('button', { name: 'Pause WT simulation', exact: true }).click();
    await page.waitForTimeout(100);
    for (const [id, crack] of [['healthy', '0'], ['growth', '25'], ['damage', '65']]) {
      await page.getByRole('combobox', { name: 'WT viva case' }).selectOption(id);
      assert.equal(await page.getByRole('region', { name: 'Wind turbine physical animation' }).getAttribute('data-crack-mm'), crack);
      assert.equal(await page.getByRole('button', { name: 'Play WT simulation', exact: true }).count(), 1);
    }
    await page.getByRole('combobox', { name: 'WT viva case' }).selectOption('service');
    const original = await session(page);
    const twin = page.getByRole('region', { name: 'Integrated wind turbine digital twin' });
    const turbine = twin.getByRole('region', { name: 'Wind turbine physical animation' });
    assert.equal(await turbine.getAttribute('data-crack-mm'), '45');
    assert.match(await turbine.innerText(), /Simulated blade condition/i); assert.match(await turbine.innerText(), /pseudo-h/);
    const angle = await turbine.locator('.blades').getAttribute('style'); await page.waitForTimeout(250);
    assert.equal(await turbine.locator('.blades').getAttribute('style'), angle, 'Whole-simulation pause freezes rotor view without fabricating zero RPM');
    await page.getByRole('button', { name: 'Play WT simulation', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.ontology-event-select option')].some(o => o.value !== 'live'), { timeout: 20000 });
    await page.locator('.service-run.completed').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Pause WT simulation', exact: true }).click();
    const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export service history', exact: true }).click();
    const exported = await downloadEvent, demo = JSON.parse(readFileSync(await exported.path(), 'utf8'));
    assert.ok(demo.events.some(e => e.status === 'completed')); assert.ok(demo.stats.completedServices >= 1); assert.ok(demo.stats.totalDowntimeH > 0);
    const completed = demo.events.find(e => e.status === 'completed');
    assert.ok(completed.before.reading.crackMm > 45 && completed.after.reading.crackMm < completed.before.reading.crackMm, 'Automatic growth precedes a completed simulated repair');
    writeFileSync(new URL(`${route ? 'enhanced' : 'standard'}-completed-demo.json`, out), JSON.stringify(demo, null, 2) + '\n');
    assert.deepEqual(await session(page), original, 'Isolated demo must not replace persisted original session');
    await page.getByRole('tab', { name: 'Semantic Check', exact: true }).click();
    const semantic = page.getByRole('region', { name: 'WT executable semantic validation' });
    const shapesURL = '**/ontology/wt-shapes.ttl';
    await page.route(shapesURL, r => r.fulfill({ status: 503, body: 'Test-only unavailable resource' }));
    await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL', exact: true }).click();
    await semantic.getByRole('alert').waitFor(); assert.match(await semantic.getByRole('alert').innerText(), /HTTP 503/);
    assert.equal(await semantic.getByTestId('wt-shacl-result').count(), 0);
    await page.unroute(shapesURL);
    await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL', exact: true }).click();
    try { await semantic.getByTestId('wt-shacl-result').waitFor({ timeout: 60000 }); }
    catch (e) { console.error(await semantic.innerText(), errors); throw e; }
    assert.match(await semantic.getByTestId('wt-shacl-result').innerText(), /^CONFORMS/);
    const evidenceDownload = page.waitForEvent('download'); await semantic.getByRole('button', { name: 'Evidence + hashes', exact: true }).click();
    const evidence = JSON.parse(readFileSync(await (await evidenceDownload).path(), 'utf8'));
    assert.ok(evidence.conforms); assert.match(evidence.datasetSHA256, /^[a-f0-9]{64}$/); assert.match(evidence.datasetTTL, /PseudoHour/); assert.ok(evidence.reportTTL.includes('conforms'));
    writeFileSync(new URL(`${route ? 'enhanced' : 'standard'}-semantic-evidence.json`, out), JSON.stringify(evidence, null, 2) + '\n');
    await page.getByRole('tabpanel', { name: 'Semantic Check', exact: true }).screenshot({ path: fileURLToPath(new URL(`${route ? 'enhanced' : 'standard'}-semantic-desktop.png`, out)) });
    for (const defect of ['missing-unit', 'missing-evidence']) {
      await semantic.getByRole('combobox', { name: 'WT validation case' }).selectOption(defect);
      assert.equal(await semantic.getByTestId('wt-shacl-result').count(), 0);
      await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL' }).click();
      await semantic.getByTestId('wt-shacl-result').waitFor(); assert.match(await semantic.getByTestId('wt-shacl-result').innerText(), /^NON-CONFORMING/);
    }
    await semantic.getByRole('combobox', { name: 'WT validation case' }).selectOption('none');
    await semantic.getByRole('combobox', { name: 'WT semantic question' }).selectOption('features');
    await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL' }).click(); await semantic.getByTestId('wt-shacl-result').waitFor();
    assert.equal(await semantic.getByRole('table', { name: 'WT SPARQL results' }).locator('tbody tr').count(), 31);
    const comparison = page.getByRole('region', { name: 'WT policy comparison' }); await comparison.scrollIntoViewIfNeeded();
    await comparison.getByRole('button', { name: 'Run comparison', exact: true }).click();
    await comparison.getByRole('table', { name: 'Policy comparison results' }).waitFor(); assert.equal(await comparison.getByRole('table', { name: 'Policy comparison results' }).locator('tbody tr').count(), 4);
    await comparison.getByText('Cost and efficacy sensitivity', { exact: true }).click();
    assert.equal(await comparison.getByRole('table', { name: 'Policy sensitivity results' }).locator('tbody tr').count(), 7);
    await comparison.locator('.chart-panel canvas').waitFor();
    const chartPixels = () => comparison.locator('.chart-panel canvas').evaluate(c => {
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let colored = 0;
      // Count data-series pixels inside the plot, excluding the legend and axes.
      for (let y = Math.round(c.height * .35); y < c.height * .8; y++) for (let x = Math.round(c.width * .25); x < c.width * .9; x++) {
        const i = (y * c.width + x) * 4;
        if (data[i + 3] && ((data[i] > 175 && data[i + 1] > 120 && data[i + 2] < 130) || (data[i] < 150 && data[i + 1] > 160 && data[i + 2] > 130))) colored++;
      }
      return colored;
    });
    assert.ok(await chartPixels() > 100, 'Rendered chart includes cost curves, not just grid pixels');
    await comparison.screenshot({ path: fileURLToPath(new URL(`${route ? 'enhanced' : 'standard'}-comparison-desktop.png`, out)) });
    const downloadPolicy = page.waitForEvent('download'); await comparison.getByRole('button', { name: 'Download policy comparison' }).click();
    const file = await downloadPolicy, record = JSON.parse(readFileSync(await file.path(), 'utf8')); assert.equal(record.results.length, 4); assert.match(record.scope, /not measured savings/);
    writeFileSync(new URL(`${route ? 'enhanced' : 'standard'}-policy-comparison.json`, out), JSON.stringify(record, null, 2) + '\n');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(() => {
        const canvas = document.querySelector('#policy-comparison canvas'), host = canvas?.closest('.echarts-for-react');
        return canvas && host && Math.abs(canvas.getBoundingClientRect().width - host.getBoundingClientRect().width) < 2;
      });
      await comparison.screenshot({ path: fileURLToPath(new URL(`${route ? 'enhanced' : 'standard'}-comparison-${width}.png`, out)) });
      assert.ok(await chartPixels() > 50, `${width}: rendered cost curves`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route}/${width}: comparison overflow`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await comparison.getByRole('spinbutton', { name: 'Horizon / modeled h' }).fill('0');
    assert.equal(await comparison.getByRole('table', { name: 'Policy comparison results' }).count(), 0);
    await comparison.getByRole('button', { name: 'Run comparison', exact: true }).click(); assert.match(await comparison.getByRole('alert').innerText(), /horizon/);
    await comparison.getByRole('button', { name: 'Reset comparison assumptions' }).click();
    await page.getByRole('checkbox', { name: 'Offline coordinate view' }).check(); assert.match(await page.locator('.site-facts').innerText(), /no geographic basemap/);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route}/${width}: page overflow`);
      await semantic.screenshot({ path: fileURLToPath(new URL(`${route ? 'enhanced' : 'standard'}-semantic-${width}.png`, out)) });
    }
    await page.getByRole('button', { name: 'Reset isolated demo' }).click(); assert.equal(await turbine.getAttribute('data-crack-mm'), '45');
    const reloaded = await page.context().newPage(); await reloaded.goto(new URL(route, base).href);
    await reloaded.getByRole('button', { name: 'Pause WT simulation', exact: true }).click();
    const persisted = await session(reloaded); assert.equal(persisted.sessionId, original.sessionId); assert.deepEqual(persisted.events, original.events); assert.deepEqual(persisted.stats, original.stats);
    await reloaded.close();
    await page.getByRole('button', { name: 'Return to saved session' }).click(); await page.waitForTimeout(150);
    const restored = await session(page); assert.equal(restored.sessionId, original.sessionId); assert.deepEqual(restored.stats, original.stats); assert.deepEqual(restored.events, original.events);
    results.push({ route: page.url(), checks: ['Isolated preset and reset / original session restored / reload preservation', 'Whole-simulation pause and completed service', 'Actual WT RDF/SPARQL/SHACL positive and negative cases / resource failure and retry / evidence export', '31-feature query and stale result removal', 'Worker comparison / four policies / seven sensitivities / export / invalid-input rejection', 'Cost-series canvas pixels / offline coordinate view / 390 and 320px layout'] });
    await context.close();
  }
  assert.deepEqual(errors, []); writeFileSync(new URL('verification.json', out), JSON.stringify({ base, results, errors }, null, 2) + '\n'); console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
