// 使用导入安装包后的真实 HTML 和官方 Anki reviewer，检查两种浏览器引擎。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium, webkit} = require('playwright');

const root = path.resolve(__dirname, '..');
const examples = JSON.parse(fs.readFileSync(path.join(root, 'build/cards.json'), 'utf8'));
const nativeRoot = JSON.parse(fs.readFileSync(path.join(root, 'build/anki-web.json'), 'utf8'));
const cards = Object.fromEntries(examples.map(example => [example.key, example.cards]));
const server = http.createServer((request, response) => {
  const url = decodeURIComponent(request.url.split('?')[0]);
  if (url === '/card') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<base href="/media/"><link rel="stylesheet" href="/native/css/reviewer.css">' +
      '<link rel="stylesheet" href="/style.css"></head><body class="card"><div id="qa"></div>' +
      '<script src="/native/js/reviewer.js"></script></body></html>');
    return;
  }
  const directory = url.startsWith('/native/') ? nativeRoot : root;
  const file = path.resolve(directory, '.' + (directory === root ? url : url.slice(7)));
  if (!file.startsWith(directory + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end(); return;
  }
  const types = {'.html':'text/html', '.css':'text/css', '.json':'application/json',
    '.js':'text/javascript', '.svg':'image/svg+xml', '.apkg':'application/octet-stream'};
  response.setHeader('Content-Type', (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8');
  response.end(fs.readFileSync(file));
});

async function showCard(page, html) {
  await page.evaluate(async html => {
    const qa = document.getElementById('qa');
    qa.innerHTML = html;
    // 与官方 reviewer 相同，顺序执行内联脚本并等待媒体脚本完成。
    for (const old of Array.from(qa.querySelectorAll('script'))) {
      await new Promise(resolve => {
        const script = document.createElement('script');
        for (const attribute of old.attributes) script.setAttribute(attribute.name, attribute.value);
        script.textContent = old.textContent;
        if (old.src) {
          script.onload = resolve;
          script.onerror = () => { throw new Error('Script failed: ' + old.src); };
        }
        old.replaceWith(script);
        if (!script.src) resolve();
      });
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, html);
}

function contrast(rgb1, rgb2) {
  const luminance = rgb => rgb.match(/\d+/g).slice(0, 3).map(Number).map(v => {
    v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
  const a = luminance(rgb1), b = luminance(rgb2);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
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
        for (const example of examples) {
          for (const card of example.cards) {
            await showCard(page, card.front);
            assert.equal(await page.locator('#answer').count(), 0);
            assert.equal(await page.locator('[data-answer]').count(), 0);
            await showCard(page, card.back);
            assert.equal(await page.locator('#answer').count(), 1);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              name + ': overflow in ' + example.key);
          }
        }
        const colors = await page.evaluate(() => ({
          ink:getComputedStyle(document.body).color,
          paper:getComputedStyle(document.body).backgroundColor,
          muted:getComputedStyle(document.querySelector('.review-context')).color,
        }));
        assert.ok(contrast(colors.ink, colors.paper) >= 7, 'body contrast');
        assert.ok(contrast(colors.muted, colors.paper) >= 4.5, 'secondary text contrast');
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.emulateMedia({colorScheme:'light'});
    await showCard(page, cards.single[0].front);
    assert.equal(await page.getByRole('radio', {name:/合上书/}).count(), 1);
    await page.locator('label[for="review-choice-A"]').click();
    await page.locator('label[for="review-choice-C"]').click();
    assert.equal(await page.locator('input:checked').count(), 1);
    assert.equal(await page.locator('#review-choice-C').isChecked(), true);
    // 原生控件可用键盘操作，不抢占 Anki 的评分数字键。
    await page.locator('#review-choice-A').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#review-choice-A').isChecked(), true);
    await showCard(page, cards.single[0].back);
    assert.equal(await page.locator('.is-correct').getAttribute('data-key'), 'C');
    assert.match(await page.locator('[data-answer]').innerText(), /合上书/);
    assert.equal(await page.locator('input:enabled').count(), 0);
    assert.equal(await page.locator('input:checked').count(), 0);
    await showCard(page, cards.multiple[0].front);
    await page.locator('#review-choice-A').check();
    await page.locator('#review-choice-B').check();
    assert.equal(await page.locator('input:checked').count(), 2);
    await page.locator('#review-choice-A').uncheck();
    assert.equal(await page.locator('input:checked').count(), 1);
    await showCard(page, cards.multiple[0].back);
    assert.equal(await page.locator('.is-correct').count(), 3);
    assert.equal(await page.locator('.review-answer-choice').count(), 3);
    await showCard(page, cards.judgment[0].back);
    assert.equal(await page.locator('.is-correct').getAttribute('data-key'), 'B');
    await showCard(page, cards.minimal[0].back);
    assert.equal(await page.locator('.review-context').isVisible(), false);
    assert.equal(await page.locator('.review-meta').isVisible(), false);
    assert.equal(await page.locator('details, .review-explanation').count(), 0);

    await showCard(page, cards.recall[0].back);
    assert.equal(await page.locator('details').getAttribute('open'), null);
    await page.locator('summary').click();
    assert.equal(await page.locator('details[open]').count(), 1);
    assert.equal(await page.locator('details .review-scroll').count(), 1);
    await page.locator('summary').click();
    assert.equal(await page.locator('details[open]').count(), 0);
    await showCard(page, cards.rich[0].back);
    assert.ok(await page.locator('.review-scroll').evaluate(el => el.scrollWidth > el.clientWidth));
    await page.locator('.review-scroll').evaluate(el => { el.scrollLeft = 60; });
    assert.ok(await page.locator('.review-scroll').evaluate(el => el.scrollLeft > 0));
    assert.ok(await page.locator('pre').evaluate(el => el.scrollWidth > el.clientWidth));
    const light = await page.locator('body').evaluate(el => getComputedStyle(el).color);
    for (const night of ['nightMode', 'night_mode']) {
      await page.locator('body').evaluate((el, value) => el.classList.add(value), night);
      assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).color), light);
      await page.locator('body').evaluate((el, value) => el.classList.remove(value), night);
    }
    const image = page.locator('.review-question img');
    const box = await image.boundingBox();
    assert.ok(box.width <= 354 && Math.abs(box.width / box.height - 960 / 360) < .01);
    await image.click();
    assert.equal(await page.locator('dialog[open]').count(), 1);
    await page.keyboard.press('Escape');
    await page.locator('dialog').waitFor({state:'detached'});
    assert.equal(await page.locator('dialog').count(), 0);
    await image.click();
    await page.locator('dialog button').click();
    await page.locator('dialog').waitFor({state:'detached'});
    assert.equal(await page.locator('dialog').count(), 0);
    await image.click();
    await showCard(page, cards.minimal[0].front);
    assert.equal(await page.locator('dialog').count(), 0, 'zoom survives card replacement');
    assert.equal(await page.locator(':modal').count(), 0);
    await showCard(page, cards.rich[0].front);
    await image.evaluate(el => el.classList.add('no-zoom'));
    await image.click();
    assert.equal(await page.locator('dialog').count(), 0);
    await image.evaluate(el => {
      el.classList.remove('no-zoom');
      const link = document.createElement('a'); link.href = location.href.split('#')[0] + '#image-link';
      el.before(link); link.appendChild(el);
    });
    await image.click();
    assert.ok(page.url().endsWith('#image-link'));
    assert.equal(await page.locator('dialog').count(), 0);

    // 官方原生图片遮挡实际绘制：正面遮住，背面中心透明，另一处遮挡仍保留。
    await showCard(page, cards.occlusion[0].front);
    const canvas = page.locator('#image-occlusion-canvas');
    await page.waitForFunction(() => document.querySelector('canvas').width > 0);
    const pixel = async (x, y) => canvas.evaluate((el, point) => Array.from(
      el.getContext('2d').getImageData(Math.round(el.width * point[0]), Math.round(el.height * point[1]), 1, 1).data), [x, y]);
    assert.equal((await pixel(.19, .50))[3], 255, 'active mask missing');
    assert.equal((await pixel(.82, .50))[3], 255, 'inactive mask missing');
    const container = await page.locator('#image-occlusion-container').boundingBox();
    assert.ok(Math.abs(container.width / container.height - 960 / 360) < .01);
    await showCard(page, cards.occlusion[0].back);
    assert.equal((await pixel(.19, .50))[3], 0, 'answer mask remains opaque');
    assert.equal((await pixel(.82, .50))[3], 255);
    await page.locator('#toggle').click();
    assert.equal((await pixel(.82, .50))[3], 0, 'toggle masks failed');
    await page.locator('#toggle').click();
    assert.equal((await pixel(.82, .50))[3], 255);

    for (let i = 0; i < 8; i++) {
      await showCard(page, cards.rich[0].front);
      await showCard(page, cards.rich[0].back);
    }
    assert.equal(await page.locator('.review-scroll .review-scroll').count(), 0);
    await page.locator('.review-question img').click();
    assert.equal(await page.locator('dialog').count(), 1, 'duplicate handlers');
    await showCard(page, '<section><img src="_memory.svg"></section>');
    await page.locator('section img').click();
    assert.equal(await page.locator('dialog').count(), 0, 'other note types are intercepted');
    assert.equal(await page.locator(':modal').count(), 0);

    // 页面读取相同官方渲染；全套示例、填空分卡、强制主题和下载链接可用。
    await page.goto(base + '/preview.html');
    const frame = page.frameLocator('#preview');
    await frame.locator('.review-choice').first().waitFor();
    await page.selectOption('#theme', 'dark');
    assert.notEqual(await frame.locator('body').evaluate(el => getComputedStyle(el).color), light);
    await page.emulateMedia({colorScheme:'dark'});
    await page.selectOption('#theme', 'light');
    assert.equal(await frame.locator('body').evaluate(el => getComputedStyle(el).color), light);
    for (let i = 0; i < examples.length; i++) {
      await page.selectOption('#sample', String(i));
      if (examples[i].type === 'occlusion') {
        await frame.locator('#occlusion-error').waitFor({state:'visible'});
        assert.equal(await frame.locator('#image-occlusion-container').isVisible(), false);
      } else {
        await frame.locator('.review-question').waitFor();
      }
      await page.click('#flip');
      await frame.locator('#answer').waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.selectOption('#sample', String(examples.findIndex(e => e.key === 'cloze')));
    assert.equal(await page.locator('#card option').count(), 3);
    await page.selectOption('#card', '2');
    await frame.locator('.cloze').waitFor();
    assert.match(await frame.locator('.cloze').innerText(), /访问已存信息/);
    assert.equal((await page.request.get(base + '/downloads/anki-apple-template.apkg')).status(), 200);
    await page.goto(base + '/index.html');
    await page.waitForURL('**/preview.html');
    await frame.locator('.review-choice').first().waitFor();
    assert.deepEqual(errors, []);
    console.log(name + ': 11 cards, responsive layout, contrast, choices, Cloze, native occlusion, images, lifecycle and preview passed');
  } finally { await browser.close(); }
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    await run(chromium, 'Chromium', base);
    await run(webkit, 'WebKit', base);
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
