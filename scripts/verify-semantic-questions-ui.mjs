import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:4173/wt-servitization-dashboard/';
const published = !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname);
const environment = published ? 'public' : new URL(base).pathname === '/' ? 'development' : 'production-preview';
const out = new URL(`../screenshots/semantic-questions/${environment === 'production-preview' ? '' : `${environment}/`}`, import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const errors = [], results = [];
const hash = text => createHash('sha256').update(text).digest('hex');
try {
  for (const route of ['', 'enhanced/']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.addInitScript(() => {
      const interval = window.setInterval.bind(window), timeout = window.setTimeout.bind(window);
      window.setInterval = (handler, ms, ...args) => interval(ms === 1400 ? () => { if (!window.__holdSemanticCapture) handler(...args); } : handler, ms === 1400 ? 100 : ms, ...args);
      window.setTimeout = (handler, ms, ...args) => timeout(handler, ms === 30000 && window.__fastQuestionTimeout ? 350 : ms, ...args);
    });
    const page = await context.newPage();
    page.on('pageerror', e => { if (!e.message.includes('fixture semantic worker failure')) errors.push(e.message); });
    await page.route('**/*.tile.openstreetmap.org/**', r => r.abort());
    await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const controls = page.getByRole('region', { name: 'WT viva controls' });
    const ontology = page.getByRole('region', { name: 'Ontology and decision evidence' });
    const semantic = page.getByRole('region', { name: 'WT executable semantic validation' });
    const session = () => page.evaluate(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith('wt-servitization-session-v1:'));
      return JSON.parse(localStorage.getItem(key));
    });
    await controls.waitFor();
    const before = (await session()).cursor;
    await ontology.getByRole('tab', { name: 'Semantic Check', exact: true }).click();
    await semantic.waitFor();
    await page.waitForTimeout(350);
    assert.ok((await session()).cursor > before, 'Entering Semantic Check does not pause WT');
    const shapeRoute = '**/ontology/wt-shapes.ttl';
    await page.route(shapeRoute, async r => { await new Promise(resolve => setTimeout(resolve, 1500)); try { await r.continue(); } catch {} });
    const queryCursor = (await session()).cursor;
    await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL', exact: true }).click();
    await semantic.getByTestId('wt-shacl-result').waitFor({ timeout: 45000 });
    const afterDelayedQueryCursor = (await session()).cursor;
    assert.ok(afterDelayedQueryCursor > queryCursor + 4, 'DT advances while the question executes');
    assert.match(await controls.innerText(), /Running/);
    await page.unroute(shapeRoute);
    const download = async () => {
      const pending = page.waitForEvent('download');
      await semantic.getByRole('button', { name: 'Evidence + hashes', exact: true }).click();
      return JSON.parse(readFileSync(await (await pending).path(), 'utf8'));
    };
    const first = await download();
    assert.equal(first.datasetSHA256, hash(first.datasetTTL));
    assert.equal(first.snapshotSHA256, hash(JSON.stringify(first.snapshot)));
    assert.equal(first.querySHA256, hash(first.query));
    assert.equal(first.rowsSHA256, hash(JSON.stringify(first.rows)));
    assert.equal(first.reportSHA256, hash(first.reportTTL));
    assert.equal(first.answerEvidenceSHA256, hash(JSON.stringify(first.evidenceProof)));
    const answer = await semantic.getByTestId('wt-semantic-answer').innerText();
    await page.waitForTimeout(600);
    assert.equal(await semantic.getByTestId('wt-semantic-answer').innerText(), answer, 'Answer does not disappear or drift with live data');
    assert.deepEqual(await download(), first, 'Export retains exact captured evidence');
    const ids = await semantic.getByRole('combobox', { name: 'WT semantic question' }).locator('option').evaluateAll(options => options.map(option => option.value));
    assert.equal(ids.length, 14);
    for (const id of ids) {
      await semantic.getByRole('combobox', { name: 'WT semantic question' }).selectOption(id);
      await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL', exact: true }).click();
      await semantic.getByTestId('wt-shacl-result').waitFor({ timeout: 30000 });
      const evidence = await download();
      assert.equal(evidence.questionId, id);
      assert.ok(evidence.conforms, `${id}: ${JSON.stringify(evidence.violations)}`);
      if (id === 'features') assert.equal(evidence.rows.length, 31);
      if (id === 'authorisation') assert.equal(evidence.answer.status, 'insufficient-evidence');
    }
    assert.equal(await semantic.locator('[aria-label="Recent semantic answers"] button').count(), 5);
    await page.route(shapeRoute, async r => { await new Promise(resolve => setTimeout(resolve, 1500)); try { await r.continue(); } catch {} });
    // Submit in the observed phase without a slow auto-scroll crossing accelerated service ticks.
    const phase = await page.waitForFunction(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith('wt-servitization-session-v1:'));
      const saved = JSON.parse(localStorage.getItem(key));
      const button = document.querySelector('.wt-semantic .semantic-submit-actions button');
      if (saved.latest.serviceMode !== 'in-downtime' || saved.latest.elapsedDowntimeH !== 0 || !button || button.disabled) return false;
      button.click();
      return { completedServices: saved.stats.completedServices };
    }, null, { timeout: 30000 });
    const servicesBeforeQuestion = (await phase.jsonValue()).completedServices;
    await semantic.getByTestId('wt-shacl-result').waitFor();
    assert.equal((await download()).snapshot.reading.serviceMode, 'in-downtime', 'Question snapshot was captured during the intervention');
    const servicesAfterQuestion = (await session()).stats.completedServices;
    assert.ok(servicesAfterQuestion > servicesBeforeQuestion, 'An active service completes while a question is executing');
    await page.unroute(shapeRoute);
    await semantic.getByRole('tab', { name: 'Natural language', exact: true }).click();
    const ask = async input => {
      await semantic.getByRole('textbox', { name: 'Natural language question' }).fill(input);
      await semantic.getByRole('button', { name: 'Ask question', exact: true }).click();
    };
    await ask('当前裂纹长度是多少？');
    await semantic.getByTestId('wt-shacl-result').waitFor();
    const chinese = await download(); assert.equal(chinese.questionId, 'condition');
    assert.match(await semantic.getByTestId('wt-semantic-answer').innerText(), new RegExp(String(chinese.snapshot.reading.crackMm)));
    await ask('Which eligible service has the lowest TCS?');
    await semantic.getByTestId('wt-shacl-result').waitFor(); assert.equal((await download()).questionId, 'cheapest');
    for (const input of ['Which feature is most important?', 'What is WT-99 RUL?', 'SELECT * WHERE {?s ?p ?o}', 'What is the crack and RUL?']) {
      await ask(input);
      assert.match(await semantic.getByTestId('wt-question-interpretation').innerText(), /Outside supported scope|Clarification required/);
      assert.equal(await semantic.getByTestId('wt-shacl-result').count(), 0);
    }
    await semantic.getByRole('tab', { name: 'Competency questions', exact: true }).click();
    await semantic.getByRole('combobox', { name: 'WT semantic question' }).selectOption('evidence');
    for (const defect of ['missing-unit', 'missing-evidence']) {
      await semantic.getByRole('combobox', { name: 'WT validation case' }).selectOption(defect);
      await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL', exact: true }).click();
      await semantic.getByTestId('wt-shacl-result').waitFor();
      assert.match(await semantic.getByTestId('wt-shacl-result').innerText(), /^NON-CONFORMING/);
      assert.equal((await download()).answer.status, 'blocked');
    }
    await semantic.getByRole('combobox', { name: 'WT validation case' }).selectOption('none');
    await page.route(shapeRoute, r => r.fulfill({ status: 503, body: 'fixture unavailable shapes' }));
    await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL', exact: true }).click();
    await semantic.getByRole('alert').waitFor(); assert.match(await semantic.getByRole('alert').innerText(), /503/);
    await page.unroute(shapeRoute);
    await page.route(shapeRoute, async r => { await new Promise(resolve => setTimeout(resolve, 1200)); try { await r.continue(); } catch {} });
    await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL', exact: true }).click();
    await semantic.getByRole('button', { name: 'Cancel semantic question', exact: true }).click();
    await page.waitForTimeout(1400);
    assert.match(await semantic.getByRole('alert').innerText(), /cancelled/);
    assert.equal(await semantic.getByTestId('wt-shacl-result').count(), 0, 'Cancelled response is not shown later');
    await page.evaluate(() => { window.__fastQuestionTimeout = true; });
    await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL', exact: true }).click();
    await semantic.getByRole('alert').waitFor(); assert.match(await semantic.getByRole('alert').innerText(), /30 seconds/);
    await page.evaluate(() => { window.__fastQuestionTimeout = false; });
    await page.unroute(shapeRoute);
    await page.getByRole('button', { name: 'Pause WT simulation', exact: true }).click();
    const pausedCursor = (await session()).cursor;
    await semantic.getByRole('button', { name: 'Run RDF / SHACL / SPARQL', exact: true }).click();
    await semantic.getByTestId('wt-shacl-result').waitFor(); await page.waitForTimeout(250);
    assert.equal((await session()).cursor, pausedCursor, 'A question also preserves an explicit operator pause');
    await page.getByRole('button', { name: 'Play WT simulation', exact: true }).click();
    await ontology.getByRole('tab', { name: 'Live Graph', exact: true }).click();
    await ontology.getByRole('button', { name: 'Freeze graph snapshot', exact: true }).click();
    await ontology.getByRole('tab', { name: 'Semantic Check', exact: true }).click();
    await semantic.getByRole('tab', { name: 'Natural language', exact: true }).click();
    await ask('What is the current RUL?');
    assert.match(await semantic.getByTestId('wt-question-interpretation').innerText(), /frozen\/historical/);
    await semantic.getByRole('button', { name: 'Use live evidence', exact: true }).click();
    await ask('What is the current RUL?'); await semantic.getByTestId('wt-shacl-result').waitFor();
    // Running/service assertions are complete; hold test ticks only to avoid screenshot layout shifts above this panel.
    await page.evaluate(() => { window.__holdSemanticCapture = true; });
    await page.waitForTimeout(200);
    const name = route ? 'enhanced' : 'standard';
    await semantic.screenshot({ path: fileURLToPath(new URL(`${name}-answer-desktop.png`, out)) });
    assert.ok(await semantic.locator('[aria-label="Recent semantic answers"] button').count() <= 5);
    for (const width of [820, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px page overflow`);
      assert.ok(await semantic.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${width}px semantic overflow`);
    }
    await semantic.screenshot({ path: fileURLToPath(new URL(`${name}-answer-320.png`, out)) });
    results.push({ route: page.url(), presets: ids.length, queryCursor, afterDelayedQueryCursor, servicesBeforeQuestion, servicesAfterQuestion, checks: ['WT advances entering and executing questions', 'Active service completes during a delayed question', 'All 14 preset queries / real worker', 'Immutable answer/export hashes while live data changes', 'Chinese and English question routing', 'Abstention / clarification / scope guards', 'Negative SHACL copies block answers', 'HTTP failure / cancellation / timeout / retry', 'Operator pause retained', 'Frozen-vs-current ambiguity and explicit live return', '820/390/320px layout'] });
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(new URL('verification.json', out), JSON.stringify({ verifiedAt: new Date().toISOString(), environment, screenshotTiming: 'Test WT ticks held only for final static images, after running/service assertions completed.', results, errors }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
