// 使用 Anki 官方渲染的 HTML，在 Chromium 和 WebKit 中检查交互与布局。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const root = path.resolve(__dirname, '..');
const cards = JSON.parse(fs.readFileSync(process.argv[2] || path.join(root, 'build/cards.json'), 'utf8'));
const server = http.createServer((request, response) => {
  if (request.url === '/card') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
      '<body class="card"><div id="qa">' + cards.full.back + '</div></body></html>');
    return;
  }
  const file = path.resolve(root, '.' + decodeURIComponent(request.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end();
    return;
  }
  const types = {'.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.apkg': 'application/octet-stream'};
  response.setHeader('Content-Type', (types[path.extname(file)] || 'text/plain') + '; charset=utf-8');
  response.end(fs.readFileSync(file));
});

async function showCard(page, html) {
  await page.evaluate(html => {
    const qa = document.getElementById('qa');
    qa.innerHTML = html;
    // 与 Anki 复用 WebView 一样，保留全局事件并执行新卡片中的脚本。
    for (const old of qa.querySelectorAll('script')) {
      const script = document.createElement('script');
      script.textContent = old.textContent;
      old.replaceWith(script);
    }
  }, html);
}

async function run(browserType, name, base) {
  const browser = await browserType.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/card');
    for (const viewport of [{width:1280,height:900}, {width:390,height:844}, {width:844,height:390}, {width:320,height:568}]) {
      await page.setViewportSize(viewport);
      for (const scheme of ['light', 'dark']) {
        await page.emulateMedia({colorScheme:scheme});
        for (const card of [cards.full, cards.minimal, cards.empty]) {
          await showCard(page, card.front);
          assert.equal(await page.locator('#answer').count(), 0);
          await showCard(page, card.back);
          assert.equal(await page.locator('#answer').count(), 1);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'page overflows');
        }
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.emulateMedia({colorScheme:'light'});
    await showCard(page, cards.full.back);
    assert.equal(await page.locator('.scroll-x').count(), 2);
    await page.locator('a.hint').click();
    assert.equal(await page.locator('div.hint').isVisible(), true);
    assert.equal(await page.locator('div.hint .scroll-x').count(), 1);
    assert.ok(await page.locator('.scroll-x').first().evaluate(el => el.scrollWidth > el.clientWidth));
    await page.locator('.scroll-x').first().evaluate(el => { el.scrollLeft = 80; });
    assert.ok(await page.locator('.scroll-x').first().evaluate(el => el.scrollLeft > 0));
    const light = await page.locator('body').evaluate(el => getComputedStyle(el).color);
    for (const nightClass of ['nightMode', 'night_mode']) {
      await page.locator('body').evaluate((el, cls) => el.classList.add(cls), nightClass);
      assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).color), light);
      await page.locator('body').evaluate((el, cls) => el.classList.remove(cls), nightClass);
    }

    // 内容图片覆盖大图、小图、禁用放大、图片链接和按钮。
    await page.locator('.content').first().evaluate(el => {
      const svg = (w, h) => 'data:image/svg+xml,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#777"/></svg>`);
      const image = (id, attrs = '') => `<img id="${id}" src="${svg(24,24)}" ${attrs}>`;
      el.insertAdjacentHTML('beforeend', `<img id="large" src="${svg(1200,700)}">` + image('small') +
        image('nozoom', 'class="no-zoom"') + image('data-nozoom', 'data-nozoom="1"') +
        '<a href="#linked-target">' + image('linked') + '</a>' +
        '<button onclick="this.dataset.clicked=\'yes\'">' + image('button-image') + '</button>');
    });
    await page.locator('#large').evaluate(img => img.decode());
    const large = await page.locator('#large').boundingBox();
    assert.ok(large.width <= 390 && Math.abs(large.width / large.height - 1200 / 700) < .01);
    assert.equal(Math.round((await page.locator('#small').boundingBox()).width), 24);
    for (const id of ['nozoom', 'data-nozoom', 'linked', 'button-image']) {
      await page.locator('#' + id).click();
      assert.equal(await page.locator('.lightbox').count(), 0);
    }
    assert.ok(page.url().endsWith('#linked-target'), 'linked image was intercepted');
    assert.equal(await page.locator('button').getAttribute('data-clicked'), 'yes');
    await page.locator('#large').click();
    assert.equal(await page.locator('.lightbox').count(), 1);
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).overflow), 'hidden');
    const zoom = await page.locator('.lightbox img').boundingBox();
    assert.ok(zoom.width <= 358 && zoom.height <= 812);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.lightbox').count(), 0);
    assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).overflow), 'hidden');
    await page.locator('#small').click();
    await page.locator('.lightbox').click({position:{x:5,y:5}});
    assert.equal(await page.locator('.lightbox').count(), 0);
    await page.locator('#large').click();
    await page.setViewportSize({width:844,height:390});
    await page.waitForFunction(() => !document.querySelector('.lightbox'));
    await page.locator('#large').click();
    await page.locator('#large').evaluate(img => img.remove());
    await page.waitForFunction(() => !document.querySelector('.lightbox'));

    for (let i = 0; i < 5; i++) {
      await showCard(page, cards.full.front);
      await showCard(page, cards.full.back);
    }
    assert.equal(await page.locator('.scroll-x .scroll-x').count(), 0);
    assert.equal(await page.locator('.scroll-x').count(), 2);
    await page.locator('.content').first().evaluate(el => {
      el.innerHTML = '<img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22/%3E">';
    });
    await page.locator('.section img').click();
    assert.equal(await page.locator('.lightbox').count(), 1, 'duplicate click listeners');
    await showCard(page, '<section class="section"><img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22/%3E"></section>');
    await page.waitForFunction(() => !document.querySelector('.lightbox'));
    await page.locator('.section img').click();
    assert.equal(await page.locator('.lightbox').count(), 0, 'intercepts other note types');

    // 在线预览的正反面、空字段与主题控制也读取相同源码。
    await page.goto(base + '/preview.html');
    const frame = page.frameLocator('#preview');
    await frame.locator('#answer').waitFor({state:'attached'});
    await page.selectOption('#theme', 'dark');
    assert.notEqual(await frame.locator('body').evaluate(el => getComputedStyle(el).color), light);
    await page.emulateMedia({colorScheme:'dark'});
    await page.selectOption('#theme', 'light');
    assert.equal(await frame.locator('body').evaluate(el => getComputedStyle(el).color), light);
    await page.selectOption('#sample', '1');
    await frame.locator('.tags').waitFor({state:'detached'});
    assert.equal(await frame.locator('.section').count(), 2);
    await page.selectOption('#side', 'front');
    await frame.locator('#answer').waitFor({state:'detached'});
    assert.equal(await frame.locator('.section').count(), 1);
    assert.equal((await page.request.get(base + '/downloads/anki-apple-template.apkg')).status(), 200);
    assert.deepEqual(errors, []);
    console.log(name + ': layout, themes, Hint, images, card lifecycle and preview passed');
  } finally {
    await browser.close();
  }
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    await run(chromium, 'Chromium', base);
    await run(webkit, 'WebKit', base);
  } finally {
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
