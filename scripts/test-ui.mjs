import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.avif':'image/avif'};
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream'); res.end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
let count = 0;
try {
  browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})});
  const page = await browser.newPage({reducedMotion:'reduce'});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('.hero').waitFor();
  async function fit(label) {
    await page.evaluate(() => document.fonts.ready);
    const bad = await page.evaluate(() => [...document.querySelectorAll('.shell,.main,.hero-info,.preset-bar,.card-body,.row,.seg,.tabs,.page-head,.setting,.about,.preset-top,.preset-actions,.dpi-big')]
      .filter(e => e.scrollWidth > e.clientWidth + 2).map(e => e.className));
    assert.deepEqual(bad, [], `Overflow: ${label}`);
    count++;
  }
  for (const width of [1000,1180,1280,1600]) {
    await page.setViewportSize({width,height:660});
    for (const lang of ['ru','en']) {
      await page.locator('[data-view="settings"]').click();
      await page.locator(`[data-act="lang"][data-v="${lang}"]`).click();
      for (const theme of ['mono','neon','orange','violet','terminal','paper','win95']) {
        await page.locator('[data-view="settings"]').click();
        await page.locator(`[data-act="theme"][data-v="${theme}"]`).click();
        await fit(`${width}/${lang}/${theme}/settings`);
        await page.locator('[data-view="library"]').click(); await fit('library');
        for (const key of ['demo:viper','demo:basilisk','demo:bw','demo:firefly']) {
          await page.locator(`.dev-item[data-key="${key}"]`).click(); await fit(key);
          for (const tab of await page.locator('[data-tab]').evaluateAll(es => es.map(e => e.dataset.tab))) {
            await page.locator(`[data-tab="${tab}"]`).click(); await fit(`${key}/${tab}`);
          }
        }
      }
    }
  }
  await page.setViewportSize({width:1280,height:820});
  await page.locator('[data-view="settings"]').click();
  await page.locator('[data-act="theme"][data-v="mono"]').click();
  await page.locator('.dev-item').first().click();
  await page.locator('[data-tab="performance"]').click();
  const name = 'Основной профиль — ' + 'длинное имя '.repeat(3);
  await page.locator('[data-act="save-as"]').click();
  await page.setViewportSize({width:1000,height:660});
  const bounds = await page.locator('.modal').boundingBox();
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 660, 'modal fits minimum window height');
  await page.locator('.modal input').fill(name); await page.locator('.modal .primary').click();
  await page.setViewportSize({width:1280,height:820});
  await fit('long preset name');
  await page.locator('[data-dpi-num="x"]').fill('35000'); await page.locator('[data-dpi-num="x"]').press('Tab');
  await page.locator('[data-act="split"]').check(); await fit('maximum DPI');
  await page.locator('#main').evaluate(e => e.scrollTop = e.scrollHeight);
  await page.locator('[data-view="settings"]').click();
  assert.equal(await page.locator('#main').evaluate(e => e.scrollTop), 0, 'navigation starts at top');
  await page.locator('.dev-item').first().click();
  await page.locator('[data-tab="buttons"]').click();
  await page.locator('[data-act="button"][data-b="3"]').selectOption('key');
  assert.equal(await page.locator('[data-act="listen"].primary').count(), 1, 'key capture starts');
  await page.locator('[data-view="settings"]').click(); await page.keyboard.press('a');
  await page.locator('.dev-item').first().click();
  assert.equal(await page.locator('[data-act="listen"].primary').count(), 0, 'navigation cancels key capture');
  assert.equal(await page.locator('[data-act="button"][data-b="3"]').inputValue(), '3', 'typing after navigation must not remap');
  await page.locator('[data-view="library"]').click(); await fit('long name in library');
  const originalCount = await page.locator('.preset').count();
  await page.locator('[data-act="paste"]').click();
  await page.locator('.modal textarea').fill('invalid code'); await page.locator('.modal .primary').click();
  assert.equal(await page.locator('.preset').count(), originalCount, 'invalid import is rejected');
  const preset = {format:'open-synapse/preset',version:1,name:'Imported',kind:'mouse',settings:{}};
  const code = 'OSP1.' + Buffer.from(JSON.stringify(preset)).toString('base64url');
  await page.locator('[data-act="paste"]').click();
  await page.locator('.modal textarea').fill(code); await page.locator('.modal .primary').click();
  assert.equal(await page.locator('.preset').count(), originalCount + 1, 'share-code import works');
  await page.waitForTimeout(400); await page.reload(); await page.locator('.hero').waitFor();
  assert.equal(await page.locator('#dpi-num').textContent(), '35000', 'DPI persists across reload');
  assert.deepEqual(errors, [], 'no uncaught JavaScript errors');
  console.log(`${count} layout checks passed; navigation, persistence, valid/invalid imports passed.`);
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
