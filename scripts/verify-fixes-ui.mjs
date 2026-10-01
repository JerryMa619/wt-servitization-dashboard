import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const output = new URL('../screenshots/fixes/', import.meta.url);
mkdirSync(output, { recursive: true });
const errors = [], results = [];
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173/';
async function saved(page) { return page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith('wt-servitization-session-v1:'))))); }
async function download(page, button) {
  const pending = page.waitForEvent('download'); await button.click();
  const file = await pending;
  return JSON.parse(readFileSync(await file.path(), 'utf8'));
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__simulationPaused = sessionStorage.getItem('pause-test') === 'yes';
    const interval = window.setInterval.bind(window);
    window.setInterval = (handler, delay, ...args) => interval(delay === 1400 ? () => { if (!window.__simulationPaused) handler(...args); } : handler, delay === 1400 ? 60 : delay, ...args);
  });
  await page.goto(new URL('enhanced/', base).href);
  await page.waitForFunction(() => {
    const raw = localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith('wt-servitization-session-v1:')));
    const state = raw && JSON.parse(raw);
    if (state?.events[0]?.status === 'in-progress' && state.events[0].progress.elapsedH > 0) { window.__simulationPaused = true; return true; }
    return false;
  }, { timeout: 30000 });
  const partial = await saved(page);
  await page.getByRole('button', { name: 'Input scenario' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton', { name: 'GPS latitude' }).fill('91');
  assert.equal(await dialog.getByRole('button', { name: 'Apply to dashboard' }).isDisabled(), true);
  await dialog.getByRole('spinbutton', { name: 'GPS latitude' }).fill('52');
  await dialog.getByRole('spinbutton', { name: 'Wind speed m/s' }).fill('0');
  await dialog.getByRole('button', { name: 'Apply to dashboard' }).click();
  await page.waitForFunction(() => document.querySelector('.data-source')?.textContent.includes('Manual scenario mode'));
  const interrupted = await saved(page);
  assert.equal(interrupted.events[0].status, 'interrupted');
  assert.equal(interrupted.events[0].after, undefined);
  assert.deepEqual(interrupted.stats, partial.stats);
  assert.equal(interrupted.manual.rpm, 0); assert.equal(interrupted.manual.power, 0);
  await page.evaluate(() => { window.__simulationPaused = false; });
  await page.waitForTimeout(300);
  assert.deepEqual((await saved(page)).stats, interrupted.stats);
  results.push('Single input bounds, zero-wind output, manual interruption and held simulation clock passed.');

  const exported = await download(page, page.getByRole('button', { name: 'Export service history' }));
  assert.deepEqual(exported.events, interrupted.events);
  await page.evaluate(() => sessionStorage.setItem('pause-test', 'yes'));
  await page.reload();
  await page.getByRole('region', { name: 'Integrated wind turbine digital twin' }).waitFor();
  assert.deepEqual((await saved(page)).events, exported.events);
  assert.deepEqual((await saved(page)).stats, exported.stats);
  const input = page.getByLabel('History JSON file');
  await input.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":9}') });
  await page.getByText('Unsupported or invalid dashboard history.', { exact: true }).waitFor();
  assert.deepEqual((await saved(page)).events, exported.events);
  await input.setInputFiles({ name: 'history.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await page.waitForFunction(() => !document.querySelector('.history-toolbar')?.textContent.includes('Unsupported or invalid'));
  results.push('History export, reload, validated import and rejection without evidence loss passed.');

  const twin = page.getByRole('region', { name: 'Integrated wind turbine digital twin' });
  await twin.getByRole('switch', { name: 'Architecture overlay' }).check();
  await twin.locator('.react-flow__node[data-id="control"]').click();
  await twin.getByRole('button', { name: 'Ontology', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.ontology-inspector h3')?.textContent === 'No matching evidence');
  results.push('Missing execution entity is explicitly unavailable, not replaced by unrelated asset evidence.');
  for (const width of [1920, 1440, 1024, 820, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await twin.scrollIntoViewIfNeeded();
    const canvas = twin.getByTestId('twin-architecture');
    await canvas.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    await twin.locator('.react-flow__node[data-id="kpi"]').click();
    assert.equal(await twin.locator('.twin-module-detail h3').innerText(), 'Contract KPI');
    const bounds = await twin.locator('.react-flow').evaluate((flow) => {
      const r = flow.getBoundingClientRect();
      return [...flow.querySelectorAll('.twin-module-node')].every((node) => { const n = node.getBoundingClientRect(); return n.left >= r.left && n.right <= r.right + 1 && n.top >= r.top && n.bottom <= r.bottom + 1; });
    });
    assert.ok(bounds, `${width} architecture clipped internally`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width} page overflow`);
    if ([1440, 390].includes(width)) await twin.screenshot({ path: fileURLToPath(new URL(`repaired-architecture-${width}.png`, output)) });
  }
  results.push('Resizing 1920 -> 390 px preserves all architecture modules and reachable UE controls.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.model-basis summary').click();
  assert.match(await page.locator('.model-basis').innerText(), /wt-demo-2.0/);
  assert.match(await page.locator('.model-basis').innerText(), /not calibrated quantiles/);
  await page.locator('.model-basis').scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL('model-quality.png', output)) });
  await page.getByText('Session KPI & Chapter 5 References', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL('kpi-reference.png', output)) });
  assert.match(await page.locator('.dashboard').innerText(), /Not estimated/);
  results.push('Heuristic model basis and separate session/reference KPI scope are visible.');

  await page.getByRole('button', { name: 'Resume simulation' }).click();
  await page.evaluate(() => { window.__simulationPaused = false; });
  await page.waitForFunction(() => {
    const raw = localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith('wt-servitization-session-v1:')));
    const state = raw && JSON.parse(raw);
    if (state?.events.filter((event) => event.status === 'completed').length >= 2 && state.events[0].status !== 'in-progress') { window.__simulationPaused = true; return true; }
    return false;
  }, { timeout: 30000 });
  const records = (await saved(page)).events.filter((event) => event.status === 'completed');
  const a = records[1], b = records[0];
  await twin.getByRole('combobox', { name: 'Wind turbine event replay' }).selectOption(a.id);
  const slider = twin.getByRole('slider', { name: 'Recorded replay step' });
  await slider.fill(await slider.getAttribute('max'));
  await twin.getByRole('button', { name: 'Blade evidence', exact: true }).click();
  const ontology = page.getByRole('region', { name: 'Ontology and decision evidence' });
  await page.waitForFunction((id) => document.querySelector('.ontology-event-select select')?.value === id, a.id);
  await ontology.getByRole('tab', { name: 'Decision Trace' }).click();
  await ontology.locator('.ontology-event-list > button').first().click();
  await ontology.getByRole('button', { name: 'View graph', exact: true }).click();
  await page.waitForFunction((id) => document.querySelector('.ontology-event-select select')?.value === id, b.id);
  const graph = await download(page, ontology.getByRole('button', { name: 'Download evidence JSON' }));
  assert.equal(graph.execution.id, b.id); assert.equal(graph.snapshot.id, b.before.id);
  assert.equal(graph.snapshot.reading.crackMm, b.before.reading.crackMm);
  results.push('Switching from event A repaired frame to event B clears old frozen evidence; exported graph matches B.');

  const pinnedPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  pinnedPage.on('pageerror', (e) => errors.push(e.message));
  const seed = { ...exported, manual: null, latest: { ...b.before.reading, crackMm: 45, serviceMode: undefined }, stats: { observationHours: 1000, totalDowntimeH: 240, completedServices: 30 }, events: Array.from({ length: 30 }, (_, i) => ({ ...structuredClone(b), id: `seed-${i}`, before: { ...structuredClone(b.before), id: `seed-${i}-before` }, during: [], after: { ...structuredClone(b.after), id: `seed-${i}-after` } })) };
  await pinnedPage.addInitScript((seed) => {
    localStorage.setItem(`wt-servitization-session-v1:${seed.asset}`, JSON.stringify(seed));
    window.__simulationPaused = true;
    const interval = window.setInterval.bind(window);
    window.setInterval = (handler, delay, ...args) => interval(delay === 1400 ? () => { if (!window.__simulationPaused) handler(...args); } : handler, delay === 1400 ? 60 : delay, ...args);
  }, seed);
  await pinnedPage.goto(base);
  const pinnedTwin = pinnedPage.getByRole('region', { name: 'Integrated wind turbine digital twin' });
  await pinnedTwin.getByRole('combobox', { name: 'Wind turbine event replay' }).selectOption('seed-29');
  const pinnedSlider = pinnedTwin.getByRole('slider', { name: 'Recorded replay step' });
  await pinnedSlider.fill(await pinnedSlider.getAttribute('max'));
  await pinnedTwin.getByRole('button', { name: 'Blade evidence', exact: true }).click();
  const pinnedOntology = pinnedPage.getByRole('region', { name: 'Ontology and decision evidence' });
  await pinnedPage.waitForFunction(() => document.querySelector('.ontology-event-select select')?.value === 'seed-29');
  await pinnedPage.evaluate(() => { window.__simulationPaused = false; });
  await pinnedPage.waitForFunction(() => {
    const raw = localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith('wt-servitization-session-v1:')));
    if (raw && !JSON.parse(raw).events.some((event) => event.id === 'seed-29')) { window.__simulationPaused = true; return true; } return false;
  });
  const pinnedGraph = await download(pinnedPage, pinnedOntology.getByRole('button', { name: 'Download evidence JSON' }));
  assert.equal(pinnedGraph.execution.id, 'seed-29'); assert.equal(pinnedGraph.snapshot.id, 'seed-29-after');
  assert.equal(await pinnedTwin.getByRole('combobox', { name: 'Wind turbine event replay' }).inputValue(), 'seed-29');
  await pinnedPage.close();
  results.push('Frozen ontology and turbine replay retain pinned execution/frame evidence after the 30-event log prunes it.');
  await page.waitForTimeout(6100);
  assert.match(await page.locator('.dashboard').innerText(), /stale after 5 s/);
  const quality = page.locator('.quality-row').filter({ hasText: 's age' });
  assert.ok((await quality.getAttribute('class')).includes('warn'));
  results.push('Freshness becomes a warning when simulated observations stop arriving.');
  const chart = page.locator('.echarts-for-react').first();
  await page.locator('.chart-card, .chart-panel').first().scrollIntoViewIfNeeded().catch(async () => { await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); });
  await chart.waitFor();
  const canvases = page.locator('.echarts-for-react canvas');
  assert.ok(await canvases.count() > 0);
  const colors = await canvases.first().evaluate((canvas) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const set = new Set(); for (let i = 0; i < pixels.length; i += 40) set.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`); return set.size;
  });
  assert.ok(colors > 20, 'Lazy chart canvas is blank');
  results.push('Lazy-loaded chart renders nonblank canvas pixels.');
  assert.deepEqual(errors, []);
  writeFileSync(new URL('verification.json', output), JSON.stringify({ verifiedAt: new Date().toISOString(), base, results, errors }, null, 2) + '\n');
  console.log(results.join('\n'));
} finally { await browser.close(); }
