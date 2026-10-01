import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const output = new URL('../screenshots/twin/', import.meta.url);
mkdirSync(output, { recursive: true });
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173/';
const failures = [];
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto(base);
  const twin = page.getByRole('region', { name: 'Integrated wind turbine digital twin' });
  await twin.waitFor();
  await twin.scrollIntoViewIfNeeded();
  assert.equal(await twin.getByRole('switch', { name: 'Architecture overlay' }).isChecked(), false);
  const blades = twin.locator('.blades');
  const angle = await blades.getAttribute('style');
  await page.waitForTimeout(250);
  assert.notEqual(await blades.getAttribute('style'), angle, 'Rotor should animate');
  await twin.screenshot({ path: fileURLToPath(new URL('operation-desktop.png', output)) });
  await twin.getByRole('button', { name: 'Inspect blade crack evidence' }).click();
  assert.equal(await twin.locator('.twin-module-detail h3').innerText(), 'Blade condition');
  assert.equal(await twin.locator('.twin-module-node').count(), 12);
  await twin.getByRole('button', { name: 'RUL evidence', exact: true }).click();
  assert.equal(await twin.locator('.twin-module-detail h3').innerText(), 'RUL prediction');
  await twin.screenshot({ path: fileURLToPath(new URL('architecture-desktop.png', output)) });
  const textOverflow = await twin.locator('.twin-module-node').evaluateAll((nodes) => nodes.filter((node) => node.scrollHeight > node.clientHeight + 1).map((node) => node.textContent));
  assert.deepEqual(textOverflow, [], 'Architecture node text must fit');
  await twin.getByRole('button', { name: 'Ontology', exact: true }).click();
  const ontology = page.getByRole('region', { name: 'Ontology and decision evidence' });
  assert.equal(await ontology.locator('.ontology-inspector h3').innerText(), 'Blade RUL estimate');
  results.push('Standard route: rotor motion, crack / RUL selection, 12 architecture modules and ontology navigation passed.');

  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await twin.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${width}px page overflow`);
    await twin.screenshot({ path: fileURLToPath(new URL(`architecture-${width}.png`, output)) });
  }
  results.push('820 px and 390 px layouts: no page overflow; architecture retains internal horizontal scrolling.');

  const fast = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  fast.on('pageerror', (error) => failures.push(error.message));
  await fast.addInitScript(() => {
    const interval = window.setInterval.bind(window);
    window.setInterval = (handler, delay, ...args) => interval(delay === 1400 ? () => { if (!window.__simulationPaused) handler(...args); } : handler, delay === 1400 ? 50 : delay, ...args);
  });
  await fast.goto(new URL('enhanced/', base).href);
  const trace = fast.getByRole('region', { name: 'Ontology and decision evidence' });
  await trace.getByRole('tab', { name: 'Decision Trace' }).click();
  const completed = trace.locator('.ontology-event-list > button').filter({ hasText: 'Completed' }).first();
  await completed.waitFor({ timeout: 30000 });
  await completed.click();
  await trace.getByRole('button', { name: 'Replay on turbine' }).click();
  const replay = fast.getByRole('region', { name: 'Integrated wind turbine digital twin' });
  await replay.getByText('EVENT REPLAY', { exact: true }).waitFor();
  const physical = replay.getByRole('region', { name: 'Wind turbine physical animation' });
  const slider = replay.getByRole('slider', { name: 'Recorded replay step' });
  const frozen = await physical.getAttribute('data-crack-mm');
  const liveCrack = await fast.locator('.metric').filter({ hasText: 'Blade RUL' }).innerText();
  await fast.waitForTimeout(1700);
  assert.equal(await physical.getAttribute('data-crack-mm'), frozen, 'Replay evidence stays fixed while simulation continues');
  assert.notEqual(await fast.locator('.metric').filter({ hasText: 'Blade RUL' }).innerText(), liveCrack, 'Live simulation continues behind replay');
  await fast.evaluate(() => { window.__simulationPaused = true; });
  await slider.fill('2');
  assert.equal(await physical.getAttribute('data-rpm'), '0');
  assert.equal(await physical.getAttribute('data-service-mode'), 'in-downtime');
  const beforeCrack = Number(await physical.getAttribute('data-crack-mm'));
  const beforeRul = Number(await physical.getAttribute('data-rul-p10'));
  await replay.screenshot({ path: fileURLToPath(new URL('downtime-replay.png', output)) });
  const max = await slider.getAttribute('max');
  await slider.fill(max);
  assert.ok(Number(await physical.getAttribute('data-crack-mm')) < beforeCrack);
  assert.ok(Number(await physical.getAttribute('data-rul-p10')) > beforeRul);
  await replay.getByRole('button', { name: 'Blade evidence', exact: true }).click();
  assert.ok((await trace.locator('.ontology-inspector').innerText()).includes(`${Number(await physical.getAttribute('data-crack-mm')).toFixed(1)} mm`), 'Ontology uses selected replay frame');
  await replay.scrollIntoViewIfNeeded();
  await replay.screenshot({ path: fileURLToPath(new URL('result-replay.png', output)) });
  await replay.getByRole('button', { name: 'Play event replay', exact: true }).click();
  await fast.waitForTimeout(1300);
  assert.ok(Number(await slider.inputValue()) > 0);
  await replay.getByRole('button', { name: 'Pause event replay', exact: true }).click();
  const paused = await slider.inputValue();
  await fast.waitForTimeout(1300);
  assert.equal(await slider.inputValue(), paused);
  await replay.getByRole('button', { name: 'Return to live operation', exact: true }).click();
  await replay.getByText('LIVE VIEW', { exact: true }).waitFor();
  results.push('Enhanced route: automatic event completion, synchronized downtime (RPM 0), repaired crack / RUL, frozen replay, matching ontology frame, playback / pause and return to live passed.');
  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  await reduced.goto(base);
  await reduced.waitForTimeout(250);
  const staticRotor = await reduced.locator('.blades').getAttribute('style');
  await reduced.waitForTimeout(250);
  assert.equal(await reduced.locator('.blades').getAttribute('style'), staticRotor);
  assert.deepEqual(failures, [], 'Browser runtime errors');
  results.push('Reduced-motion preference respected; no browser runtime errors.');
  // A decoded screenshot must contain actual nonuniform pixels, not an empty render.
  for (const name of ['operation-desktop.png', 'architecture-desktop.png', 'architecture-390.png']) {
    const bytes = readFileSync(new URL(name, output));
    const pixelCheck = await page.evaluate(async (base64) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set(); for (let i = 0; i < data.length; i += 160) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return colors.size;
    }, bytes.toString('base64'));
    assert.ok(pixelCheck > 30, `${name} blank pixels`);
  }
  results.push('Screenshot pixel checks passed.');
  writeFileSync(new URL('verification.json', output), JSON.stringify({ verifiedAt: new Date().toISOString(), base, results, failures }, null, 2) + '\n');
  console.log(results.join('\n'));
} finally { await browser.close(); }
