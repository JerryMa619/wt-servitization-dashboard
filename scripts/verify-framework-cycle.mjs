import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173/';
const published = !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname);
const output = new URL(published ? '../screenshots/framework/public/' : '../screenshots/framework/', import.meta.url);
mkdirSync(output, { recursive: true });
const results = [], errors = [];
try {
  for (const route of ['', 'enhanced/']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const interval = window.setInterval.bind(window);
      window.__frameworkSamples = [];
      window.setInterval = (handler, delay, ...args) => interval(delay === 1400 ? () => { if (!window.__simulationPaused) handler(...args); } : handler, delay === 1400 ? 60 : delay, ...args);
      interval(() => {
        const twin = document.getElementById('twin-workspace');
        if (!twin) return;
        const state = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith('wt-servitization-session-v1:'))) ?? 'null');
        const modules = [...twin.querySelectorAll('.twin-module-node')];
        window.__frameworkSamples.push({ stage: twin.dataset.workflowStage, modules: modules.length, visibleModules: modules.filter((node) => getComputedStyle(node).visibility === 'visible').length, edges: twin.querySelectorAll('.react-flow__edge.twin-flow-active').length, animated: twin.querySelectorAll('.react-flow__edge.animated').length, completion: state?.stats.completedServices ?? 0 });
      }, 25);
    });
    await page.goto(new URL(route, base).href);
    const twin = page.getByRole('region', { name: 'Integrated wind turbine digital twin' });
    await twin.getByTestId('twin-architecture').waitFor();
    assert.equal(await twin.getByRole('switch', { name: 'Architecture overlay' }).isChecked(), true);
    await page.waitForFunction(() => {
      const samples = window.__frameworkSamples;
      const last = samples.at(-1);
      if (last?.completion >= 2 && !['result', 'downtime'].includes(last.stage)) { window.__simulationPaused = true; return true; }
      return false;
    }, { timeout: 30000 });
    const samples = await page.evaluate(() => window.__frameworkSamples);
    // ReactFlow initializes edges after mounting; evaluate all subsequent observations.
    const start = samples.findIndex((sample) => sample.modules === 12 && sample.edges > 0);
    assert.ok(start >= 0);
    for (const sample of samples.slice(start)) {
      assert.equal(sample.modules, 12, `Framework vanished at ${sample.stage}`);
      assert.equal(sample.visibleModules, 12, `Framework nodes hidden at ${sample.stage}`);
      assert.ok(sample.edges >= 2, `Flow disappeared: ${JSON.stringify(sample)}; first samples ${JSON.stringify(samples.slice(0, 12))}`);
      assert.ok(sample.animated >= 2, `Live flow stopped at ${sample.stage}`);
    }
    assert.ok(samples.some((sample) => sample.stage === 'downtime'));
    assert.ok(samples.some((sample) => sample.stage === 'result'));
    assert.ok(samples.some((sample) => sample.completion >= 2 && sample.stage === 'decision'));
    const rotor = twin.locator('.blades');
    const angle = await rotor.getAttribute('style');
    await page.waitForTimeout(250);
    assert.notEqual(await rotor.getAttribute('style'), angle, 'Rotor stopped after completion');
    const name = route ? 'enhanced' : 'standard';
    await twin.screenshot({ path: fileURLToPath(new URL(`${name}-after-two-cycles.png`, output)) });
    for (const width of [1024, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await twin.getByTestId('twin-architecture').evaluate((element) => { element.scrollLeft = element.scrollWidth; });
      await twin.locator('.react-flow__node[data-id="kpi"]').click();
      assert.equal(await twin.locator('.twin-module-detail h3').innerText(), 'Contract KPI');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await twin.screenshot({ path: fileURLToPath(new URL(`${name}-mobile.png`, output)) });
    await twin.getByRole('switch', { name: 'Architecture overlay' }).uncheck();
    await page.evaluate(() => { window.__simulationPaused = false; });
    await page.waitForTimeout(500);
    assert.equal(await twin.getByTestId('twin-architecture').count(), 0, 'Explicit hide preference should not be overridden by a tick');
    await twin.getByRole('switch', { name: 'Architecture overlay' }).check();
    await twin.getByTestId('twin-architecture').waitFor();
    results.push({ route: page.url(), completedCycles: 2, samples: samples.length, stages: [...new Set(samples.map((sample) => sample.stage))], checks: ['Framework remains mounted', 'Animated data flow through two completed services', 'Rotor resumes', 'Desktop/mobile UE reachable', 'Only user can hide framework'] });
    await page.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(new URL('verification.json', output), JSON.stringify({ verifiedAt: new Date().toISOString(), results, errors }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
