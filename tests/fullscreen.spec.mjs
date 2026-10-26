// Fullscreen animation and soundtrack credit. Live data is replaced by fixtures, d3 by the local copy.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.route('**/d3.min.js', (r) => r.fulfill({ path: path.join(here, '..', 'node_modules', 'd3', 'dist', 'd3.min.js'), contentType: 'text/javascript' }));
  await page.route('**/api/wind**', (r) => r.fulfill({ path: path.join(here, 'fixtures', 'wind.json'), contentType: 'application/json' }));
  await page.route('**/api/stations', (r) => r.fulfill({ path: path.join(here, 'fixtures', 'stations.json'), contentType: 'application/json' }));
  await page.route('**/audio/ephemera.mp3', (r) => r.fulfill({ status: 204 }));
});

const stageBox = (page) => page.locator('#wind-stage').boundingBox();
const canvasSize = (page) => page.evaluate(() => {
  const c = document.querySelector('#wind-stage canvas');
  return { cssH: c.clientHeight, cssW: c.clientWidth, inner: window.innerHeight, innerW: window.innerWidth };
});

test('fullscreen button fills the screen and resizes the ribbon', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#wv-title')).toHaveText('Wind Bozen');
  const before = await canvasSize(page);
  expect(before.cssH).toBeLessThan(before.inner);

  await page.click('#wv-fs');
  await expect(page.locator('#wind-stage')).toHaveClass(/is-full/);
  await expect(page.locator('#wv-fs')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await canvasSize(page)).cssH).toBe(before.inner);
  const box = await stageBox(page);
  expect(Math.round(box.width)).toBe(before.innerW);
  expect(Math.round(box.height)).toBe(before.inner);

  // the animation keeps running in fullscreen: the HUD moves / pages change over time
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#wind-stage')).position)).not.toBe('static');

  await page.click('#wv-fs');
  await expect(page.locator('#wind-stage')).not.toHaveClass(/is-full/);
  await expect.poll(async () => (await canvasSize(page)).cssH).toBe(before.cssH);
  expect(errors).toEqual([]);
});

test('F key and double click toggle fullscreen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#wv-title')).toHaveText('Wind Bozen');
  await page.keyboard.press('f');
  await expect(page.locator('#wind-stage')).toHaveClass(/is-full/);
  await page.keyboard.press('f');
  await expect(page.locator('#wind-stage')).not.toHaveClass(/is-full/);
  await page.locator('#wv-canvas-box').dblclick({ position: { x: 40, y: 200 } });
  await expect(page.locator('#wind-stage')).toHaveClass(/is-full/);
});

test('fallback without the Fullscreen API covers the viewport (iPhone)', async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = undefined;
    Element.prototype.webkitRequestFullscreen = undefined;
  });
  await page.setViewportSize({ width: 390, height: 760 });
  await page.goto('/');
  await page.click('#wv-fs');
  await expect(page.locator('#wind-stage')).toHaveClass(/wv-fs/);
  const box = await stageBox(page);
  expect(Math.round(box.width)).toBe(390);
  expect(Math.round(box.height)).toBe(760);
  await page.keyboard.press('Escape');
  await expect(page.locator('#wind-stage')).not.toHaveClass(/wv-fs/);
});

test('soundtrack credit fades in at the start and out again', async ({ page }) => {
  test.setTimeout(45000);
  await page.goto('/');
  const credit = page.locator('#wv-credit');
  await expect(credit).toContainText("Ephemera");
  await expect(credit).toContainText('Scott Buckley');
  await expect(credit).toContainText('CC-BY 4.0');
  await expect(credit).toHaveClass(/is-on/, { timeout: 3000 });
  await expect(credit).toBeVisible();
  // shown for about 9 s, then faded out
  await expect(credit).not.toHaveClass(/is-on/, { timeout: 15000 });
  // permanent attribution in the footer
  await expect(page.locator('#wv-foot')).toContainText("'Ephemera' by Scott Buckley");
});

test('title shows a different language large each time it appears', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#wv-title')).toHaveText('Wind Bozen');
  const title = async () => ({
    big: await page.locator('#wv-flag').getAttribute('aria-label'),
    small: (await page.locator('.wv-t-langs span').allTextContents()).join(' | '),
    kicker: await page.locator('#wv-kicker').textContent()
  });
  const nextTitle = () => page.evaluate(() => { for (let k = 0; k < 5; k++) document.getElementById('wv-pg').click(); });
  // no language codes; a word equal to the big one (or shown twice) is left out
  expect(await title()).toEqual({ big: 'WIND', small: 'Vento', kicker: 'Bozen · Bolzano' });
  await nextTitle();
  expect(await title()).toEqual({ big: 'VENTO', small: 'Wind', kicker: 'Bolzano · Bozen' });
  await nextTitle();
  expect(await title()).toEqual({ big: 'WIND', small: 'Vento', kicker: 'Bolzano · Bozen' });
  await expect(page.locator('.wv-t-sub')).toHaveText('Wind, air and pollen over Bolzano');
});

test('time top left has no weekday and is the same in every language', async ({ page }) => {
  await page.goto('/');
  const time = page.locator('.wv-time');
  await expect(time).toHaveText(/^\d{2}\.\d{2}\. \d{2}:\d{2}$/);
  const shown = await time.textContent();
  for (const l of ['it', 'en', 'de']) {
    await page.evaluate((x) => document.querySelector(`.wv-lang[data-lang="${x}"]`).click(), l);
    await expect(time).toHaveText(shown);
  }
});

const gotoPage = (page, n) => page.evaluate((k) => { for (let i = 0; i < k; i++) document.getElementById('wv-pg').click(); }, n);

test('air pages show NO₂, PM10, PM2.5, O₃, SO₂ with the measurement time', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#wv-title')).toHaveText('Wind Bozen');
  await gotoPage(page, 2);
  const no2 = page.locator('.wv-page[data-page="2"]');
  await expect(no2).toHaveClass(/is-on/);
  await expect(no2.locator('[data-f="no2_ugm3"]')).toHaveText('41');
  await expect(page.locator('#wv-eaqi')).toHaveText('mittelmäßig');     // 41 µg/m³ = EAQI "fair"
  await expect(no2.locator('.wv-aqtime')).toHaveText(' · 10:00');       // last APPA value, 08:00 UTC
  await gotoPage(page, 1);
  const pm = page.locator('.wv-page[data-page="3"]');
  await expect(pm.locator('[data-f="pm10_ugm3"]')).toHaveText('30');
  await expect(pm.locator('[data-f="pm25_ugm3"]')).toHaveText('13');
  await expect(pm.locator('[data-f="o3_ugm3"]')).toHaveText('10');
  await expect(pm.locator('[data-f="so2_ugm3"]')).toHaveText('1,4');
  await expect(page.locator('#wv-m-air')).toContainText('Bolzano 6');
});

test('without data in the Open Data Hub no value, unit or label is shown and the page is skipped', async ({ page }) => {
  await page.unroute('**/api/wind**');
  await page.route('**/api/wind**', (r) => r.fulfill({ path: path.join(here, 'fixtures', 'wind-noair.json'), contentType: 'application/json' }));
  await page.goto('/');
  await expect(page.locator('#wv-title')).toHaveText('Wind Toblach');
  // air units and labels are hidden
  for (const sel of ['.wv-page[data-page="2"] .wv-h-side', '.wv-page[data-page="3"] .wv-h-side', '.wv-page[data-page="3"] .wv-h-pair', '.wv-page[data-page="2"] .wv-h-pair']) {
    await expect(page.locator(sel)).toBeHidden();
  }
  // the ring goes title → wind → pollen, the air pages are skipped
  await gotoPage(page, 1);
  await expect(page.locator('#wv-pg')).toHaveText('2/5');
  await gotoPage(page, 1);
  await expect(page.locator('#wv-pg')).toHaveText('5/5');
  await expect(page.locator('#wv-m-air')).toHaveText('keine Messstelle im Umkreis von 30 km');
});

test('the language arc slides between the dots instead of jumping', async ({ page }) => {
  await page.goto('/');
  await gotoPage(page, 1);
  const ind = page.locator('.wv-lang-ind');
  expect(await ind.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('1.4s');
  // sample the arc's position inside the page while it moves from DE to IT
  const { samples, it } = await page.evaluate(() => new Promise((done) => {
    const el = document.querySelector('.wv-lang-ind');
    const it = document.querySelector('.wv-lang[data-lang="it"]').offsetLeft;
    const samples = [];
    const t0 = performance.now();
    document.querySelector('.wv-lang[data-lang="it"]').click();
    const tick = () => {
      samples.push(new DOMMatrix(getComputedStyle(el).transform).m41);
      if (performance.now() - t0 < 1800) requestAnimationFrame(tick); else done({ samples, it });
    };
    requestAnimationFrame(tick);
  }));
  expect(samples.some((x) => x > 1 && x < it - 1)).toBe(true);   // positions in between: it slides
  expect(samples.at(-1)).toBe(it);
  await expect.poll(() => ind.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)).toBe(it);
});

test('when the air feed has stopped, the live view skips the air pages and says so', async ({ page }) => {
  const fs = await import('node:fs');
  const j = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'wind.json'), 'utf8'));
  // the last 10 hours without air values, as when the APPA feed in the Open Data Hub stops
  for (const r of j.rows.slice(-10)) for (const k of ['no2_ugm3', 'pm10_ugm3', 'pm25_ugm3', 'o3_ugm3', 'so2_ugm3', 'aq_time']) r[k] = null;
  j.air_latest = '2026-10-16T08:00:00Z';
  await page.unroute('**/api/wind**');
  await page.route('**/api/wind**', (r) => r.fulfill({ body: JSON.stringify(j), contentType: 'application/json' }));
  await page.goto('/');
  await expect(page.locator('#wv-m-air')).toContainText('keine aktuellen Messdaten, letzte Messung');
  await gotoPage(page, 1);
  await expect(page.locator('#wv-pg')).toHaveText('2/5');
  await gotoPage(page, 1);
  await expect(page.locator('#wv-pg')).toHaveText('5/5');   // NO₂ and PM pages skipped
  // replaying an hour that had air data brings the pages back
  await page.evaluate(() => document.getElementById('wv-play').click());
  await gotoPage(page, 3);
  await expect(page.locator('#wv-pg')).toHaveText('3/5');
});

test('main page lists all values; missing ones without unit', async ({ page }) => {
  await page.goto('/');
  const vals = page.locator('#wv-vals');
  await expect(vals.locator('.wv-val')).toHaveCount(9);
  await expect(vals).toContainText('Stickstoffdioxid NO₂41µg/m³mittelmäßig');
  await expect(vals).toContainText('Schwefeldioxid SO₂1,4µg/m³');
  await page.unroute('**/api/wind**');
  await page.route('**/api/wind**', (r) => r.fulfill({ path: path.join(here, 'fixtures', 'wind-noair.json'), contentType: 'application/json' }));
  await page.goto('/');
  const no2 = page.locator('.wv-val', { hasText: 'NO₂' });
  await expect(no2).toHaveClass(/is-empty/);
  await expect(no2).not.toContainText('µg/m³');
});
