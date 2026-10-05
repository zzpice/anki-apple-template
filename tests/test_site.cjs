// Exercise the actual static site under GitHub Pages' project prefix.
// SITE_URL also runs this check against the deployed site, in a fresh context.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium, webkit} = require('playwright');
const root = path.resolve(__dirname, '..');
const prefix = '/anki-template/';
const mime = {'.html':'text/html', '.css':'text/css', '.json':'application/json',
  '.js':'text/javascript', '.mjs':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png'};
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (!url.pathname.startsWith(prefix)) {response.writeHead(404).end(); return;}
  const file = path.resolve(root, decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html');
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end(); return;
  }
  response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  response.end(fs.readFileSync(file));
});

async function check(engine, name, base) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext({acceptDownloads:true});
    const page = await context.newPage(), failures = [], requested = new Set();
    page.on('pageerror', error => failures.push(error.message));
    page.on('requestfailed', request => failures.push(request.url() + ': ' + request.failure().errorText));
    page.on('response', response => {if (!response.ok()) failures.push(response.url() + ': ' + response.status());});
    page.on('request', request => {
      if (/^https?:/.test(request.url())) {
        assert.ok(request.url().startsWith(base), 'resource escaped project prefix: ' + request.url());
        requested.add(new URL(request.url()).pathname);
      }
    });
    await page.goto(base);
    await page.waitForURL(new URL('preview.html', base).href);
    const frame = page.frameLocator('#preview');
    await frame.locator('.review-choice').first().waitFor();
    const examples = JSON.parse(fs.readFileSync(path.join(root, 'web/preview-cards.json')));
    assert.equal(await page.locator('#sample option').count(), examples.length);
    for (let index = 0; index < examples.length; index++) {
      await page.selectOption('#sample', String(index));
      if (examples[index].type === 'occlusion') await frame.locator('#occlusion-error').waitFor();
      else await frame.locator('.review-question').waitFor();
      await page.click('#flip');
      await frame.locator('#answer').waitFor();
    }
    for (const file of ['cards/note-types.json', 'cards/samples.json', 'cards/style.css',
      'cards/media/_review.js', 'cards/media/_mindmap.js', 'cards/media/_rule-build.svg',
      'web/preview-cards.json', 'downloads/anki-template.apkg',
      'docs/images/preview-choice.png', 'docs/images/preview-content.png', 'docs/images/preview-mindmap.png']) {
      const response = await page.request.get(new URL(file, base).href);
      assert.equal(response.status(), 200, file);
      assert.deepEqual(await response.body(), fs.readFileSync(path.join(root, file)), 'published content differs: ' + file);
    }
    await page.getByRole('link', {name:'网页制卡', exact:true}).click();
    await page.locator('#app').waitFor();
    assert.equal(page.url(), new URL('tools.html', base).href);
    await page.click('#load-samples');
    assert.equal(await page.locator('#count').innerText(), '9 / 9 条');
    await page.selectOption('#type-filter', 'choice');
    await page.locator('.note-row button').first().click();
    await frame.locator('.review-choice').first().waitFor();
    await page.click('#flip');
    await frame.locator('#answer').waitFor();
    await page.click('#export-open');
    const pending = page.waitForEvent('download');
    await page.click('#export-zip');
    const download = await pending;
    assert.equal(await download.failure(), null);
    const bytes = fs.readFileSync(await download.path());
    assert.ok(bytes.includes(Buffer.from('_rule-build.svg')), 'sample media missing from ZIP');
    assert.ok(bytes.includes(Buffer.from('/docs/authoring.md')), 'ZIP instructions must point to canonical documentation');
    for (const file of ['web/tools/app.mjs', 'cards/templates/basic/front.html',
      'cards/templates/basic/back.html', 'cards/templates/choice/front.html', 'cards/media/_rule-build.svg']) {
      assert.ok(requested.has(new URL(file, base).pathname), 'not loaded: ' + file);
    }
    await page.waitForFunction(() => document.getElementById('save-status').textContent.startsWith('已保存'));
    assert.deepEqual(failures, []);
    await context.close();
    console.log(name + ': Pages project paths, preview, authoring, shared media, ZIP, download and README images passed (' + base + ')');
  } finally {await browser.close();}
}

(async () => {
  if (!process.env.SITE_URL) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.SITE_URL
    ? new URL('./', process.env.SITE_URL.endsWith('/') ? process.env.SITE_URL : process.env.SITE_URL + '/').href
    : 'http://127.0.0.1:' + server.address().port + prefix;
  try {await check(chromium, 'Chromium', base); await check(webkit, 'WebKit', base);}
  finally {server.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
