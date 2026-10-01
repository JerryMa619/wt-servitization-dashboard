import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const base = process.env.DASHBOARD_URL ?? 'https://jerryma619.github.io/wt-servitization-dashboard/';
const results = [];
try {
  for (const path of ['', 'enhanced/']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = new URL(path, base).href;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    const module = page.getByRole('region', { name: 'Ontology and decision evidence' });
    await module.waitFor();
    await module.getByRole('tab', { name: 'Ontology Schema' }).click();
    assert.ok((await module.locator('.ontology-schema-summary').innerText()).includes('50'));
    const sourceUrl = new URL('ontology/sdt_tbox.ttl', base).href;
    const source = await page.request.get(sourceUrl);
    assert.equal(source.status(), 200);
    assert.ok((await source.text()).includes('sdt:ServiceActionRecommendation'));
    assert.deepEqual(errors, []);
    results.push({ url, status: response.status(), ontologyModule: 'loaded', schemaClasses: 50, sourceStatus: source.status(), browserErrors: errors });
    await page.close();
  }
  writeFileSync(new URL('../screenshots/ontology/publication.json', import.meta.url), JSON.stringify({ verifiedAt: new Date().toISOString(), results }, null, 2) + '\n');
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
