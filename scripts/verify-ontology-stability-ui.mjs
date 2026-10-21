import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173/';
const reproduce = process.argv.includes('--reproduce');
const published = !['localhost', '127.0.0.1'].includes(new URL(base).hostname);
const out = new URL(published ? '../screenshots/ontology-stability/public/' : '../screenshots/ontology-stability/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const errors = [], results = [];
try {
  for (const route of reproduce ? ['enhanced/'] : ['', 'enhanced/']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } });
    await context.addInitScript(() => { const original = window.setInterval.bind(window); window.setInterval = (handler, ms, ...args) => original(handler, ms === 1400 ? 100 : ms, ...args); });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*.tile.openstreetmap.org/**', r => r.abort());
    await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const module = page.getByRole('region', { name: 'Ontology and decision evidence' });
    await module.waitFor({ timeout: 120000 });
    await page.getByRole('combobox', { name: 'WT viva case' }).selectOption('service');
    await page.getByRole('button', { name: 'Play WT simulation', exact: true }).click();
    await page.locator('.service-run.completed').waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: 'Pause WT simulation', exact: true }).click();
    await module.getByRole('tab', { name: 'Decision Trace', exact: true }).click();
    await module.getByRole('button', { name: 'View graph', exact: true }).click();
    await module.locator('.react-flow__node[data-id="execution"]').waitFor();
    assert.ok(await module.locator('.react-flow__node[data-id="execution"]').count());
    const before = await module.locator('.react-flow__node').count();
    await module.getByRole('button', { name: 'Resume live graph', exact: true }).click();
    await page.waitForTimeout(250);
    const after = await module.locator('.react-flow__node').count();
    const prefix = route ? 'enhanced' : 'standard';
    if (reproduce) {
      await module.screenshot({ path: fileURLToPath(new URL(after === 0 ? 'before-empty.png' : 'diagnostic-nonempty.png', out)) });
      const evidence = { before, after, focused: await module.getByRole('button', { name: 'Focus selected entity and neighbors' }).getAttribute('aria-pressed'), inspector: await module.locator('.ontology-inspector').innerText(), errors };
      writeFileSync(new URL(after === 0 ? 'reproduction.json' : 'diagnostic.json', out), JSON.stringify(evidence, null, 2) + '\n');
      console.log(JSON.stringify(evidence));
      continue;
    }
    assert.ok(after >= 11, 'An absent historical execution must not filter every live node away');
    assert.match(await module.locator('.ontology-inspector').innerText(), /No matching evidence/);
    const graph = module.getByTestId('ontology-graph');
    const visible = async () => {
      await page.waitForFunction(() => {
        const flow = document.querySelector('#ontology-module .react-flow');
        if (!flow) return false;
        const viewport = flow.querySelector('.react-flow__viewport');
        if (!viewport || /NaN|Infinity/.test(viewport.getAttribute('style') ?? '')) return false;
        const bounds = flow.getBoundingClientRect();
        return bounds.width > 0 && [...flow.querySelectorAll('.react-flow__node')].some(node => {
          const r = node.getBoundingClientRect();
          return getComputedStyle(node).visibility !== 'hidden' && r.width > 0 && r.height > 0 && r.right > bounds.left && r.left < bounds.right && r.bottom > bounds.top && r.top < bounds.bottom;
        });
      });
    };
    await visible();
    await module.locator('.react-flow').evaluate(el => { el.dataset.stabilityToken = 'persistent-instance'; });
    for (const id of ['observation', 'sensor', 'blade', 'rul', 'recommendation']) {
      const target = module.locator(`.react-flow__node[data-id="${id}"]`);
      if (!await target.count()) await module.getByRole('button', { name: 'Focus selected entity and neighbors' }).click();
      await module.locator(`.react-flow__node[data-id="${id}"]`).click(); await visible();
      assert.equal(await module.locator('.react-flow').getAttribute('data-stability-token'), 'persistent-instance', 'Entity selection must not remount ReactFlow');
    }
    if (await module.getByRole('button', { name: 'Focus selected entity and neighbors' }).getAttribute('aria-pressed') === 'true') await module.getByRole('button', { name: 'Focus selected entity and neighbors' }).click();
    await visible();
    const beforeZoom = await module.locator('.react-flow__viewport').getAttribute('style');
    await module.locator('.react-flow__controls-zoomin').click();
    await page.waitForFunction(previous => document.querySelector('#ontology-module .react-flow__viewport')?.getAttribute('style') !== previous, beforeZoom);
    await page.waitForTimeout(120);
    const camera = await module.locator('.react-flow__viewport').getAttribute('style');
    await page.getByRole('button', { name: 'Play WT simulation', exact: true }).click(); await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Pause WT simulation', exact: true }).click();
    assert.equal(await module.locator('.react-flow__viewport').getAttribute('style'), camera, 'Telemetry updates preserve the user camera');
    await page.evaluate(() => {
      window.__ontologySoak = { samples: 0, blanks: 0, frame: 0 };
      const sample = () => {
        const host = document.querySelector('#ontology-module .react-flow');
        window.__ontologySoak.samples++;
        const bounds = host?.getBoundingClientRect();
        const visible = bounds && bounds.width > 0 && [...host.querySelectorAll('.react-flow__node')].some(node => {
          const r = node.getBoundingClientRect();
          return getComputedStyle(node).visibility !== 'hidden' && r.width > 0 && r.height > 0 && r.right > bounds.left && r.left < bounds.right && r.bottom > bounds.top && r.top < bounds.bottom;
        });
        if (!visible) {
          window.__ontologySoak.blanks++;
          if (!window.__ontologySoak.firstBlank) window.__ontologySoak.firstBlank = { bounds: bounds?.toJSON(), node: host?.querySelector('.react-flow__node')?.getBoundingClientRect().toJSON(), nodeStyle: host?.querySelector('.react-flow__node')?.getAttribute('style'), visibility: getComputedStyle(host.querySelector('.react-flow__node')).visibility, viewport: host?.querySelector('.react-flow__viewport')?.getAttribute('style'), nodes: host?.querySelectorAll('.react-flow__node').length };
        }
        window.__ontologySoak.frame = requestAnimationFrame(sample);
      }; sample();
    });
    await page.getByRole('button', { name: 'Play WT simulation', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.ontology-event-select option').length >= 4, { timeout: 30000 });
    await page.getByRole('button', { name: 'Pause WT simulation', exact: true }).click();
    const soak = await page.evaluate(() => { cancelAnimationFrame(window.__ontologySoak.frame); return window.__ontologySoak; });
    if (soak.blanks) writeFileSync(new URL('soak-diagnostic.json', out), JSON.stringify(soak, null, 2) + '\n');
    assert.equal(soak.blanks, 0, 'Continuous service cycles must retain visible graph nodes');
    for (let i = 0; i < 8; i++) {
      await module.getByRole('tab', { name: ['DT Mapping', 'Data Records', 'Ontology Schema', 'Decision Trace'][i % 4], exact: true }).click();
      await module.getByRole('tab', { name: 'Live Graph', exact: true }).click(); await visible();
    }
    await graph.evaluate(el => { el.style.display = 'none'; }); await page.waitForTimeout(100);
    await graph.evaluate(el => { el.style.display = ''; }); await visible();
    for (const width of [1440, 320, 390, 820, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await visible();
      await module.scrollIntoViewIfNeeded();
      assert.ok(await module.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      if ([320, 390, 1440].includes(width)) await module.screenshot({ path: fileURLToPath(new URL(`${prefix}-${width}.png`, out)) });
    }
    results.push(`${prefix}: absent-execution focus recovery, persistent graph instance, camera retention, three service events with ${soak.samples} sampled frames and zero frames without visible nodes, repeated tabs, hidden/visible canvas and desktop/mobile resizing passed.`);
    await context.close();
  }
  if (!reproduce && !published) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', e => { if (!e.message.includes('Injected ontology renderer fixture')) errors.push(e.message); });
    await page.route('**/*.tile.openstreetmap.org/**', r => r.abort());
    await context.addInitScript(() => { window.__ontologyRendererFixture = true; });
    await page.route('**/src/ontology/OntologyPanel.tsx*', async route => {
      const response = await route.fetch(); const body = await response.text();
      assert.ok(body.includes('const n = data.entity;'), 'Local fault fixture targets only the known custom entity renderer');
      await route.fulfill({ response, body: body.replace('const n = data.entity;', 'if (window.__ontologyRendererFixture) throw new Error("Injected ontology renderer fixture"); const n = data.entity;') });
    });
    await page.goto(new URL('enhanced/', base).href, { waitUntil: 'domcontentloaded' });
    const module = page.getByRole('region', { name: 'Ontology and decision evidence' });
    await module.getByRole('alert').filter({ hasText: 'Graph temporarily unavailable' }).waitFor();
    assert.ok(await module.locator('.ontology-inspector').count(), 'A renderer failure must not remove the snapshot inspector or dashboard');
    await module.screenshot({ path: fileURLToPath(new URL('injected-error-local.png', out)) });
    await page.evaluate(() => { window.__ontologyRendererFixture = false; });
    await module.getByRole('button', { name: 'Retry graph', exact: true }).click();
    await module.locator('.react-flow__node').first().waitFor();
    assert.equal(await module.getByRole('alert').count(), 0);
    results.push('Local-only injected renderer fault: graph error contained, snapshot inspector retained and Retry graph recovered. No production debug hook added.');
    await context.close();
  }
  if (!reproduce) { assert.deepEqual(errors, []); writeFileSync(new URL('verification.json', out), JSON.stringify({ base, checkedAt: new Date().toISOString(), results, errors }, null, 2) + '\n'); console.log(results.join('\n')); }
} finally { await browser.close(); }
