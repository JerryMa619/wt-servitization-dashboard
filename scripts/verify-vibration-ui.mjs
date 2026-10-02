import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173/';
const published = !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname);
const output = new URL(published ? '../screenshots/vibration/public/' : '../screenshots/vibration/', import.meta.url);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const results = [], errors = [];
async function scenario(page, wind, crack) {
  await page.getByRole('button', { name: 'Input scenario', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton', { name: 'Wind speed m/s', exact: true }).fill(String(wind));
  await dialog.getByRole('spinbutton', { name: 'Crack length mm', exact: true }).fill(String(crack));
  await dialog.getByRole('button', { name: 'Apply to dashboard', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
}
async function savedStats(page) { return page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith('wt-servitization-session-v1:')))).stats); }
async function pixels(region) {
  return region.locator('canvas').evaluate((canvas) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0, signature = 0;
    const colors = [[72, 201, 176], [231, 181, 87], [223, 133, 173]];
    for (let i = 0; i < pixels.length; i += 4) {
      if (colors.some((c) => Math.abs(c[0] - pixels[i]) + Math.abs(c[1] - pixels[i + 1]) + Math.abs(c[2] - pixels[i + 2]) < 30)) count++;
      signature = (signature + pixels[i] * (i + 1) + pixels[i + 1]) >>> 0;
    }
    return { count, signature };
  });
}
try {
  for (const route of ['', 'enhanced/']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (error) => errors.push(error.message));
    let archiveRequests = 0;
    page.on('request', (request) => { if (request.url().includes('/data/vibration-waveforms.json')) archiveRequests++; });
    await page.goto(new URL(route, base).href);
    await page.getByRole('region', { name: 'Live WT metrics' }).waitFor();
    await page.waitForTimeout(200);
    assert.equal(archiveRequests, 0, 'Waveform archive must not be part of the initial above-fold load');
    await scenario(page, 8, 30);
    const rms = page.getByRole('region', { name: 'Blade Vibration RMS', exact: true });
    const kurtosis = page.getByRole('region', { name: 'Blade Vibration Kurtosis', exact: true });
    const waveform = page.getByRole('region', { name: 'Blade Acceleration Waveform', exact: true });
    await waveform.scrollIntoViewIfNeeded();
    await waveform.locator('.waveform-caption[data-reference-id^="vib_C3"]').waitFor();
    assert.match(await rms.innerText(), /X \/ flapwise, Y \/ edgewise, Z \/ auxiliary \/ g/);
    assert.match(await kurtosis.innerText(), /Pearson \/ unitless \/ focused scale/);
    assert.match(await waveform.innerText(), /Archived simulated reference/);
    assert.match(await waveform.innerText(), /not synchronised with model features/);
    await rms.scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
    assert.ok((await pixels(rms)).count > 30); assert.ok((await pixels(kurtosis)).count > 30);
    await waveform.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    assert.ok((await pixels(waveform)).count > 100);
    const stats = await savedStats(page);
    await waveform.getByRole('button', { name: 'Play archived reference', exact: true }).click();
    await page.waitForFunction(() => Number(document.querySelector('.waveform-caption')?.getAttribute('data-offset')) > 0);
    const first = await pixels(waveform);
    await page.waitForTimeout(250);
    const next = await pixels(waveform);
    assert.notEqual(first.signature, next.signature, 'Actual canvas waveform must move, not just its label');
    await waveform.getByRole('button', { name: 'Pause archived reference', exact: true }).click();
    const offset = await waveform.locator('.waveform-caption').getAttribute('data-offset');
    await page.waitForTimeout(250);
    assert.equal(await waveform.locator('.waveform-caption').getAttribute('data-offset'), offset);
    assert.deepEqual(await savedStats(page), stats, 'Reference playback must not advance held WT simulation or service accounting');
    await waveform.locator('canvas').hover({ position: { x: 140, y: 100 } });
    await waveform.locator('.vibration-tooltip').waitFor({ state: 'visible' });
    assert.match(await waveform.locator('.vibration-tooltip').innerText(), /g/);
    for (const axis of ['Y', 'Z', 'X']) {
      await waveform.getByRole('radio', { name: `Waveform ${axis} axis`, exact: true }).check();
      assert.equal(await waveform.locator('.waveform-caption').getAttribute('data-axis'), axis);
      await page.waitForTimeout(100); assert.ok((await pixels(waveform)).count > 100);
    }
    const downloadPromise = page.waitForEvent('download');
    await waveform.getByRole('button', { name: 'Download reference excerpt', exact: true }).click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /vib_C3_.*-excerpt\.json$/);
    await download.delete();
    await page.locator('.vibration-grid').screenshot({ path: fileURLToPath(new URL(`${route ? 'enhanced' : 'standard'}-desktop.png`, output)) });
    await scenario(page, 8, 60);
    await waveform.scrollIntoViewIfNeeded();
    await waveform.locator('.waveform-caption[data-reference-id^="vib_C5"]').waitFor();
    await scenario(page, 0, 60);
    await waveform.scrollIntoViewIfNeeded();
    assert.equal(await waveform.getByRole('button', { name: 'Play archived reference', exact: true }).isDisabled(), true);
    assert.match(await waveform.innerText(), /Simulated WT hold/);
    await page.setViewportSize({ width: 390, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.waitForFunction(() => [...document.querySelectorAll('.vibration-grid canvas')].every((canvas) => canvas.getBoundingClientRect().width <= canvas.closest('.chart-panel').getBoundingClientRect().width));
    await page.locator('.vibration-grid').screenshot({ path: fileURLToPath(new URL(`${route ? 'enhanced' : 'standard'}-mobile.png`, output)) });
    results.push({ route: page.url(), checks: ['Separated exact X/Y/Z RMS and kurtosis charts', 'Deferred archive fetch / nonblank colored-series canvas pixels', 'Reference waveform selection / actual moving waveform / pause / axis controls', 'Downloadable excerpt / explicit simulated unsynchronised provenance', 'Reference playback does not change held WT statistics', 'Zero-RPM hold / mobile layout'] });
    await page.close();
  }
  const reduced = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await reduced.goto(base);
  const waveform = reduced.getByRole('region', { name: 'Blade Acceleration Waveform', exact: true });
  await waveform.scrollIntoViewIfNeeded();
  await waveform.locator('.waveform-caption[data-reference-id^="vib_"]').waitFor();
  assert.equal(await waveform.locator('.waveform-caption').getAttribute('data-playing'), 'false');
  await reduced.close();
  const retry = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await retry.route('**/data/vibration-waveforms.json', (route) => route.fulfill({ status: 503, body: 'Unavailable' }));
  await retry.goto(base);
  const retryPanel = retry.getByRole('region', { name: 'Blade Acceleration Waveform', exact: true });
  await retryPanel.scrollIntoViewIfNeeded();
  await retryPanel.getByRole('alert').waitFor();
  await retry.unroute('**/data/vibration-waveforms.json');
  await retryPanel.getByRole('button', { name: 'Retry reference archive', exact: true }).click();
  await retryPanel.locator('.waveform-caption[data-reference-id^="vib_"]').waitFor();
  await retry.close();
  assert.deepEqual(errors, []);
  writeFileSync(new URL('verification.json', output), JSON.stringify({ verifiedAt: new Date().toISOString(), results, extraChecks: ['Reduced-motion playback paused by default', 'Unavailable archive fails closed / retry recovers'], errors }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
