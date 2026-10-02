import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173/';
const published = !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname);
const output = new URL(published ? '../screenshots/instrumentation/public/' : '../screenshots/instrumentation/', import.meta.url);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const errors = [], results = [];
try {
  for (const route of ['', 'enhanced/']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(new URL(route, base).href);
    const twin = page.getByRole('region', { name: 'Integrated wind turbine digital twin' });
    const reference = page.locator('.instrumentation-reference');
    await reference.locator('summary').waitFor();
    assert.match(await reference.locator('summary').innerText(), /Accel 18 Click \(MC3419\)/);
    assert.match(await reference.locator('summary').innerText(), /not connected/);
    await reference.locator('summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await reference.getAttribute('open'), '');
    assert.match(await reference.innerText(), /80% span \/ suction side/);
    assert.match(await reference.innerText(), /not direct sensor measurements/);
    await twin.locator('.react-flow__node[data-id="collection"]').click();
    const detail = twin.locator('.twin-module-detail');
    assert.equal(await detail.locator('h3').innerText(), 'Data collection');
    for (const value of ['Accel 18 Click (MC3419)', 'Anemometer / model not recorded', 'Wind vane / model not recorded', 'hardware not connected', 'tachometer pulses', 'load-current shunt']) assert.ok((await detail.innerText()).includes(value), value);
    assert.equal(await twin.locator('.twin-module-node').count(), 12);
    const rotor = twin.locator('.blades');
    const before = await rotor.getAttribute('style');
    await page.waitForTimeout(250);
    assert.notEqual(await rotor.getAttribute('style'), before, 'Sensor metadata must not stop rotor motion');
    const name = route ? 'enhanced' : 'standard';
    await twin.screenshot({ path: fileURLToPath(new URL(`${name}-desktop.png`, output)) });
    const ontology = page.getByRole('region', { name: 'Ontology and decision evidence' });
    await ontology.locator('.react-flow__node[data-id="sensor"]').click();
    const inspector = ontology.getByRole('complementary', { name: 'Ontology entity details' });
    assert.equal(await inspector.locator('h3').innerText(), 'Accel 18 Click (MC3419)');
    assert.match(await inspector.innerText(), /rig#Accel18-onBlade-A/);
    assert.match(await inspector.innerText(), /no live device identity or owl:sameAs assertion/);
    await inspector.screenshot({ path: fileURLToPath(new URL(`${name}-ontology.png`, output)) });
    for (const width of [1024, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await reference.scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px page overflow`);
      const overflow = await reference.evaluate((element) => [...element.querySelectorAll('strong, dt, dd, summary > span')].filter((child) => child.scrollWidth > child.clientWidth + 1).map((child) => child.textContent));
      assert.deepEqual(overflow, [], `${width}px sensor text overflow`);
    }
    await twin.screenshot({ path: fileURLToPath(new URL(`${name}-mobile.png`, output)) });
    await reference.locator('summary').click();
    assert.equal(await reference.getAttribute('open'), null);
    results.push({ route: page.url(), checks: ['Named sensor reference and keyboard disclosure', 'Placement, connection and derived-output boundaries', 'Auxiliary instrument types without guessed models', 'Ontology source individual distinct from live identity', 'Rotor motion / 12 modules intact', '1440 / 1024 / 390 px layout'] });
    await page.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(new URL('verification.json', output), JSON.stringify({ verifiedAt: new Date().toISOString(), results, errors }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
