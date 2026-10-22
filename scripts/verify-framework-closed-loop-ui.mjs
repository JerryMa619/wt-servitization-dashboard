import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173/';
const published = !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname);
const output = new URL(published ? '../screenshots/framework-closed-loop/public/' : '../screenshots/framework-closed-loop/', import.meta.url);
mkdirSync(output, { recursive: true });
const results = [], errors = [];
try {
  for (const route of ['', 'enhanced/']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const interval = window.setInterval.bind(window);
      window.__loopSamples = [];
      window.setInterval = (handler, delay, ...args) => interval(delay === 1400 ? () => { if (!window.__holdTicks) handler(...args); } : handler, delay === 1400 ? 80 : delay, ...args);
      interval(() => {
        const twin = document.getElementById('twin-workspace');
        const data = twin?.querySelector('[data-testid="rf__edge-workflow-ome-collection"]');
        const control = twin?.querySelector('[data-testid="rf__edge-workflow-control-ome"]');
        if (!data || !control) return;
        window.__loopRotor ??= twin.querySelector('.blades');
        const visible = [...twin.querySelectorAll('.twin-module-node, .react-flow__node-physical')].filter((node) => getComputedStyle(node).visibility === 'visible' && node.getBoundingClientRect().width > 0).length;
        window.__loopSamples.push({ stage: twin.dataset.workflowStage, data: data.classList.contains('twin-flow-active'), control: control.classList.contains('twin-flow-active'), visible });
      }, 25);
    });
    await page.goto(new URL(route, base).href);
    const twin = page.locator('#twin-workspace');
    const canvas = twin.getByTestId('twin-architecture');
    const physical = twin.locator('.react-flow__node[data-id="ome"]');
    await physical.waitFor();
    assert.equal(await twin.locator('.react-flow').count(), 1, 'Physical WT and DT share one graph');
    assert.equal(await physical.getByRole('region', { name: 'Wind turbine physical animation' }).count(), 1, 'Actual turbine animation is the OME node');
    assert.match(await physical.innerText(), /OME \/ Physical WT/);
    assert.doesNotMatch(await physical.innerText(), /Simulated WT/i);
    assert.equal(await twin.locator('.twin-interfaces').count(), 0, 'No detached OME / DCDCE strip');
    const cycle = ['ome', 'collection', 'condition', 'rul', 'tcs', 'recommendation', 'execution', 'control', 'ome'];
    for (let i = 1; i < cycle.length; i++) {
      const edge = twin.getByTestId(`rf__edge-workflow-${cycle[i - 1]}-${cycle[i]}`);
      await edge.waitFor({ state: 'attached' });
      assert.ok(await edge.locator('.react-flow__edge-path').evaluate((path) => path.getTotalLength() > 0 && getComputedStyle(path).visibility === 'visible' && parseFloat(getComputedStyle(path).strokeWidth) > 0));
    }
    await page.waitForFunction(() => {
      const key = Object.keys(localStorage).find((key) => key.startsWith('wt-servitization-session-v1:'));
      const saved = key ? JSON.parse(localStorage.getItem(key)) : null;
      if (saved?.stats.completedServices >= 2 && document.getElementById('twin-workspace').dataset.workflowStage === 'decision') { window.__holdTicks = true; return true; }
      return false;
    }, { timeout: 40000 });
    const samples = await page.evaluate(() => window.__loopSamples);
    for (const sample of samples) {
      assert.equal(sample.data, true, 'Physical observations remain connected through both service cycles');
      assert.equal(sample.control, sample.stage === 'downtime', `Feedback state at ${sample.stage}`);
    }
    const measured = samples.findIndex((sample) => sample.visible === 13);
    assert.ok(measured >= 0);
    assert.ok(samples.slice(measured).every((sample) => sample.visible === 13), 'Physical WT and all 12 modules remain visible');
    for (const stage of ['monitor', 'decision', 'downtime', 'result']) assert.ok(samples.some((sample) => sample.stage === stage), stage);
    assert.ok(await page.evaluate(() => window.__loopRotor?.isConnected && window.__loopRotor === document.querySelector('#twin-workspace .blades')), 'Telemetry updates do not remount the turbine');
    const rotorAngle = await physical.locator('.blades').getAttribute('style');
    await page.waitForTimeout(250);
    assert.notEqual(await physical.locator('.blades').getAttribute('style'), rotorAngle, 'Physical WT animation continues after service completion');
    const geometry = await twin.evaluate((root) => {
      function distance(edgeId, nodeId, handleId, atEnd) {
        const path = root.querySelector(`[data-testid="rf__edge-${edgeId}"] .react-flow__edge-path`);
        const handle = root.querySelector(`.react-flow__node[data-id="${nodeId}"] [data-handleid="${handleId}"]`).getBoundingClientRect();
        const local = path.getPointAtLength(atEnd ? path.getTotalLength() : 0);
        const point = new DOMPoint(local.x, local.y).matrixTransform(path.getScreenCTM());
        return Math.hypot(point.x - handle.x - handle.width / 2, point.y - handle.y - handle.height / 2);
      }
      return [distance('workflow-ome-collection', 'ome', 'source-right', false), distance('workflow-ome-collection', 'collection', 'target-left', true), distance('workflow-control-ome', 'control', 'source-left', false), distance('workflow-control-ome', 'ome', 'target-right', true)];
    });
    assert.ok(geometry.every((distance) => distance < 12), `Paths must touch actual OME / DCDCE ports: ${geometry}`);
    const data = twin.getByTestId('rf__edge-workflow-ome-collection');
    const control = twin.getByTestId('rf__edge-workflow-control-ome');
    await data.locator('.react-flow__edge-interaction').click();
    assert.equal(await twin.locator('.twin-module-detail h3').innerText(), 'Data collection');
    await control.locator('.react-flow__edge-interaction').click();
    assert.equal(await twin.locator('.twin-module-detail h3').innerText(), 'Device control');
    assert.match(await twin.locator('.twin-module-detail').innerText(), /OME \/ Physical WT/);
    await page.getByRole('button', { name: 'Pause WT simulation', exact: true }).click();
    assert.equal(await twin.locator('.react-flow__edge.animated').count(), 0);
    assert.ok(await physical.locator('.twin-ome-content').evaluate((element) => element.scrollHeight <= element.clientHeight), 'All default physical controls fit without clipping');
    const name = route ? 'enhanced' : 'standard';
    await twin.screenshot({ path: fileURLToPath(new URL(`${name}-desktop.png`, output)) });
    const replay = twin.getByRole('combobox', { name: 'Wind turbine event replay' });
    const eventId = await replay.locator('option').filter({ hasText: '/ completed' }).first().getAttribute('value');
    await replay.selectOption(eventId);
    const slider = twin.getByRole('slider', { name: 'Recorded replay step' });
    await slider.fill('2');
    assert.ok((await control.getAttribute('class')).includes('twin-flow-active'));
    assert.equal(await physical.locator('[aria-label="Wind turbine physical animation"]').getAttribute('data-rpm'), '0');
    assert.match(await twin.locator('.twin-canvas-toolbar').innerText(), /Recorded frame/);
    await twin.screenshot({ path: fileURLToPath(new URL(`${name}-downtime-replay.png`, output)) });
    const frozen = await physical.innerText();
    await page.waitForTimeout(200);
    assert.equal(await physical.innerText(), frozen, 'OME uses recorded evidence, not current background data');
    await slider.fill(await slider.getAttribute('max'));
    assert.ok(!(await control.getAttribute('class')).includes('twin-flow-active'));
    for (const width of [1024, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px page overflow`);
      await twin.getByRole('button', { name: 'Show digital twin core', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.twin-architecture-canvas').scrollLeft > 300);
      await canvas.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
      await twin.locator('.react-flow__node[data-id="kpi"]').click();
      assert.equal(await twin.locator('.twin-module-detail h3').innerText(), 'Contract KPI');
      await twin.getByRole('button', { name: 'Show Physical WT', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.twin-architecture-canvas').scrollLeft < 1);
    }
    await twin.screenshot({ path: fileURLToPath(new URL(`${name}-320.png`, output)) });
    await twin.getByRole('switch', { name: 'Architecture overlay' }).uncheck();
    assert.equal(await twin.locator('.react-flow').count(), 0);
    assert.equal(await twin.getByRole('region', { name: 'Wind turbine physical animation' }).count(), 1);
    await twin.getByRole('button', { name: 'RUL evidence', exact: true }).click();
    await physical.waitFor();
    assert.equal(await twin.locator('.twin-module-detail h3').innerText(), 'RUL prediction');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await twin.getByRole('button', { name: 'Play event replay', exact: true }).click();
    assert.equal(await data.locator('.react-flow__edge-path').evaluate((element) => getComputedStyle(element).animationName), 'none');
    const bytes = readFileSync(new URL(`${name}-desktop.png`, output));
    const colors = await page.evaluate(async (base64) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data, colors = new Set();
      for (let i = 0; i < pixels.length; i += 160) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
      return colors.size;
    }, bytes.toString('base64'));
    assert.ok(colors > 30, 'Rendered workspace has nonblank pixels');
    results.push({ route: page.url(), samples: samples.length, stages: [...new Set(samples.map((sample) => sample.stage))], endpointDistancesPx: geometry, screenshotColors: colors, checks: ['Actual Physical WT animation in one connected framework', 'Complete OME-DCDCE-DTE-UE-control-OME topology', 'Two completed service cycles / 13 visible nodes', 'Rotor not remounted and continues after service', 'Paths anchored to actual ports', 'Edge selection', 'Global pause / selected-frame replay', '1024/820/390/320px layouts and whole-graph navigation', 'Overlay / RUL navigation', 'Reduced motion / screenshot pixels'] });
    await page.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(new URL('verification.json', output), JSON.stringify({ verifiedAt: new Date().toISOString(), results, errors }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
