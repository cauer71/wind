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
