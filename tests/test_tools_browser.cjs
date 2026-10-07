// Real editing, import/export, IndexedDB conflicts and responsive authoring UI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {chromium,webkit} = require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((request,response)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(request.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return;}
  const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
  response.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');response.end(fs.readFileSync(file));
});
async function downloaded(page,selector) {
  const pending=page.waitForEvent('download');await page.click(selector);return fs.readFileSync(await (await pending).path());
}
async function importData(page,data) {
  await page.click('#import-open');await page.fill('#import-text',JSON.stringify(data));await page.click('#check-import');
  await page.waitForFunction(()=>!document.getElementById('apply-import').disabled);await page.click('#apply-import');
}
async function saved(page) {await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('已保存'));}
async function htmlField(page,name,value) {
  const field=page.locator('.field').filter({has:page.locator('label').filter({hasText:new RegExp('^'+name+'$')})});
  if(!(await page.locator('[id="source-'+name+'"]').isVisible()))await field.getByRole('button',{name:'HTML',exact:true}).click();
  await page.locator('[id="source-'+name+'"]').fill(value);
}
async function run(engine,name,base,data) {
  const browser=await engine.launch();
  try {
    const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
    const page=await context.newPage(),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))external.push(r.url());});
    await page.goto(base+'/tools.html');await page.locator('#app').waitFor();
    assert.equal(await page.locator('#count').innerText(),'0 / 0 条');
    await page.click('#new-note');await htmlField(page,'问题','<p>为什么需要练习回忆？</p>');await htmlField(page,'答案','<b>强化记忆</b>');
    await page.locator('[id="source-答案"]').locator('..').getByRole('button',{name:'富文本',exact:true}).click();
    assert.equal(await page.locator('[id="field-答案"] b').innerText(),'强化记忆');
    await saved(page);
    await page.getByLabel('更多工作空间操作').click();await page.click('#reset-open');await page.click('#reset-workspace');assert.equal(await page.locator('#count').innerText(),'0 / 0 条');await page.click('#undo');assert.equal(await page.locator('#count').innerText(),'1 / 1 条');await saved(page);
    await page.click('#export-open');const draft=JSON.parse(await downloaded(page,'#export-json'));
    assert.equal(draft.notes[0].fields.答案,'<b>强化记忆</b>');assert.match(draft.notes[0].guid,/^[a-f0-9]{20}$/);
    await page.getByRole('button',{name:'关闭导出'}).click();
    await page.waitForFunction(()=>document.activeElement?.id==='export-open');
    await page.click('#duplicate');await saved(page);assert.equal(await page.locator('#count').innerText(),'2 / 2 条');
    await page.reload();await page.locator('#app').waitFor();assert.equal(await page.locator('#count').innerText(),'2 / 2 条');
    await page.click('#select-all');await page.fill('#batch-tags','测试::批量 固定顺序');await page.click('#apply-tags');
    await page.click('#delete-selected');assert.equal(await page.locator('#count').innerText(),'0 / 0 条');await page.click('#undo');
    assert.equal(await page.locator('#count').innerText(),'2 / 2 条');
    await page.click('#import-open');await page.fill('#import-text','[{"type":"basic","fields":{"不存在":"x"}}]');await page.click('#check-import');
    assert.match(await page.locator('#import-status').innerText(),/无法导入/);assert.equal(await page.locator('#apply-import').isDisabled(),true);
    await page.getByRole('button',{name:'关闭导入'}).click();
    await importData(page,data);await saved(page);assert.equal(await page.locator('#count').innerText(),'9 / 9 条');
    await importData(page,data);await saved(page);assert.equal(await page.locator('#count').innerText(),'9 / 9 条','GUID merge must not duplicate notes');
    await page.selectOption('#type-filter','choice');await page.locator('.note-row button').first().click();
    const frame=page.frameLocator('#preview');await frame.locator('.review-choice').first().waitFor();
    await frame.locator('input[type=radio]').first().check();
    const before=await frame.locator('.review-choice').evaluateAll(rows=>rows.map(r=>r.dataset.key));
    await page.selectOption('#viewport','phone');await page.selectOption('#theme','dark');
    assert.deepEqual(await frame.locator('.review-choice').evaluateAll(rows=>rows.map(r=>r.dataset.key)),before);
    assert.equal(await frame.locator('input:checked').count(),1);
    await page.click('#flip');await frame.locator('#answer').waitFor();
    assert.deepEqual(await frame.locator('.review-choice').evaluateAll(rows=>rows.map(r=>r.dataset.key)),before);
    assert.equal(await frame.locator('input:checked').count(),1);
    assert.equal(await frame.locator('.is-correct').getAttribute('data-key'),'C');
    await page.selectOption('#type-filter','cloze');await page.locator('.note-row button').click();
    await htmlField(page,'正文','一段需要挖空的内容');await page.locator('[id="source-正文"]').focus();
    await page.locator('[id="source-正文"]').evaluate(el=>el.setSelectionRange(4,6));
    await page.fill('#cloze-number','4');await page.fill('#cloze-hint','回忆');await page.click('#insert-cloze');
    assert.equal(await page.locator('[id="source-正文"]').inputValue(),'一段需要{{c4::挖空::回忆}}的内容');
    await saved(page);await page.waitForFunction(()=>document.getElementById('preview').contentDocument?.body?.textContent.includes('{{c4::'));
    assert.match(await frame.locator('.review-question').innerText(),/\{\{c4::/);assert.equal(await frame.locator('.cloze').count(),0);
    await page.selectOption('#type-filter','occlusion');await page.locator('.note-row button').click();
    await page.locator('#occlusion-picture').evaluate(el=>el.decode());assert.equal(await page.locator('.mask').count(),3);
    await page.fill('#occlusion-group','4');await page.locator('#occlusion-stage').evaluate(el=>el.scrollIntoView({block:'center'}));const box=await page.locator('#occlusion-overlay').boundingBox();
    await page.mouse.move(box.x+box.width*.1,box.y+box.height*.85);await page.mouse.down();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.95);await page.mouse.up();
    assert.equal(await page.locator('.mask').count(),4);assert.match(await page.locator('[id="source-Occlusion"]').inputValue(),/\{\{c4::image-occlusion:rect:/);
    await page.locator('#rect-list button').last().click();await page.fill('#occlusion-group','1');await page.locator('#occlusion-group').dispatchEvent('change');
    assert.equal(await page.locator('.mask').last().innerText(),'c1');await page.click('#delete-rect');assert.equal(await page.locator('.mask').count(),3);
    await page.selectOption('#new-type','occlusion');await page.click('#new-note');await page.click('#occlusion-image');await page.locator('#image-file').setInputFiles(path.join(root,'docs/images/preview-choice.png'));
    await page.waitForFunction(()=>document.getElementById('occlusion-picture').src.startsWith('data:'));await page.locator('#occlusion-picture').evaluate(el=>el.decode());assert.match(await page.locator('[id="source-Image"]').inputValue(),/at-[a-f0-9]{32}\.png/);
    await page.selectOption('#type-filter','');await page.selectOption('#new-type','mindmap');await page.click('#new-note');
    await htmlField(page,'内容','<ul><li>章节<ul><li>{{c1::答案}} 与 {{c2::第二点}}<ul><li>上下文</li></ul></li></ul></li></ul>');
    await saved(page);assert.equal(await page.locator('#validation').getAttribute('data-error'),'false');
    for(const scheme of ['light','dark'])for(const width of [320,390,430,1280,1440]) {
      await page.emulateMedia({colorScheme:scheme});await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,scheme+' '+width+' overflow');
      assert.equal(await page.locator('#fields textarea:visible').count(),1);
      if(width===1440) {
        const fields=await page.locator('.editing-fields').boundingBox();
        const preview=await page.locator('#preview-panel').boundingBox();
        assert.ok(preview.x>=fields.x+fields.width,'wide layout places preview beside editing fields');
      }
    }
    await page.setViewportSize({width:1280,height:900});await page.getByLabel('更多工作空间操作').click();await page.click('#ai-open');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='更多工作空间操作');
    await page.getByLabel('更多工作空间操作').click();await page.click('#ai-open');await page.selectOption('#ai-type','mindmap');await page.fill('#ai-content','整理知识与回忆练习');await page.click('#build-prompt');
    assert.match(await page.locator('#ai-prompt').inputValue(),/"内容"/);assert.match(await page.locator('#ai-prompt').inputValue(),/\{\{c1::答案/);await page.click('#return-import');await page.getByRole('button',{name:'关闭导入'}).click();
    await page.click('#export-open');await page.click('#export-zip');
    assert.match(await page.locator('#export-status').innerText(),/无法导出/);await page.check('#valid-only');await page.click('#export-zip');assert.match(await page.locator('#export-status').innerText(),/首字段/);
    await page.getByRole('button',{name:'关闭导出'}).click();await htmlField(page,'标题','手工整理章节');await saved(page);await page.click('#export-open');await page.check('#valid-only');
    const bytes=await downloaded(page,'#export-zip');assert.equal(bytes.readUInt32LE(0),0x04034b50);
    const directory=path.join(root,'build','authoring-browser');fs.mkdirSync(directory,{recursive:true});const zipPath=path.join(directory,name+'.zip');fs.writeFileSync(zipPath,bytes);
    const imported=spawnSync(process.env.ANKI_PYTHON||'python3',[path.join(root,'tests/test_authoring.py'),zipPath],{encoding:'utf8'});
    assert.equal(imported.status,0,imported.stderr);console.log(name+': '+imported.stdout.trim());
    const exported=JSON.parse(await downloaded(page,'#export-json'));assert.equal(exported.notes.length,11);
    assert.equal(new Set(exported.notes.map(n=>n.guid)).size,11);
    await page.getByRole('button',{name:'关闭导出'}).click();
    await page.fill('#deck','');await saved(page);await page.reload();await page.locator('#app').waitFor();assert.equal(await page.locator('#deck').inputValue(),'','unfinished deck must restore');
    await page.fill('#deck','继续制作');await saved(page);
    // A second tab cannot silently overwrite the first tab's newer revision.
    const second=await context.newPage();second.on('dialog',d=>d.accept());await second.goto(base+'/tools.html');await second.locator('#app').waitFor();
    await page.fill('#deck','第一页的新版本');await saved(page);await second.fill('#deck','第二页的修改');
    await second.waitForFunction(()=>document.getElementById('save-status').textContent.includes('另一页面'));
    await second.click('#export-open');const conflict=JSON.parse(await downloaded(second,'#export-json'));assert.equal(conflict.deck,'第二页的修改');await second.close();
    const unsupported=structuredClone(data.notes.find(n=>n.type==='occlusion'));unsupported.guid='unsupported-test';unsupported.fields.Occlusion='{{c1::image-occlusion:ellipse:left=.1:top=.1:width=.2:height=.2:oi=1}}';
    await importData(page,[unsupported]);assert.equal(await page.locator('#occlusion-image').isDisabled(),true);assert.equal(await page.locator('[id="source-Occlusion"]').inputValue(),unsupported.fields.Occlusion);
    // Unsafe source remains a visible draft; preview/editor never execute it.
    const unsafe=[{type:'basic',fields:{问题:'安全检查',答案:'<img src="https://example.invalid/secret" onerror="window.top.pwned=1"><script>window.top.pwned=1</script>'},tags:[]}];
    await importData(page,unsafe);assert.match(await page.locator('#validation').innerText(),/活动内容|本地媒体/);
    assert.equal(await page.evaluate(()=>window.pwned),undefined);assert.equal(await frame.locator('script:not([src])').count(),0);
    assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    await saved(page);
    if(name==='Chromium'&&process.env.AUTHORING_SCREENSHOT){
      await page.selectOption('#type-filter','choice');await page.locator('.note-row button').first().click();
      await page.screenshot({path:process.env.AUTHORING_SCREENSHOT,fullPage:false});
    }
    await context.close();
    // These drafts alone must never produce TSVs; JSON keeps their exact source.
    const rejected=await browser.newContext(), blocked=await rejected.newPage();blocked.on('dialog',d=>d.accept());
    await blocked.goto(base+'/tools.html');await blocked.locator('#app').waitFor();
    const badImages=['<img title="1 < 2 > 0" src="https://example.invalid/secret" onerror="window.top.pwned=1">','<img alt="粘贴时已移除远程地址">'];
    await importData(blocked,badImages.map((答案,i)=>({type:'basic',fields:{问题:'图片检查 '+i,答案},tags:[]})));
    assert.match(await blocked.locator('#validation').innerText(),/活动属性/);assert.match(await blocked.locator('#validation').innerText(),/缺少本地媒体/);
    await blocked.click('#flip');await blocked.frameLocator('#preview').locator('#answer').waitFor();
    assert.equal(await blocked.evaluate(()=>window.pwned),undefined);
    await blocked.click('#next');assert.match(await blocked.locator('#validation').innerText(),/图片缺少本地媒体文件名/);
    await blocked.click('#export-open');await blocked.click('#export-zip');assert.match(await blocked.locator('#export-status').innerText(),/待修正/);
    await blocked.check('#valid-only');await blocked.click('#export-zip');assert.match(await blocked.locator('#export-status').innerText(),/没有通过检查/);
    assert.deepEqual(JSON.parse(await downloaded(blocked,'#export-json')).notes.map(n=>n.fields.答案),badImages);await saved(blocked);await rejected.close();
    const unavailable=await browser.newContext();await unavailable.addInitScript(()=>{indexedDB.open=()=>{throw new Error('存储被禁用');};});
    const fallback=await unavailable.newPage();fallback.on('dialog',d=>d.accept());await fallback.goto(base+'/tools.html');await fallback.locator('#app').waitFor();
    assert.match(await fallback.locator('#save-status').innerText(),/无法读取/);await fallback.click('#new-note');await htmlField(fallback,'问题','缓存不可用仍能编辑');await fallback.click('#export-open');
    assert.equal(JSON.parse(await downloaded(fallback,'#export-json')).notes[0].fields.问题,'缓存不可用仍能编辑');await unavailable.close();
    console.log(name+': authoring editing, GUID merge, native fields, ZIP, images, storage recovery/conflicts, safe preview and responsive UI passed');
  } finally {await browser.close();}
}
(async()=>{
  const {fixture}=await import('./authoring_fixture.mjs');const data=await fixture();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{const base='http://127.0.0.1:'+server.address().port;await run(chromium,'Chromium',base,data);await run(webkit,'WebKit',base,data);}finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
