import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173/';
const published = !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname);
const output = new URL(published ? '../screenshots/ome-interfaces/public/' : '../screenshots/ome-interfaces/', import.meta.url);
mkdirSync(output, { recursive: true });
const results = [], errors = [];
try {
  for (const route of ['', 'enhanced/']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const interval = window.setInterval.bind(window);
      window.__interfaceSamples = [];
      window.setInterval = (handler, delay, ...args) => interval(delay === 1400 ? () => { if (!window.__holdTicks) handler(...args); } : handler, delay === 1400 ? 80 : delay, ...args);
      interval(() => {
        const twin = document.getElementById('twin-workspace');
        const data = twin?.querySelector('[data-interface="IF-01"]');
        const control = twin?.querySelector('[data-interface="IF-02"]');
        if (!data || !control) return;
        window.__interfaceSamples.push({ stage: twin.dataset.workflowStage, data: data.dataset.active, control: control.dataset.active, visible: [...twin.querySelectorAll('.twin-module-node')].filter((node) => getComputedStyle(node).visibility === 'visible').length });
      }, 25);
    });
    await page.goto(new URL(route, base).href);
    const twin = page.locator('#twin-workspace');
    const interfaces = twin.getByRole('group', { name: 'OME and DCDCE interfaces' });
    await interfaces.waitFor();
    await page.waitForFunction(() => {
      const key = Object.keys(localStorage).find((key) => key.startsWith('wt-servitization-session-v1:'));
      const saved = key ? JSON.parse(localStorage.getItem(key)) : null;
      if (saved?.stats.completedServices >= 2 && document.getElementById('twin-workspace').dataset.workflowStage === 'decision') {
        window.__holdTicks = true;
        return true;
      }
      return false;
    }, { timeout: 40000 });
    const samples = await page.evaluate(() => window.__interfaceSamples);
    for (const sample of samples) {
      assert.equal(sample.data, 'true', 'Observation interface persists across service cycles');
      assert.equal(sample.control, String(sample.stage === 'downtime'), `Control mismatch at ${sample.stage}`);
    }
    const measured = samples.findIndex((sample) => sample.visible === 12);
    assert.ok(measured >= 0);
    assert.ok(samples.slice(measured).every((sample) => sample.visible === 12), 'Measured framework nodes remain visible');
    for (const stage of ['monitor', 'decision', 'downtime', 'result']) assert.ok(samples.some((sample) => sample.stage === stage), stage);
    const data = twin.locator('[data-interface="IF-01"]');
    const control = twin.locator('[data-interface="IF-02"]');
    await data.click();
    assert.equal(await twin.locator('.twin-module-detail h3').innerText(), 'Data collection');
    assert.match(await twin.locator('.twin-module-detail').innerText(), /Interface IF-01/);
    await control.click();
    assert.equal(await twin.locator('.twin-module-detail h3').innerText(), 'Device control');
    assert.match(await twin.locator('.twin-module-detail').innerText(), /No physical actuator connected/);
    await page.getByRole('button', { name: 'Pause WT simulation', exact: true }).click();
    assert.equal(await data.getAttribute('data-moving'), 'false');
    assert.equal(await twin.locator('.react-flow__edge.animated').count(), 0);
    assert.match(await interfaces.innerText(), /Paused frame/);
    const name = route ? 'enhanced' : 'standard';
    await twin.screenshot({ path: fileURLToPath(new URL(`${name}-desktop.png`, output)) });
    const replay = twin.getByRole('combobox', { name: 'Wind turbine event replay' });
    const eventId = await replay.locator('option').filter({ hasText: '/ completed' }).first().getAttribute('value');
    assert.ok(eventId);
    await replay.selectOption(eventId);
    const slider = twin.getByRole('slider', { name: 'Recorded replay step' });
    await slider.fill('2');
    assert.equal(await control.getAttribute('data-active'), 'true');
    assert.equal(await control.getAttribute('data-moving'), 'false');
    assert.match(await control.innerText(), /RPM \/ power targets = 0/);
    assert.match(await interfaces.innerText(), /Recorded frame/);
    assert.equal(await twin.locator('[aria-label="Wind turbine physical animation"]').getAttribute('data-rpm'), '0');
    const frozen = await data.innerText();
    await page.waitForTimeout(200);
    assert.equal(await data.innerText(), frozen, 'Replay interface uses the selected historical frame');
    await twin.screenshot({ path: fileURLToPath(new URL(`${name}-downtime-replay.png`, output)) });
    await slider.fill(await slider.getAttribute('max'));
    assert.equal(await control.getAttribute('data-active'), 'false');
    for (const width of [820, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px page overflow`);
      assert.deepEqual(await interfaces.locator('button, small, em').evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent)), [], `${width}px interface text overflow`);
      await data.click();
      assert.equal(await twin.locator('.twin-module-detail h3').innerText(), 'Data collection');
    }
    await interfaces.screenshot({ path: fileURLToPath(new URL(`${name}-320.png`, output)) });
    await twin.getByRole('switch', { name: 'Architecture overlay' }).uncheck();
    assert.equal(await interfaces.count(), 0);
    await twin.getByRole('switch', { name: 'Architecture overlay' }).check();
    assert.equal(await twin.locator('[data-interface]').count(), 2);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await twin.getByRole('button', { name: 'Play event replay', exact: true }).click();
    const animation = await data.locator('i').evaluate((element) => getComputedStyle(element, '::after').animationName);
    assert.equal(animation, 'none', 'Reduced motion respected');
    results.push({ route: page.url(), samples: samples.length, stages: [...new Set(samples.map((sample) => sample.stage))], checks: ['Two completed cycles with directional interface state', 'Module selection and hardware boundary', 'Global pause', 'Historical downtime and result', '320/390/820px layouts', 'Overlay preference', 'Reduced motion'] });
    await page.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(new URL('verification.json', output), JSON.stringify({ verifiedAt: new Date().toISOString(), results, errors }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
