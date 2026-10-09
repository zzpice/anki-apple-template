/* Copyright (c) 2026 zzpice. MIT License. */
import {workspace, newNote, freshGuid, escapeHTML, textOnly, tagsFrom, normalizeWorkspace, normalizeNotes, importText, mergeWorkspace, validateNote, clozeNumbers, rectangles, rectangleHTML, ankiTSV, mediaBytes, checkMedia, verifyMediaNames, MIME, MAX_BYTES, MAX_NOTES, promptFor} from './data.mjs?v=20261009import';
import {openWorkspaceStore} from './storage.mjs';
import {zipFiles} from './zip.mjs';
import {safeHTML, makePreview, applyPreviewTheme} from './preview.mjs?v=20261008theme';
const $ = id => document.getElementById(id);
let resources, data = workspace(), current, store, revision=0, dirty=0, saved=0, timer, saving=false, failed=false, undo;
let chosen = new Set(), modes = new Map(), activeField, selection, incoming, importSource, importRevision=0, back=false, previewTimer, imagePurpose='field', selectedRect=-1;
const reservedMedia = new Map();
let noticeTimer;
function notice(text) { clearTimeout(noticeTimer); $('notice').textContent = text; noticeTimer=setTimeout(()=>{$('notice').textContent='';},7000); }
function download(name, bytes, type='application/octet-stream') {
  const url = URL.createObjectURL(new Blob([bytes],{type})), a = document.createElement('a');
  a.href=url; a.download=name; a.click(); setTimeout(() => URL.revokeObjectURL(url),30000);
}
const mediaMap = () => new Map([...reservedMedia,...data.media.map(m => [m.name,m.data])]);
const specFor = note => resources.specs.find(s => s.key === note.type);
const noteFor = () => data.notes.find(n => n.guid === current);
const errorsFor = note => validateNote(note,specFor(note),[...reservedMedia.keys(),...data.media.map(m => m.name)]);
function saveStatus(message,error=false) { $('save-status').textContent=message; $('save-status').dataset.error=error; }
function changed(preserveUndo=false) {
  if(!preserveUndo)undo=null;
  dirty++; failed=false; saveStatus('有未保存的修改…');
  clearTimeout(timer); timer=setTimeout(save,350);
  renderList(); renderValidation(); schedulePreview();
}
async function save() {
  if (saving) return;
  if (!store) { failed=true; saveStatus('本地保存不可用。草稿仍在当前页，请下载 JSON 备份。',true); return; }
  if (saved === dirty) return;
  saving=true; const version=dirty, snapshot=structuredClone(data);
  try {
    if (new TextEncoder().encode(JSON.stringify(snapshot)).length > MAX_BYTES) throw new Error('工作空间超过 40 MiB，请分批备份制卡');
    revision=await store.save(snapshot,revision); saved=version;
    saveStatus(saved===dirty ? '已保存到此浏览器 · 请定期下载 JSON 备份' : '有未保存的修改…');
  } catch(error) { failed=true; saveStatus('保存失败：' + error.message + ' 当前草稿仍可导出。',true); }
  finally { saving=false; if (!failed && saved!==dirty) save(); }
}
window.addEventListener('beforeunload',event => { if (dirty!==saved) { event.preventDefault(); event.returnValue=''; } });
function labelFor(note) { return textOnly(note.fields.问题 || note.fields.标题 || note.fields.正文 || note.fields.Header || note.fields.内容 || '') || '未命名笔记'; }
function visibleNotes() {
  const query=$('search').value.trim().toLowerCase();
  return data.notes.filter(n => (!$('type-filter').value || n.type === $('type-filter').value) &&
    (!$('error-filter').checked || errorsFor(n).length) &&
    (!query || [...Object.values(n.fields),...n.tags].join(' ').toLowerCase().includes(query)));
}
function renderList() {
  if (!resources) return;
  const visible=visibleNotes();
  $('count').textContent=visible.length + ' / ' + data.notes.length + ' 条';
  $('total-count').textContent=data.notes.length+' 条';
  $('list-samples').hidden=!!data.notes.length;
  $('list-empty').hidden=!!visible.length;
  $('list-empty').textContent=data.notes.length ? '没有符合筛选条件的笔记。' : '从新建一条笔记开始，也可以导入现有数据。';
  $('note-list').replaceChildren(...visible.map(note => {
    const row=document.createElement('div'); row.className='note-row';
    const check=document.createElement('input'); check.type='checkbox'; check.checked=chosen.has(note.guid); check.setAttribute('aria-label','选择 ' + labelFor(note));
    check.onchange=() => { if(check.checked)chosen.add(note.guid);else chosen.delete(note.guid); renderBatch(); };
    const button=document.createElement('button'); button.setAttribute('aria-current',String(note.guid===current));
    const title=document.createElement('span'); title.className='note-summary'; title.textContent=labelFor(note);
    const meta=document.createElement('span'); const errors=errorsFor(note); meta.className='note-kind' + (errors.length ? ' error' : '');
    meta.textContent=specFor(note).name + (errors.length ? ' · 待修正 ' + errors.length : ' · 可导出');
    button.append(title,meta); button.onclick=() => openNote(note.guid);
    button.onkeydown=event=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const i=visible.indexOf(note),next=event.key==='Home'?0:event.key==='End'?visible.length-1:Math.max(0,Math.min(visible.length-1,i+(event.key==='ArrowDown'?1:-1)));openNote(visible[next].guid,'notes');$('note-list').querySelector('[aria-current=true]')?.focus();}; row.append(check,button); return row;
  }));
  renderBatch();
}
function renderBatch() { $('batch').hidden=!chosen.size; $('selected-count').textContent='已选择 ' + chosen.size + ' 条'; $('undo').hidden=!undo; }
function stashUndo() { undo=structuredClone(data); $('undo').hidden=false; }
function openNote(guid, view = "edit") {
  clearTimeout(previewTimer);
  current=guid; back=false; activeField=null; selection=null; selectedRect=-1;
  const note=noteFor(); $('welcome').hidden=!!note; $('editor').hidden=!note;
  if (!note) { renderList(); if(window.innerWidth<=760)setToolView('notes'); return; }
  $('note-position').textContent=(data.notes.indexOf(note)+1)+' / '+data.notes.length;
  setToolView(view);
  const spec=specFor(note); $('note-title').textContent=spec.name;
  $('type-help').textContent={basic:'问题放正面，答案放背面。可选字段按原模板显示。', choice:'答案始终按录入顺序填写。选项用 || 分隔，显示字母由模板随机排序。', cloze:'正文使用原生 {{c1::答案::提示}}。不同编号由 Anki 分卡，同号一起遮住。', mindmap:'内容用普通嵌套列表建立层级；挖空放在节点内容中。标题可留空。',occlusion:'Image 与 Occlusion 对应同一图片。矩形以原生字段保存，导入后仍可用 Anki 内置编辑器调整。'}[note.type];
  $('cloze-tools').hidden=spec.kind!=='cloze'; $('occlusion-tools').hidden=spec.kind!=='occlusion';
  $('cloze-number').value=Math.max(0,...clozeNumbers(Object.values(note.fields).join(''))) + 1;
  $('tags').value=note.tags.join(' ');
  $('fields').replaceChildren(...spec.fields.map(name => fieldElement(note,name)));
  $('new-type').value=note.type;
  $('previous').disabled=data.notes.indexOf(note)===0; $('next').disabled=data.notes.indexOf(note)===data.notes.length-1;
  renderList(); renderValidation(); renderMedia(); renderOcclusion(); renderPreview();
}
function rememberSelection() {
  const range=window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0) : null;
  if (range && activeField?.rich.contains(range.commonAncestorContainer)) selection=range.cloneRange();
}
document.addEventListener('selectionchange',rememberSelection);
function fieldElement(note,name) {
  const spec=specFor(note), special=name==='Occlusion' || name==='Image', mode=modes.get(note.guid+name) || (special ? 'html' : 'rich');
  const wrapper=document.createElement('div'); wrapper.className='field';
  const header=document.createElement('div'); header.className='field-heading';
  const label=document.createElement('label'); label.textContent=name; label.htmlFor='field-'+name;
  const actions=document.createElement('div'); actions.className='actions';
  const toggle=document.createElement('button'); toggle.textContent=mode==='rich' ? 'HTML' : '富文本'; toggle.disabled=special;
  const copy=document.createElement('button'); copy.textContent='复制 HTML'; copy.onclick=() => copyText(note.fields[name]);
  const source=document.createElement('textarea'); source.id='source-'+name; source.setAttribute('aria-label',name+' HTML'); source.spellcheck=false; source.value=note.fields[name]; source.hidden=mode!=='html'; source.readOnly=special;
  const rich=document.createElement('div'); rich.id='field-'+name; rich.className='field-edit'; rich.contentEditable='true'; rich.setAttribute('role','textbox'); rich.setAttribute('aria-label',name); rich.setAttribute('aria-multiline','true'); rich.hidden=mode!=='rich';
  rich.dataset.placeholder=({问题:'写下你要回忆的问题…',答案:'写下准确、简短的答案…',正文:'输入正文，选中文字后挖空…',内容:'用嵌套列表整理知识层级…',标题:'可选标题',解析:'解释原因或补充推导…',补充:'可选的延伸信息',来源:'书名、网址或资料出处',章节:'所属章节'}[name] || '输入'+name+'…');
  rich.innerHTML=safeHTML(note.fields[name]);
  // Local images use original file names in fields; only editor DOM has data URLs.
  for(const image of rich.querySelectorAll('img')) { if(mediaMap().has(image.getAttribute('src'))) { image.dataset.media=image.getAttribute('src'); image.src=mediaMap().get(image.dataset.media); } }
  const field={name,rich,source,note};
  function focus() { activeField=field; if(source.hidden)rememberSelection(); }
  rich.onfocus=source.onfocus=focus;
  rich.oninput=() => { note.fields[name]=editorHTML(rich); changed(); };
  rich.onclick=event => { if(event.target.closest('a'))event.preventDefault(); };
  source.oninput=() => { note.fields[name]=source.value; changed(); };
  rich.onpaste=event => paste(event,field);
  toggle.onmousedown=event => event.preventDefault();
  toggle.onclick=() => { activeField=null; selection=null; modes.set(note.guid+name,mode==='rich'?'html':'rich'); const replacement=fieldElement(note,name); wrapper.replaceWith(replacement); replacement.querySelector(mode==='rich'?'textarea':'.field-edit').focus(); };
  actions.append(toggle,copy); header.append(label,actions); wrapper.append(header,rich,source);
  if(name==='选项') { const hint=document.createElement('p'); hint.className='muted'; hint.textContent='第一个选项是 A，第二个是 B。各项之间只用 || 分隔。'; wrapper.append(hint); }
  if(special) { const hint=document.createElement('p'); hint.className='muted'; hint.textContent='此字段由图片和遮挡工具维护；导入的原生数据保持不变。'; wrapper.append(hint); }
  if(name==='标题') {const hint=document.createElement('p');hint.className='muted';hint.textContent='原生标题可留空，使用 JSON 构包即可。Anki 文本导入会跳过空首字段，导出 TSV 前请填写标题。';wrapper.append(hint);}
  return wrapper;
}
function editorHTML(element) {
  const clone=element.cloneNode(true);
  for(const image of clone.querySelectorAll('img[data-media]')) { image.setAttribute('src',image.dataset.media); image.removeAttribute('data-media'); }
  return safeHTML(clone.innerHTML);
}
function insertHTML(html) {
  if(!activeField || ['Image','Occlusion'].includes(activeField.name)) { notice('先在一个可编辑字段中放置光标或选中文字。'); return; }
  const {source,rich,note,name}=activeField;
  if(!source.hidden) {
    const start=source.selectionStart,end=source.selectionEnd;
    source.setRangeText(html,start,end,'end'); note.fields[name]=source.value; source.focus(); changed();
  } else {
    rich.focus(); if(selection && rich.contains(selection.commonAncestorContainer)) { const s=window.getSelection(); s.removeAllRanges(); s.addRange(selection); }
    document.execCommand('insertHTML',false,html); note.fields[name]=editorHTML(rich); rememberSelection(); changed();
  }
}
async function paste(event,field) {
  event.preventDefault(); activeField=field; rememberSelection();
  const image=Array.from(event.clipboardData.items).find(i => MIME[i.type]);
  if(image) { try { const name=await addImage(image.getAsFile()); if(noteFor()!==field.note){changed();return;} activeField=field; insertHTML('<img src="'+name+'">'); refreshEditorImages(field.rich); } catch(error){notice(error.message);} return; }
  const html=event.clipboardData.getData('text/html');
  insertHTML(html ? safeHTML(html) : escapeHTML(event.clipboardData.getData('text/plain')).replace(/\r?\n/g,'<br>'));
}
function refreshEditorImages(rich) {
  for(const image of rich.querySelectorAll('img')) { const src=image.getAttribute('src'); if(mediaMap().has(src)) { image.dataset.media=src;image.src=mediaMap().get(src); } }
}
async function addImage(file) {
  if(!file || !MIME[file.type] || file.size>10*1024*1024) throw new Error('请选择不超过 10 MiB 的 PNG、JPEG、WebP 或 GIF 图片');
  const bytes=await file.arrayBuffer(), hash=await crypto.subtle.digest('SHA-256',bytes);
  const name='at-'+Array.from(new Uint8Array(hash).slice(0,16),n=>n.toString(16).padStart(2,'0')).join('')+'.'+MIME[file.type];
  const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
  const media={name,data:encoded}; checkMedia(media);
  if(!data.media.some(m=>m.name===name)) {
    if(data.media.length>=1000)throw new Error('最多 1000 张本地图片，请分批制卡');
    if(new TextEncoder().encode(JSON.stringify(data)).length+encoded.length>MAX_BYTES)throw new Error('工作空间超过 40 MiB，请先分批备份');
    data.media.push(media);
  }
  renderMedia(); return name;
}
function renderMedia() {
  $('media-count').textContent=data.media.length;
  $('media-list').replaceChildren(...data.media.map(media=>{
    const row=document.createElement('div');row.className='media-item';const image=document.createElement('img');image.src=media.data;image.alt='';
    const label=document.createElement('span');label.textContent=media.name;const button=document.createElement('button');button.textContent='下载';button.onclick=()=>download(media.name,mediaBytes(media));
    row.append(image,label,button);return row;
  }));
}
function renderValidation() {
  const note=noteFor(); if(!note)return;
  const errors=errorsFor(note); $('validation').dataset.error=!!errors.length;
  $('validation').innerHTML=errors.length ? '<ul>'+errors.map(e=>'<li>'+escapeHTML(e)+'</li>').join('')+'</ul>' : '字段检查通过 · '+(specFor(note).kind==='basic' ? '1 张卡片' : clozeNumbers(note.fields.Occlusion || note.fields.内容 || note.fields.正文).length+' 个原生卡片编号')+' · 导入后核对实际卡片';
}
function schedulePreview() { clearTimeout(previewTimer); previewTimer=setTimeout(()=>{back=false;renderPreview();},450); }
function renderPreview(resume=false) {
  if(!resources || !noteFor())return;
  const note=noteFor(), native=specFor(note).kind!=='basic';
  $('flip').hidden=native; $('flip').textContent=back?'返回正面':'显示答案';
  $('preview-help').textContent=native ? '字段排版预览保留 {{cN::…}} 原文，不模拟原生 Cloze 或遮挡复习。实际分卡、答案及导图交互请导入 Anki 核对；项目示例预览由官方后端生成。' : '共用项目原模板、样式和选择脚本；编辑后会重新开始本次预览。';
  $('preview').srcdoc=makePreview(resources,note,mediaMap(),back,resume);
}
function renderOcclusion() {
  const note=noteFor();if(note?.type!=='occlusion')return;
  const doc=new DOMParser().parseFromString(note.fields.Image,'text/html'), src=doc.querySelector('img')?.getAttribute('src');
  const image=$('occlusion-picture'); image.src=mediaMap().get(src) || ''; $('occlusion-stage').hidden=!src || !mediaMap().has(src);
  const rects=rectangles(note.fields.Occlusion); const supported=rects!==null;
  $('occlusion-help').textContent=supported?'拖动画框；点击已有框后可调整分组。相同编号一起遮住，其余区域保持遮挡。':'导入包含此工具不支持的原生形状或格式，已完整保留。请在 Anki 内置编辑器继续编辑；这里不能修改或覆盖原数据。';
  $('occlusion-image').disabled=!supported && !!note.fields.Occlusion; $('occlusion-group').disabled=!supported;
  $('occlusion-overlay').replaceChildren(...(rects||[]).map((r,i)=>{const el=document.createElement('div');el.className='mask'+(i===selectedRect?' selected':'');el.textContent='c'+r.group;el.dataset.rect=i;Object.assign(el.style,{left:r.left*100+'%',top:r.top*100+'%',width:r.width*100+'%',height:r.height*100+'%'});return el;}));
  $('rect-list').replaceChildren(...(rects||[]).map((r,i)=>{const button=document.createElement('button');button.textContent=(i+1)+' · c'+r.group;button.setAttribute('aria-pressed',String(i===selectedRect));button.onclick=()=>selectRect(i,rects);return button;}));
  $('delete-rect').disabled=!supported||selectedRect<0;
}
function selectRect(i,rects) { selectedRect=i; $('occlusion-group').value=rects[i].group;renderOcclusion(); }
function updateOcclusion(rects) { noteFor().fields.Occlusion=rectangleHTML(rects); $('source-Occlusion').value=noteFor().fields.Occlusion;changed();renderOcclusion(); }
let drawing;
$('occlusion-overlay').onpointerdown=event=>{
  const note=noteFor(), rects=rectangles(note.fields.Occlusion); if(!rects || !$('occlusion-picture').complete || event.button!==0)return;
  if(event.target.dataset.rect!==undefined){selectRect(Number(event.target.dataset.rect),rects);return;}
  const box=event.currentTarget.getBoundingClientRect(); if(!box.width||!box.height)return;
  event.currentTarget.setPointerCapture(event.pointerId);
  const point=e=>({x:Math.max(0,Math.min(1,(e.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(e.clientY-box.top)/box.height))});
  const el=document.createElement('div');el.className='mask drawing';event.currentTarget.append(el);
  drawing={guid:note.guid,rects,box,point,start:point(event),el};
};
$('occlusion-overlay').onpointermove=event=>{if(!drawing)return;const end=drawing.point(event),s=drawing.start;Object.assign(drawing.el.style,{left:Math.min(s.x,end.x)*100+'%',top:Math.min(s.y,end.y)*100+'%',width:Math.abs(s.x-end.x)*100+'%',height:Math.abs(s.y-end.y)*100+'%'});};
$('occlusion-overlay').onpointerup=event=>{
  if(!drawing)return;const d=drawing;drawing=null;d.el.remove();if(noteFor()?.guid!==d.guid)return;
  const end=d.point(event),width=Math.abs(d.start.x-end.x),height=Math.abs(d.start.y-end.y),group=Number($('occlusion-group').value);
  if(width*d.box.width<8||height*d.box.height<8||!Number.isInteger(group)||group<1||group>999)return;
  d.rects.push({group,left:Math.min(d.start.x,end.x),top:Math.min(d.start.y,end.y),width,height});selectedRect=d.rects.length-1;updateOcclusion(d.rects);
  $('occlusion-group').value=Math.max(...d.rects.map(r=>r.group))+1;selectedRect=-1;renderOcclusion();
};
$('occlusion-overlay').onpointercancel=()=>{drawing?.el.remove();drawing=null;};
$('occlusion-group').onchange=()=>{const rects=rectangles(noteFor().fields.Occlusion),group=Number($('occlusion-group').value);if(selectedRect>=0&&rects&&Number.isInteger(group)&&group>0&&group<=999){rects[selectedRect].group=group;updateOcclusion(rects);}};
$('delete-rect').onclick=()=>{const rects=rectangles(noteFor().fields.Occlusion);if(selectedRect>=0&&rects){rects.splice(selectedRect,1);selectedRect=-1;updateOcclusion(rects);}};
async function copyText(text) {try{await navigator.clipboard.writeText(text);notice('已复制。');}catch{notice('剪贴板不可用，请手动选择并复制 HTML 或提示词。');}}
for(const button of document.querySelectorAll('[data-command]')) {
  button.onmousedown=event=>event.preventDefault();button.onclick=()=>{
    if(!activeField || !activeField.source.hidden){notice('格式工具用于富文本字段，请先选中内容。');return;}
    activeField.rich.focus();if(selection){const s=window.getSelection();s.removeAllRanges();s.addRange(selection);}
    document.execCommand(button.dataset.command,false);activeField.note.fields[activeField.name]=editorHTML(activeField.rich);changed();rememberSelection();
  };
}
$('insert-cloze').onmousedown=event=>event.preventDefault();
$('insert-cloze').onclick=()=>{
  if(!activeField || !['正文','内容'].includes(activeField.name)){notice('先在正文或内容中选中要挖空的文字或图片。');return;}
  const number=Number($('cloze-number').value),hint=$('cloze-hint').value;
  if(!Number.isInteger(number)||number<1||number>999||/[{}]|::/.test(hint)){notice('编号为 1～999；提示不能包含挖空分隔符。');return;}
  let selected;
  if(!activeField.source.hidden)selected=activeField.source.value.slice(activeField.source.selectionStart,activeField.source.selectionEnd);
  else if(selection && activeField.rich.contains(selection.commonAncestorContainer)){const el=document.createElement('div');el.append(selection.cloneContents());selected=editorHTML(el);}
  if(!selected || /{{c\d+::/.test(selected) || (activeField.note.type==='mindmap'&&/<(?:ul|ol|li)\b/i.test(selected))){notice('请只选择节点中的文字或图片，不包含另一处挖空或列表。');return;}
  insertHTML('{{c'+number+'::'+selected+(hint?'::'+escapeHTML(hint):'')+'}}');$('cloze-number').value=number+1;
};
$('insert-image').onmousedown=event=>event.preventDefault();$('insert-image').onclick=()=>{if(!activeField){notice('先在字段中放置光标。');return;}imagePurpose='field';$('image-file').click();};
$('occlusion-image').onclick=()=>{imagePurpose='occlusion';$('image-file').click();};
$('image-file').onchange=async event=>{
  const note=noteFor(), field=activeField, purpose=imagePurpose; try {
    const name=await addImage(event.target.files[0]); if(noteFor()!==note){changed();return;}
    if(purpose==='occlusion') {stashUndo();note.fields.Image='<img src="'+name+'">';note.fields.Occlusion='';selectedRect=-1;changed(true);openNote(note.guid);notice('图片已更换，这条笔记的旧框已清空，可撤销一次。');}
    else {activeField=field;insertHTML('<img src="'+name+'">');if(field)refreshEditorImages(field.rich);}
  }catch(error){notice(error.message);}event.target.value='';
};
$('new-note').onclick=()=>{if(data.notes.length>=MAX_NOTES){notice('最多 '+MAX_NOTES+' 条，请分批制卡。');return;}const note=newNote(resources.specs.find(s=>s.key===$('new-type').value));data.notes.push(note);changed();openNote(note.guid);};
$('duplicate').onclick=()=>{if(data.notes.length>=MAX_NOTES)return;const note=structuredClone(noteFor());note.guid=freshGuid();data.notes.push(note);changed();openNote(note.guid);};
$('previous').onclick=()=>openNote(data.notes[data.notes.indexOf(noteFor())-1].guid,document.body.dataset.toolView);$('next').onclick=()=>openNote(data.notes[data.notes.indexOf(noteFor())+1].guid,document.body.dataset.toolView);
$('search').oninput=$('type-filter').onchange=$('error-filter').onchange=renderList;
$('tags').oninput=()=>{noteFor().tags=tagsFrom($('tags').value);changed();};$('deck').oninput=()=>{data.deck=$('deck').value;changed();};
$('select-all').onclick=()=>{const visible=visibleNotes();const all=visible.every(n=>chosen.has(n.guid));for(const n of visible){if(all)chosen.delete(n.guid);else chosen.add(n.guid);}renderList();};
$('apply-tags').onclick=()=>{const tags=tagsFrom($('batch-tags').value);for(const note of data.notes)if(chosen.has(note.guid))note.tags=[...new Set([...note.tags,...tags])];changed();if(noteFor())$('tags').value=noteFor().tags.join(' ');};
$('delete-selected').onclick=()=>{stashUndo();data.notes=data.notes.filter(n=>!chosen.has(n.guid));chosen.clear();changed(true);openNote(noteFor()?.guid || data.notes[0]?.guid);};
$('undo').onclick=()=>{if(!undo)return;data=undo;undo=null;chosen.clear();$('deck').value=data.deck;changed();openNote(data.notes.find(n=>n.guid===current)?.guid||data.notes[0]?.guid);};
$('load-samples').onclick=async()=>{
  if(data.notes.length+resources.samples.length>MAX_NOTES){notice('示例会超过笔记数量上限，请先分批备份。');return;}
  const copies=normalizeNotes(resources.samples.map(s=>({...s,guid:freshGuid()})),resources.specs);stashUndo();data.notes.push(...copies);changed(true);openNote(copies[0].guid);
};
$('flip').onclick=()=>{clearTimeout(previewTimer);back=!back;renderPreview(!back);};$('viewport').onchange=()=>{$('preview').dataset.viewport=$('viewport').value;};
window.addEventListener('themechange',()=>applyPreviewTheme($('preview')));$('preview').onload=()=>applyPreviewTheme($('preview'));
function resetImport() {importRevision++;incoming=null;importSource=null;$('apply-import').disabled=true;$('import-status').textContent='';}
const dialogOpeners = new WeakMap();
function openDialog(id, opener = document.activeElement) {
  const dialog = $(id);
  const menu=document.querySelector('.workspace-menu');
  dialogOpeners.set(dialog, menu.contains(opener) ? menu.querySelector('summary') : opener);
  menu.open=false;
  dialog.showModal();
}
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', () => {
  const opener = dialogOpeners.get(dialog);
  if (opener?.isConnected && !document.querySelector('dialog[open]')) opener.focus({preventScroll:true});
}));
$('import-open').onclick=()=>{resetImport();openDialog('import-dialog',$('import-open'));};
$('import-text').oninput=$('import-type').onchange=$('delimiter').onchange=resetImport;
$('import-file').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>MAX_BYTES)throw new Error('文件超过 40 MiB');$('import-text').value=await file.text();if(file.name.endsWith('.csv'))$('delimiter').value='comma';resetImport();}catch(error){$('import-status').textContent=error.message;}event.target.value='';};
$('check-import').onclick=async()=>{
  resetImport();const version=importRevision;try {
    const source=$('import-text').value;
    const parsed=importText(source,resources.specs,$('import-type').value,$('delimiter').value==='comma'?',':'\t');
    await verifyMediaNames(parsed.media);
    if(version!==importRevision)return;
    incoming=parsed;
    const merged=mergeWorkspace(data,incoming), media=[...reservedMedia.keys(),...merged.media.map(m=>m.name)], invalid=incoming.notes.filter(n=>validateNote(n,specFor(n),media).length).length;
    if(!incoming.notes.length)throw new Error('没有可导入的笔记');
    const updates=incoming.notes.filter(n=>data.notes.some(old=>old.guid===n.guid)).length;
    importSource=$('import-text').value;
    $('import-status').textContent='共 '+incoming.notes.length+' 条；新增 '+(incoming.notes.length-updates)+' 条，更新 '+updates+' 条。'+(invalid?invalid+' 条需要在草稿中修正。':'字段检查通过。')+(data.notes.length&&data.deck!==incoming.deck?' 当前目标牌组保持为 '+data.deck+'。':'');
    $('apply-import').disabled=false;
  }catch(error){if(version!==importRevision)return;incoming=null;$('import-status').textContent='无法导入：'+error.message;}
};
$('apply-import').onclick=()=>{if(!incoming||importSource!==$('import-text').value)return;try{stashUndo();data=mergeWorkspace(data,incoming);$('deck').value=data.deck;chosen.clear();changed(true);openNote(incoming.notes[0].guid);$('import-dialog').close();resetImport();notice('已合并，可在笔记列表逐条核对。');}catch(error){$('import-status').textContent=error.message;}};
$('download-header').onclick=()=>{const spec=resources.specs.find(s=>s.key===$('import-type').value),sep=$('delimiter').value==='comma'?',':'\t';download(spec.name+(sep===','?'.csv':'.tsv'),[...spec.fields,'标签'].join(sep)+'\n','text/plain;charset=utf-8');};
function exportProblems() {let global;try{normalizeWorkspace(data,resources.specs);}catch(error){global=error.message;}return {global,invalid:data.notes.filter(n=>errorsFor(n).length),valid:data.notes.filter(n=>!errorsFor(n).length)};}
$('export-open').onclick=()=>{const {global,invalid,valid}=exportProblems();$('export-status').textContent=global?'工作空间需要修正：'+global:'共 '+data.notes.length+' 条，其中 '+valid.length+' 条可导入，'+invalid.length+' 条待修正。';$('valid-only').checked=false;openDialog('export-dialog',$('export-open'));};
const jsonName=()=>data.deck.replace(/[\\/:*?"<>|]/g,'-').trim() || '我的制卡';
$('reset-open').onclick=()=>{$('reset-status').textContent='当前有 '+data.notes.length+' 条笔记、'+data.media.length+' 张本地图片。';openDialog('reset-dialog',$('reset-open'));};
$('reset-backup').onclick=()=>download(jsonName()+'.json',JSON.stringify(data,null,2)+'\n','application/json');
$('reset-workspace').onclick=()=>{stashUndo();data=workspace();current=null;chosen.clear();modes.clear();$('deck').value=data.deck;$('search').value='';$('type-filter').value='';$('error-filter').checked=false;changed(true);openNote();$('reset-dialog').close();notice('已开始新的工作空间，可撤销一次。');};
$('export-json').onclick=()=>{download(jsonName()+'.json',JSON.stringify(data,null,2)+'\n','application/json');notice('JSON 已导出，包含全部草稿和图片。');};
$('export-zip').onclick=async()=>{
  try{
    const {global,invalid,valid}=exportProblems();if(global)throw new Error(global);if(invalid.length&&!$('valid-only').checked)throw new Error('有 '+invalid.length+' 条待修正笔记。请修正，或勾选仅导出通过检查的笔记。');if(!valid.length)throw new Error('没有通过检查的笔记');
    const files=[['workspace.json',JSON.stringify(data,null,2)+'\n']];
    for(const spec of resources.specs){const notes=valid.filter(n=>n.type===spec.key);if(notes.length)files.push([spec.name+'.tsv',ankiTSV(notes,spec,data.deck)]);}
    for(const media of data.media)files.push(['media/'+media.name,mediaBytes(media)]);
    for(const [name,url] of reservedMedia)if(valid.some(n=>Object.values(n.fields).some(f=>f.includes(name))))files.push(['media/'+name,new Uint8Array(await (await fetch(url)).arrayBuffer())]);
    files.push(['导入说明.txt','1. 先在 Anki Desktop 导入本项目 downloads/anki-template.apkg，安装五个笔记类型。\n2. 将 media 中的文件平铺复制到当前集合的 collection.media（不要复制子目录）。\n3. 逐一导入各类型 TSV；检查笔记类型、同名字段映射、允许 HTML、标签、牌组、GUID。\n4. 核对实际卡片、原生分卡和媒体，再同步到手机。相同 GUID 更新原笔记；请保留 GUID。\nworkspace.json 含全部草稿和图片；本次有 '+invalid.length+' 条待修正笔记未放入 TSV。\n完整说明：https://github.com/zzpice/anki-template/blob/main/docs/authoring.md\n']);
    download(jsonName()+'.zip',zipFiles(files),'application/zip');notice('已导出 '+valid.length+' 条笔记；JSON 备份保留全部草稿。');
  }catch(error){$('export-status').textContent='无法导出：'+error.message;}
};
$('ai-open').onclick=()=>openDialog('ai-dialog',$('ai-open'));$('build-prompt').onclick=()=>{const spec=resources.specs.find(s=>s.key===$('ai-type').value),count=Number($('ai-count').value);if(!Number.isInteger(count)||count<1||count>100){$('ai-status').textContent='预计笔记数为 1～100。';return;}$('ai-prompt').value=promptFor(spec,$('ai-content').value,count);$('ai-status').textContent='提示词已生成。复制到外部 AI，回填后逐条核对。';};
$('copy-prompt').onclick=()=>copyText($('ai-prompt').value);$('return-import').onclick=()=>{$('ai-dialog').close();resetImport();openDialog('import-dialog',$('import-open'));};
const cardsURL = new URL('../../cards/',import.meta.url);
async function loadText(name) {const response=await fetch(new URL(name,cardsURL));if(!response.ok)throw new Error(name+'：'+response.status);return response.text();}
async function start() {
  $('retry-load').hidden=true; $('load-message').textContent='正在准备制卡工作区…';$('main').setAttribute('aria-busy','true');
  try {
    const [specs,css,samples]=await Promise.all(['note-types.json','style.css','samples.json'].map(loadText));
    resources={specs:JSON.parse(specs),css,samples:JSON.parse(samples),templates:{}};
    for(const name of [...new Set(resources.specs.filter(s=>s.kind==='basic').flatMap(s=>[s.front,s.back]))])resources.templates[name]=await loadText(name);
    for(const sample of resources.samples)for(const value of Object.values(sample.fields)){const doc=new DOMParser().parseFromString(value,'text/html');for(const img of doc.querySelectorAll('img')){const src=img.getAttribute('src');if(/^_[\w.-]+\.(svg|png|jpg|gif|webp)$/.test(src))reservedMedia.set(src,new URL('media/'+src,cardsURL).href);}}
    for(const id of ['new-type','type-filter','import-type','ai-type'])$(id).querySelectorAll('option[value]:not([value=""])').forEach(option=>option.remove());
    for(const id of ['new-type','type-filter','import-type','ai-type'])for(const spec of resources.specs){if(id==='ai-type'&&spec.kind==='occlusion')continue;const option=document.createElement('option');option.value=spec.key;option.textContent=spec.name;$(id).append(option);}
    try{store=await openWorkspaceStore();const record=await store.read();revision=record.revision;if(record.data)data=normalizeWorkspace(record.data,resources.specs,true);saveStatus('已读取本地草稿 · 请定期下载 JSON 备份');}
    catch(error){store=null;saveStatus('无法读取本地草稿：'+error.message+'。当前页面可编辑和导出，请勿依赖缓存。',true);}
    $('deck').value=data.deck;$('app').hidden=false;$('load-state').hidden=true;$('main').setAttribute('aria-busy','false');document.querySelectorAll('[data-ready]').forEach(button=>button.disabled=false);openNote(data.notes[0]?.guid);
  }catch(error){$('main').setAttribute('aria-busy','false');$('load-message').textContent='暂时无法加载制卡工具，请检查网络后重试。';$('retry-load').hidden=false;saveStatus('工具加载失败，本地草稿未被修改。',true);}
}
function setToolView(view) {
  if (view==='preview' && !noteFor()) {notice('先新建或选择一条笔记，再查看预览。');return;}
  if (view==='edit' && !noteFor() && window.innerWidth<=760) {view='notes';}
  document.body.dataset.toolView=view;
  document.querySelectorAll('[data-tool-view]').forEach(button=>{if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.toolView===view));});
  if(view==='preview')$('preview-panel').open=true;
}
document.querySelectorAll('button[data-tool-view]').forEach(button=>button.onclick=()=>setToolView(button.dataset.toolView));
$('welcome-new').onclick=()=>$('new-note').click();
$('list-samples').onclick=()=>$('load-samples').click();
$('retry-load').onclick=start;
const workspaceMenu=document.querySelector('.workspace-menu');
document.addEventListener('pointerdown',event=>{if(workspaceMenu.open&&!workspaceMenu.contains(event.target))workspaceMenu.open=false;});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&workspaceMenu.open){event.preventDefault();workspaceMenu.open=false;workspaceMenu.querySelector('summary').focus();return;}
  if(event.isComposing || document.querySelector('dialog[open]'))return;
  if((event.metaKey||event.ctrlKey)&&event.shiftKey&&event.key.toLowerCase()==='e'&&resources){event.preventDefault();$('export-open').click();}
  if((event.metaKey||event.ctrlKey)&&event.altKey&&event.key.toLowerCase()==='n'&&resources){event.preventDefault();$('new-note').click();}
  if(event.key==='/'&&!event.target.closest('input,textarea,[contenteditable=true]')){event.preventDefault();setToolView('notes');$('search').focus();}
});
start();
