// Called by the existing Chromium/WebKit runner, using official Anki renders.
const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function checkMindMap(page, showCard, cases, engine) {
  const action = name => page.locator('[data-mm-action="' + name + '"]');
  const search = async text => {
    await page.getByRole('searchbox').fill(text);
    await page.getByRole('button', {name:'搜索', exact:true}).click();
  };
  const revealed = () => page.locator('.mm-answer:not([hidden])').count();
  await showCard(page, cases.single[0].front);
  assert.equal(await page.locator('.mm-node').count(), 1);
  assert.equal(await page.locator('.mm-toggle').count(), 0);
  assert.equal(await revealed(), 0);
  await page.locator('.mm-reveal').tap();
  assert.equal(await revealed(), 1, 'touch reveals exactly once');
  await page.locator('.mm-rehide').tap();
  assert.equal(await revealed(), 0, 'touch hides exactly once');
  await search('中文 English');
  assert.equal(await page.locator('.mm-search-status').innerText(), '1/1');
  assert.equal(await revealed(), 0, 'search must not disclose answer');
  await action('clear').click();
  assert.equal(await page.locator('.mm-search-mark').count(), 0);
  await showCard(page, cases.flat[0].front);
  assert.equal(await page.locator('.mm-reveal').innerText(), '[提示]');
  await page.locator('.mm-reveal').click();
  assert.equal(await page.locator('.mm-answer b').innerText(), '答案');
  await showCard(page, cases.loose[0].front);
  assert.equal(await page.locator('.mm-node').count(), 3);
  await search('needle');
  assert.equal(await page.locator('.mm-search-status').innerText(), '1/2', 'paragraphs outside lists are searchable');
  await action('next-result').click();
  assert.ok((await page.locator('.mm-search-row').innerText()).includes('Footer'));
  await action('next').click();
  assert.equal(await page.locator('.mm-located .mm-answer').innerText(), 'leaf');
  await showCard(page, cases.wrapper[0].front);
  await search('needle');
  assert.equal(await page.locator('.mm-search-status').innerText(), '1/2', 'root wrappers do not duplicate list search results');
  assert.equal(await page.locator('.mm-root-list').evaluate(el => getComputedStyle(el).paddingLeft), '0px');

  await showCard(page, cases.mixed[0].front);
  assert.equal(await page.locator('.mm-node').count(), 7);
  assert.equal(await page.locator('.mm-active').count(), 2);
  assert.equal(await page.locator('.mm-located').count(), 1);
  assert.equal(await page.locator('.mm-located .mm-reveal').innerText(), '[提示]');
  // Retain references to verify interactions do not replace the DOM.
  await page.evaluate(() => { window.mmOriginalNode = document.querySelector('.mm-node'); });
  await page.locator('.mm-reveal').nth(1).click();
  assert.equal(await revealed(), 1, 'multiple Clozes in one node remain independent');
  await action('hide').click();
  await action('next').click();
  assert.equal(await page.locator('.mm-located .mm-answer').innerText(), '第二');
  await action('next').click();
  assert.equal(await page.locator('.mm-located .mm-answer').innerText(), 'Hidden Needle');
  assert.equal(await page.locator('.mm-located').isVisible(), true, 'next expands the path');
  assert.equal(await revealed(), 0);
  await action('next').click();
  assert.equal(await page.locator('.mm-located .mm-answer').innerText(), '答案');
  await action('show').click(); assert.equal(await revealed(), 3);
  await action('hide').click(); assert.equal(await revealed(), 0);
  await action('collapse').click();
  assert.equal(await page.locator('.mm-toggle[aria-expanded="true"]').count(), 0);
  await action('locate').click();
  assert.equal(await page.locator('.mm-located').isVisible(), true);
  assert.equal(await page.locator('.mm-toggle[aria-expanded="true"]').count(), 1);
  await action('expand').click();
  assert.equal(await page.locator('.mm-toggle[aria-expanded="false"]').count(), 0);
  await page.locator('.mm-toggle').nth(1).click();
  assert.equal(await page.locator('.mm-toggle').nth(1).getAttribute('aria-expanded'), 'false');
  await search('needle');
  assert.equal(await page.locator('.mm-search-status').innerText(), '1/3');
  assert.equal(await page.locator('.mm-search-mark').count(), 4, 'query spans formatting boundaries');
  await action('prev-result').click();
  assert.equal(await page.locator('.mm-search-status').innerText(), '3/3');
  assert.ok((await page.locator('.mm-search-row').innerText()).includes('[…]'), 'hidden hit stays masked');
  assert.equal(await revealed(), 0);
  await action('next-result').click();
  assert.equal(await page.locator('.mm-search-status').innerText(), '1/3');
  await search('not-found');
  assert.equal(await page.locator('.mm-search-status').innerText(), '0/0');
  assert.equal(await action('next-result').isDisabled(), true);
  await search('.*');
  assert.equal(await page.locator('.mm-search-status').innerText(), '0/0', 'query is literal');
  for (let i = 0; i < 5; i++) { await search('needle'); await action('clear').click(); }
  assert.equal(await page.evaluate(() => window.mmOriginalNode === document.querySelector('.mm-node')), true);
  assert.equal(await page.locator('.mm-cloze').count(), 3);

  // Front -> Back keeps UI paths/query but reveals this card's native group only.
  await search('needle');
  await action('next-result').click();
  await page.locator('.mm-reveal').first().click();
  await showCard(page, cases.mixed[0].back);
  assert.equal(await page.locator('.mm-search-status').innerText(), '2/3');
  assert.equal(await revealed(), 2);
  assert.equal(await page.locator('.mm-cloze:not(.mm-active) .mm-answer').getAttribute('hidden'), '');
  await action('hide').click();
  await showCard(page, cases.mixed[0].back);
  assert.equal(await revealed(), 0, 'repeated back preserves deliberate controls');
  await showCard(page, cases.mixed[0].front);
  assert.equal(await revealed(), 0, 'a fresh front starts a new review');
  assert.equal(await page.getByRole('searchbox').inputValue(), '');
  await showCard(page, cases.mixed[1].back);
  assert.equal(await revealed(), 1, 'c2 is a separately generated Anki card');

  // Storage can fail in WebViews: native answers, paths and all controls still work.
  await page.evaluate(() => {
    window.mmGet = Storage.prototype.getItem; window.mmSet = Storage.prototype.setItem;
    Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new Error('blocked'); };
  });
  await showCard(page, cases.mixed[0].front);
  await action('show').click(); assert.equal(await revealed(), 3);
  await showCard(page, cases.mixed[0].back); assert.equal(await revealed(), 2);
  await page.evaluate(() => { Storage.prototype.getItem = window.mmGet; Storage.prototype.setItem = window.mmSet; });
  await showCard(page, cases.single[0].front.replace(/data-cloze="[^"]*"/g, ''));
  assert.equal(await page.locator('.mm-tools').isVisible(), false, 'unsupported renderer uses native fallback');
  assert.equal(await page.locator('.cloze').count(), 1);

  for (const width of [320, 360, 375, 390, 430, 844]) {
    await page.setViewportSize({width,height:width === 844 ? 390 : 844});
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({colorScheme:scheme});
      for (const name of ['mixed', 'deep', 'formatting']) {
        await showCard(page, cases[name][0].front);
        await action('expand').click();
        await action('show').click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
          engine + ': Mind Map overflow ' + name + ' ' + width);
        if (name === 'mixed') {
          await page.locator('.mm-tree img').evaluate(el => el.decode());
          assert.ok((await page.locator('.mm-tree img').boundingBox()).width <= width);
        }
      }
    }
  }
  await showCard(page, cases.deep[0].front);
  assert.equal(await page.locator('.mm-node').count(), 80);
  assert.equal(await page.locator('.mm-active').isVisible(), true);
  await action('collapse').click();
  await action('locate').click();
  assert.equal(await page.locator('.mm-active').isVisible(), true);

  const start = Date.now();
  await showCard(page, cases.large[0].front);
  assert.equal(await page.locator('.mm-node').count(), 2001);
  assert.equal(await page.locator('.mm-cloze').count(), 100);
  await page.evaluate(() => { window.mmLargeNode = document.querySelector('.mm-node'); });
  for (let i = 0; i < 8; i++) { await action('collapse').click(); await action('expand').click(); }
  await search('Node 1999');
  assert.equal(await page.locator('.mm-search-status').innerText(), '1/1');
  assert.equal(await page.evaluate(() => window.mmLargeNode === document.querySelector('.mm-node')), true);
  console.log(engine + ': Mind Map 2,001 nodes / 100 Clozes, init + 16 fold actions + search ' + (Date.now() - start) + 'ms');
  await action('clear').click();
  // Re-executing the same media script must not double handlers or controls.
  await page.addScriptTag({url:new URL('/media/_mindmap.js', page.url()).href});
  assert.equal(await page.locator('.mm-actions').count(), 1);
  await page.locator('.mm-reveal').first().click();
  assert.equal(await revealed(), 1);
  if (engine === 'Chromium' && process.env.ANKI_SCREENSHOTS === '1') {
    await page.setViewportSize({width:390,height:844});
    await page.emulateMedia({colorScheme:'light'});
    const preview = JSON.parse(require('node:fs').readFileSync(path.join(__dirname, '../preview-cards.json'), 'utf8'));
    await showCard(page, preview.find(e => e.type === 'mindmap').cards[0].front);
    await action('expand').click();
    await page.locator('.mm-sheet').screenshot({path:path.join(__dirname, '../preview-mindmap.png')});
  }
};
