import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173/';
const published = !['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname);
const out = new URL(published ? '../screenshots/simulation-recovery/public/' : '../screenshots/simulation-recovery/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const errors = [], results = [];
try {
  for (const route of ['', 'enhanced/']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.addInitScript(() => {
      const interval = window.setInterval.bind(window);
      window.__recoveryStages = [];
      window.setInterval = (handler, ms, ...args) => interval(ms === 1400 ? () => { if (!window.__holdTicks) handler(...args); } : handler, ms === 1400 ? 90 : ms, ...args);
      interval(() => {
        const twin = document.querySelector('#twin-workspace');
        if (twin) window.__recoveryStages.push(twin.dataset.workflowStage);
      }, 40);
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*.tile.openstreetmap.org/**', r => r.abort());
    await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const twin = page.locator('#twin-workspace');
    const ontology = page.getByRole('region', { name: 'Ontology and decision evidence' });
    const physical = twin.getByRole('region', { name: 'Wind turbine physical animation' });
    const read = () => page.evaluate(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith('wt-servitization-session-v1:'));
      return JSON.parse(localStorage.getItem(key));
    });
    await physical.waitFor({ timeout: 90000 });
    await page.waitForFunction(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith('wt-servitization-session-v1:'));
      const saved = key && JSON.parse(localStorage.getItem(key));
      if (saved?.stats.completedServices >= 2 && document.querySelector('#twin-workspace')?.dataset.workflowStage === 'decision') { window.__holdTicks = true; return true; }
      return false;
    }, { timeout: 40000 });
    const before = await read();
    const preservedEvents = before.events.filter(event => event.status === 'completed');
    assert.ok(preservedEvents.length >= 2);
    async function holdManual() {
      const pause = page.getByRole('button', { name: 'Pause WT simulation', exact: true });
      if (await pause.count()) await pause.click();
      await page.getByRole('button', { name: 'Input scenario', exact: true }).click();
      const input = page.getByRole('dialog', { name: 'Input WT scenario data' });
      await input.getByLabel('Crack length mm', { exact: true }).fill('26.5');
      await input.getByRole('button', { name: 'Apply to dashboard', exact: true }).click();
      await twin.getByText('HELD SCENARIO', { exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('#twin-workspace .turbine-panel')?.dataset.crackMm === '26.5');
      assert.equal(await physical.getAttribute('data-crack-mm'), '26.5');
      assert.match(await page.locator('.demo-toolbar [role="status"]').innerText(), /Manual scenario held/);
      await page.waitForFunction(() => {
        const key = Object.keys(localStorage).find(key => key.startsWith('wt-servitization-session-v1:'));
        return JSON.parse(localStorage.getItem(key)).manual?.crackMm === 26.5;
      });
      return structuredClone((await read()).manual);
    }
    async function progressFromManual(command) {
      await command();
      await page.evaluate(() => { window.__holdTicks = false; });
      await page.waitForFunction(() => {
        const key = Object.keys(localStorage).find(key => key.startsWith('wt-servitization-session-v1:'));
        const saved = JSON.parse(localStorage.getItem(key));
        if (!saved.manual && saved.latest.source === 'auto-simulation' && saved.latest.crackMm > 26.5) { window.__holdTicks = true; return true; }
        return false;
      });
      const current = await read();
      assert.ok(current.latest.crackMm > 26.5 && current.latest.crackMm < 35, 'Continues from the held input, not an earlier stream point');
      assert.match(await page.locator('.demo-toolbar [role="status"]').innerText(), /Running/);
      return current.latest.crackMm;
    }
    const held = await holdManual();
    const prefix = route ? 'enhanced' : 'standard';
    await twin.screenshot({ path: fileURLToPath(new URL(`${prefix}-held-26-5.png`, out)) });
    const headerCrack = await progressFromManual(() => page.getByRole('button', { name: 'Resume simulation', exact: true }).click());
    assert.equal(held.crackMm, 26.5);
    assert.equal(held.source, 'manual-input');

    await holdManual();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await twin.getByText('HELD SCENARIO', { exact: true }).waitFor();
    const restoredCursor = (await read()).cursor;
    await page.waitForTimeout(350);
    assert.equal((await read()).cursor, restoredCursor, 'Reloaded manual evidence stays held until an explicit resume');
    const playCrack = await progressFromManual(() => page.getByRole('button', { name: 'Play WT simulation', exact: true }).click());

    await holdManual();
    await ontology.getByRole('tab', { name: 'Data Records', exact: true }).click();
    const recordCrack = await progressFromManual(() => ontology.getByRole('button', { name: 'Run WT', exact: true }).click());

    await holdManual();
    await ontology.getByRole('tab', { name: 'Live Graph', exact: true }).click();
    await ontology.getByRole('button', { name: 'Freeze graph snapshot', exact: true }).click();
    assert.match(await ontology.locator('.ontology-context').innerText(), /Frozen snapshot/);
    await ontology.getByRole('tab', { name: 'Data Records', exact: true }).click();
    await ontology.getByRole('button', { name: 'Pause data capture', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await ontology.getByRole('button', { name: 'Export data records JSON', exact: true }).click();
    const records = JSON.parse(readFileSync(await (await downloadPromise).path(), 'utf8')).payload.records;
    assert.ok(records.some(record => record.snapshot.reading.source === 'manual-input' && record.snapshot.reading.crackMm === 26.5));
    const recordsBefore = await ontology.locator('.lineage-record-list tbody tr').count();
    await twin.getByRole('combobox', { name: 'Wind turbine event replay' }).selectOption(preservedEvents[0].id);
    await twin.getByText('EVENT REPLAY', { exact: true }).waitFor();
    const recoveredCrack = await progressFromManual(() => page.getByRole('button', { name: 'Resume live DT', exact: true }).click());
    await twin.getByText('LIVE VIEW', { exact: true }).waitFor();
    assert.equal(await twin.getByRole('combobox', { name: 'Wind turbine event replay' }).inputValue(), 'live');
    await ontology.getByRole('button', { name: 'Freeze graph snapshot', exact: true }).waitFor();
    assert.doesNotMatch(await ontology.locator('.ontology-context').innerText(), /Frozen snapshot|Historical event/);
    await ontology.getByRole('tab', { name: 'Data Records', exact: true }).click();
    assert.equal(await ontology.getByRole('button', { name: 'Resume data capture', exact: true }).count(), 1, 'Recovery does not change independent capture preference');
    assert.equal(await ontology.locator('.lineage-record-list tbody tr').count(), recordsBefore);
    for (const event of preservedEvents) assert.deepEqual((await read()).events.find(saved => saved.id === event.id), event, 'Completed evidence is unchanged');
    assert.ok((await read()).stats.observationHours >= before.stats.observationHours);
    await page.evaluate(() => { window.__holdTicks = false; });
    await page.waitForFunction((completed) => {
      const key = Object.keys(localStorage).find(key => key.startsWith('wt-servitization-session-v1:'));
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved.stats.completedServices > completed && saved.latest.serviceMode === 'post-service') { window.__holdTicks = true; return true; }
      return false;
    }, before.stats.completedServices, { timeout: 30000 });
    const after = await read();
    assert.ok(after.stats.totalDowntimeH > before.stats.totalDowntimeH, 'Service downtime continues after recovery');
    for (const stage of ['monitor', 'decision', 'downtime', 'result']) assert.ok((await page.evaluate(() => window.__recoveryStages)).includes(stage), stage);
    await twin.screenshot({ path: fileURLToPath(new URL(`${prefix}-recovered-service.png`, out)) });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px overflow`);
      await page.getByRole('region', { name: 'WT viva controls' }).screenshot({ path: fileURLToPath(new URL(`${prefix}-controls-${width}.png`, out)) });
    }
    results.push({ route: page.url(), headerCrack, playCrack, recordCrack, recoveredCrack, completedBefore: before.stats.completedServices, completedAfter: after.stats.completedServices, checks: ['Held manual + global pause resumes', 'Starts from 26.5 mm', 'Reloaded manual input resumes via Play', 'Data Records Run WT resumes', 'One command clears manual/pause/replay/frozen ontology', 'Independent capture preference retained', 'Completed service evidence preserved', 'New service/downtime/post-service loop', '390/320px controls fit'] });
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(new URL('verification.json', out), JSON.stringify({ verifiedAt: new Date().toISOString(), results, errors }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
