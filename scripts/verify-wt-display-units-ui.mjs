import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:4173/wt-servitization-dashboard/';
const published = !['127.0.0.1', 'localhost'].includes(new URL(base).hostname);
const out = new URL(`../screenshots/wt-display-units/${published ? 'public/' : ''}`, import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const results = [], errors = [];
try {
  for (const route of ['', 'enhanced/']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.addInitScript(() => {
      const interval = window.setInterval.bind(window);
      window.setInterval = (handler, ms, ...args) => interval(handler, ms === 1400 ? 100 : ms, ...args);
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*.tile.openstreetmap.org/**', r => r.abort());
    await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith('wt-servitization-session-v1:'));
      return key && JSON.parse(localStorage.getItem(key)).stats.completedServices >= 1;
    }, null, { timeout: 30000 });
    await page.getByRole('button', { name: 'Pause WT simulation', exact: true }).click();
    const session = () => page.evaluate(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith('wt-servitization-session-v1:'));
      return JSON.parse(localStorage.getItem(key));
    });
    const before = await session();
    const checkVisible = async label => assert.doesNotMatch(await page.locator('body').innerText(), /pseudo/i, label);
    await checkVisible('Overview labels');
    assert.match(await page.getByRole('region', { name: 'Live WT metrics' }).innerText(), /model h/);
    if (route) {
      await page.locator('.model-basis summary').click();
      await checkVisible('Expanded model basis / artifact target display');
      assert.match(await page.locator('.model-basis').innerText(), /synthetic model hours/);
    }
    await page.getByRole('button', { name: 'Input scenario', exact: true }).click();
    const input = page.getByRole('dialog', { name: 'Input WT scenario data' });
    for (const label of ['RUL lower / model h', 'RUL P50 / model h', 'RUL upper / model h']) {
      assert.equal(await input.getByRole('spinbutton', { name: label, exact: true }).count(), 1);
    }
    await input.locator('.feature-window-input summary').click();
    await checkVisible('Scenario input and prediction scope');
    const name = route ? 'enhanced' : 'standard';
    await input.screenshot({ path: fileURLToPath(new URL(`${name}-input.png`, out)) });
    await input.getByRole('button', { name: 'Close input window', exact: true }).click();
    const ontology = page.getByRole('region', { name: 'Ontology and decision evidence' });
    for (const tab of ['Live Graph', 'DT Mapping', 'Data Records', 'Decision Trace']) {
      await ontology.getByRole('tab', { name: tab, exact: true }).click();
      await checkVisible(tab);
    }
    await ontology.getByRole('tab', { name: 'Semantic Check', exact: true }).click();
    const semantic = page.getByRole('region', { name: 'WT executable semantic validation' });
    await semantic.getByRole('combobox', { name: 'WT semantic question' }).selectOption('rul');
    await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL', exact: true }).click();
    await semantic.getByTestId('wt-shacl-result').waitFor({ timeout: 45000 });
    await checkVisible('Semantic answer and result headers');
    assert.match(await semantic.getByTestId('wt-semantic-answer').innerText(), /synthetic model h/);
    const pending = page.waitForEvent('download');
    await semantic.getByRole('button', { name: 'Evidence + hashes', exact: true }).click();
    const evidence = JSON.parse(readFileSync(await (await pending).path(), 'utf8'));
    assert.ok(evidence.conforms);
    assert.match(evidence.datasetTTL, /PseudoHour/);
    assert.match(evidence.datasetTTL, /PseudoRULEstimate/);
    assert.equal(Number(evidence.rows[0].point), evidence.snapshot.reading.rulP50);
    assert.equal(evidence.datasetSHA256, createHash('sha256').update(evidence.datasetTTL).digest('hex'));
    assert.deepEqual((await session()).latest, before.latest, 'Presentation changes and inspection do not mutate the held WT reading');
    await semantic.screenshot({ path: fileURLToPath(new URL(`${name}-semantic.png`, out)) });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await checkVisible(`${width}px labels`);
    }
    await semantic.screenshot({ path: fileURLToPath(new URL(`${name}-semantic-320.png`, out)) });
    results.push({ route: page.url(), capturedP50: evidence.snapshot.reading.rulP50, completedServices: before.stats.completedServices,
      checks: ['No pseudo wording in ordinary overview, expanded model basis, input, graph, mapping, records, trace or answers', 'Model-hour labels and synthetic/field-validation boundaries retained', 'Model values unchanged by inspection', 'Legacy RDF identifiers, SHACL/SPARQL and export hash retained', 'Desktop / 390 / 320 px'] });
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(new URL('verification.json', out), JSON.stringify({ verifiedAt: new Date().toISOString(), results, errors,
    scope: 'Generated simulation only. Explicitly paused after a completed service for stable wording screenshots; test-only accelerated WT ticks. Raw technical RDF/query identifiers intentionally retain legacy names.' }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
