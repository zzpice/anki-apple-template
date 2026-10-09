import test from 'node:test';
import assert from 'node:assert/strict';
import {specs,fixture} from './authoring_fixture.mjs';
import {newNote,workspace,normalizeNotes,normalizeWorkspace,importText,mergeWorkspace,parseDelimited,quoteCell,ankiTSV,validateNote,markupErrors,rectangles,rectangleHTML,promptFor,verifyMediaNames} from '../web/tools/data.mjs';
import {crc32,zipFiles} from '../web/tools/zip.mjs';
import {templateHTML} from '../web/tools/preview.mjs';
const media=['_rule-build.svg'];
test('all native schemas, Unicode HTML/quotes/tabs/newlines and stable GUID round trip',async()=>{
  const data=await fixture();await verifyMediaNames(data.media);
  const json=importText('```json\n'+JSON.stringify(data)+'\n```',specs);assert.deepEqual(json,data);
  for(const spec of specs){const notes=data.notes.filter(n=>n.type===spec.key);const text=ankiTSV(notes,spec,data.deck);const imported=importText(text,specs,spec.key);assert.deepEqual(imported.notes,notes);assert.equal(imported.deck,data.deck);}
  assert.ok(data.notes.every(n=>validateNote(n,specs.find(s=>s.key===n.type),[...media,...data.media.map(m=>m.name)]).length===0));
});
test('strict CSV and shape validation reject truncation, unsupported fields and versions',()=>{
  const spec=specs[0];assert.deepEqual(parseDelimited('问题,答案\r\n"a,b","c""d\ne"\r\n',','),[['问题','答案'],['a,b','c"d\ne']]);
  const notes=importText('问题,答案,标签\na,b,one two',specs,'basic',',').notes;assert.deepEqual(notes[0].tags,['one','two']);
  for(const text of ['问题,答案\na,b,c','问题,答案\n"a,b','问题,未知\na,b','问题,答案\n"a"x,b'])assert.throws(()=>importText(text,specs,'basic',','));
  assert.throws(()=>normalizeWorkspace({...workspace(),version:2},specs));
  assert.throws(()=>normalizeNotes([{type:'basic',fields:{QUESTION:'x'}}],specs));
  assert.throws(()=>normalizeNotes([{type:'basic',fields:{问题:7}}],specs));
  assert.throws(()=>importText(ankiTSV([newNote(spec)],spec,'x'),specs,'choice'));
  assert.throws(()=>normalizeWorkspace({...workspace(),deck:''},specs));
  assert.equal(normalizeWorkspace({...workspace(),deck:''},specs,true).deck,'','invalid deck draft still restores');
});
test('merge uses GUID, protects type and media, duplicates get a new identity',async()=>{
  const data=await fixture(),incoming=structuredClone(data);incoming.notes[0].fields.答案='更新';
  const merged=mergeWorkspace(data,incoming);assert.equal(merged.notes.length,data.notes.length);assert.equal(merged.notes[0].fields.答案,'更新');assert.notEqual(data.notes[0].fields.答案,'更新');
  incoming.notes[0].type='choice';assert.throws(()=>mergeWorkspace(data,incoming));incoming.notes[0].type='basic';incoming.media[0].data+='X';assert.throws(()=>mergeWorkspace(data,incoming));
  const a=newNote(specs[0]),b=newNote(specs[0]);assert.notEqual(a.guid,b.guid);
  assert.throws(()=>normalizeNotes([a,a],specs));
});

test('delimited import preserves trailing empty columns and field whitespace',()=>{
  for (const delimiter of ['\t', ',']) {
    const text = ['问题','答案','解析'].join(delimiter)+'\r\n'+['  问题  ','  答案  ',''].join(delimiter);
    const note = importText(text,specs,'basic',delimiter).notes[0];
    assert.equal(note.fields.问题,'  问题  ');
    assert.equal(note.fields.答案,'  答案  ');
    assert.equal(note.fields.解析,'');
    const last = importText('问题'+delimiter+'答案\n问题'+delimiter+'答案  ',specs,'basic',delimiter).notes[0];
    assert.equal(last.fields.答案,'答案  ');
  }
});
test('choice correctness is tied to source letters and supports 26 options',()=>{
  const spec=specs.find(s=>s.key==='choice'),note=newNote(spec);Object.assign(note.fields,{问题:'题干',答案:'AZ',选项:Array.from({length:26},(_,i)=>'选项'+i).join('||'),题型:'多选'});
  assert.deepEqual(validateNote(note,spec),[]);note.fields.题型='单选';assert.ok(validateNote(note,spec).length);note.fields.答案='A';assert.deepEqual(validateNote(note,spec),[]);note.fields.答案='AA';assert.ok(validateNote(note,spec).length);
  note.fields.题型='判断';note.fields.选项='正确||错误';note.fields.答案='B';assert.deepEqual(validateNote(note,spec),[]);note.fields.选项='错误||正确';assert.ok(validateNote(note,spec).length);
});
test('native cloze, mindmap and rectangle grouping never becomes a second rendering engine',()=>{
  const spec=specs.find(s=>s.key==='mindmap'),note=newNote(spec);note.fields.内容='<ul><li>{{c1::图片}} + {{c3::内容::提示}}</li></ul>';assert.deepEqual(validateNote(note,spec),[]);
  for(const value of ['无挖空','{{c0::答案}}','{{c1::}}','{{c1::<ul><li>内容</li></ul>}}','{{c1::外 {{c2::内}}}}']){note.fields.内容=value;assert.ok(validateNote(note,spec).length,value);}
  const groups=[{group:1,left:.1,top:.2,width:.2,height:.3},{group:1,left:.4,top:.4,width:.1,height:.2},{group:3,left:.7,top:.7,width:.1,height:.1}];assert.deepEqual(rectangles(rectangleHTML(groups)),groups);
  assert.equal(rectangles('{{c1::image-occlusion:ellipse:foo=1}}'),null);assert.equal(rectangles('{{c1::image-occlusion:rect:left=.9:top=0:width=.2:height=.1:oi=1}}'),null);
});
test('active markup is rejected; literal code and media remain valid',async()=>{
  for(const html of ['<script>x</script>','<img src=x onerror=alert(1)>','<a href="java&#x73;cript:alert(1)">x</a>','<img src="https://example.com/a.png">','<img srcset="https://example.com/a.png">','<div style="background:u\\72l(x)">x</div>','<base href="https://example.com/">'])assert.ok(markupErrors(html,[]).length,html);
  assert.deepEqual(markupErrors('<pre>onload=value; url(x); javascript: literal text</pre>',[]),[]);
  const data=await fixture();data.media[0].name='at-'+'a'.repeat(32)+'.png';await assert.rejects(verifyMediaNames(data.media));
  assert.throws(()=>normalizeWorkspace({...workspace(),media:[{name:'../x.png',data:'x'}]},specs));
});
test('media and active attributes cannot hide behind quoted angle brackets',()=>{
  for(const html of [
    '<img title="1 < 2" src="https://example.invalid/a.png">',
    '<img src="_rule-build.svg" onerror="if (1 < 2) alert(1)">',
    '<a title="x > y" href="javascript:alert(1)">x</a>',
    "<a title='x < y > z' href='java&#115;cript:alert(1)'>x</a>",
    '<img src="_rule-build.svg" /onerror=alert(1)>',
    '<img alt="粘贴时已移除远程地址">',
    '<image src="https://example.invalid/a.png">',
  ])assert.ok(markupErrors(html,media).length,html);
  for(const html of ['<p title="1 < 2 > 0">安全文字</p>', '<img title="1 < 2 > 0" src="_rule-build.svg"/>', '<img src=_rule-build.svg />'])assert.deepEqual(markupErrors(html,media),[],html);
});
test('AI prompt uses actual fields and native syntax, has no credentials or endpoint',()=>{
  for(const spec of specs.filter(s=>s.kind!=='occlusion')){const prompt=promptFor(spec,'测试材料',5);for(const name of spec.fields)assert.ok(prompt.includes('"'+name+'"'));assert.ok(prompt.includes('测试材料'));assert.ok(!/API Key|https:\/\//.test(prompt));}
});
test('ZIP checksum and stored UTF-8 entries follow the standard',()=>{
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const files=[['问答.tsv','中文\n'],['media/a.png',new Uint8Array([1,2,3])]];const zip=zipFiles(files),v=new DataView(zip.buffer);assert.equal(v.getUint32(0,true),0x04034b50);assert.equal(v.getUint16(6,true),0x800);assert.equal(v.getUint16(zip.length-14,true),2);
  assert.throws(()=>zipFiles([['../x','x']]));assert.throws(()=>zipFiles([['/x','x']]));
  assert.equal(parseDelimited([quoteCell('a\tb'),quoteCell('x"y\nz')].join('\t'),'\t')[0][1],'x"y\nz');
});
test('template conditions nest correctly without reinterpreting field contents',()=>{
  const source='{{#问题}}<article>{{#章节}}<header>{{章节}}</header>{{/章节}}{{问题}}</article>{{/问题}}';
  assert.equal(templateHTML(source,{问题:'literal {{章节}}',章节:''}),'<article>literal {{章节}}</article>');
  assert.equal(templateHTML(source,{问题:'题干',章节:'主题'}),'<article><header>主题</header>题干</article>');
  assert.equal(templateHTML(source,{问题:'',章节:'主题'}),'');
});
test('incomplete backup restores deck and tags for correction; unusual native GUIDs survive',()=>{
  const data=workspace();data.deck='';const note=newNote(specs[0]);note.guid='aE$<>&:;+/';note.tags=['<待修正>'];data.notes=[note];
  assert.deepEqual(importText(JSON.stringify(data),specs),data);
  assert.ok(validateNote(note,specs[0]).some(e=>e.includes('标签')));
  assert.throws(()=>normalizeWorkspace(data,specs));
  for(const html of ['<img/src="https://example.invalid">','<img src="_rule-build.svg" onload>'])assert.ok(markupErrors(html,media).length);
});
test('optional mindmap title keeps native semantics, but TSV rejects Anki empty first field',()=>{
  const spec=specs.find(s=>s.key==='mindmap'),note=newNote(spec);note.fields.内容='<ul><li>{{c1::答案}}</li></ul>';
  assert.deepEqual(validateNote(note,spec),[]);assert.throws(()=>ankiTSV([note],spec,'学习'),/首字段/);
  note.fields.标题='章节';assert.match(ankiTSV([note],spec,'学习'),/章节/);
});
