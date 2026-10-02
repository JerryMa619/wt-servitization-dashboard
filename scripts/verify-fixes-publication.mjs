import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const base = process.env.DASHBOARD_URL ?? 'https://jerryma619.github.io/wt-servitization-dashboard/';
const errors = [], routes = [];
try {
  for (const route of ['', 'enhanced/']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    const response = await page.goto(new URL(route, base).href);
    assert.equal(response.status(), 200);
    await page.getByRole('button', { name: 'Export service history' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Import service history' }).count(), 1);
    const twin = page.getByRole('region', { name: 'Integrated wind turbine digital twin' });
    await twin.getByRole('switch', { name: 'Architecture overlay' }).check();
    assert.equal(await twin.locator('.twin-module-node').count(), 12);
    await page.setViewportSize({ width: 1024, height: 1000 });
    await twin.getByTestId('twin-architecture').evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    await twin.locator('.react-flow__node[data-id="kpi"]').click();
    assert.equal(await twin.locator('.twin-module-detail h3').innerText(), 'Contract KPI');
    if (route) {
      await page.locator('.model-basis summary').click();
      assert.match(await page.locator('.model-basis').innerText(), /ch5-xgb-cqr-2.0/);
      assert.match(await page.locator('.model-basis').innerText(), /no field validation/);
      await page.getByText('Session KPI & Chapter 5 References', { exact: true }).waitFor();
      assert.match(await page.locator('.dashboard').innerText(), /Not estimated/);
      assert.match(await page.locator('.dashboard').innerText(), /not a current latency measurement/);
    }
    await page.locator('.chart-panel').first().scrollIntoViewIfNeeded();
    await page.locator('.echarts-for-react canvas').first().waitFor();
    routes.push({ url: page.url(), status: response.status(), architectureNodes: 12, checks: ['Saved history toolbar', 'Responsive UE reachability', 'Lazy chart rendered', ...(route ? ['Model version / heuristic scope', 'Separate session/reference KPI', 'Reference latency scope'] : [])] });
    await page.close();
  }
  assert.deepEqual(errors, []);
  const out = new URL('../screenshots/fixes/', import.meta.url);
  mkdirSync(out, { recursive: true });
  writeFileSync(new URL('publication.json', out), JSON.stringify({ verifiedAt: new Date().toISOString(), routes, errors }, null, 2) + '\n');
  console.log(JSON.stringify(routes, null, 2));
} finally { await browser.close(); }
