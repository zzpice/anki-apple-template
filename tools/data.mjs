/* Copyright (c) 2026 zzpice. MIT License. */
// The note type specification is supplied by note-types.json; no parallel fields.
export const FORMAT = 'anki-template-workspace';
export const MAX_BYTES = 40 * 1024 * 1024;
export const MAX_NOTES = 5000;
export const MIME = {'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'image/gif':'gif'};
export const freshGuid = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), n => n.toString(16).padStart(2, '0')).join('');
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export const textOnly = value => decodeEntities(String(value).replace(/<[^>]*>/g, '')).trim();
function decodeEntities(text) { return text.replace(/&#(x[0-9a-f]+|[0-9]+);?/gi, (_,n) => String.fromCodePoint(Math.min(0x10ffff, parseInt(n.replace(/^x/i,''), /^x/i.test(n)?16:10) || 0))).replace(/&(?:nbsp|colon|tab|newline);/gi, m => ({'&nbsp;':' ', '&colon;':':', '&tab;':'\t', '&newline;':'\n'}[m.toLowerCase()])); }
export const tagsFrom = value => [...new Set(String(value).trim().split(/\s+/).filter(Boolean))];
export function newNote(spec) {
  return {guid:freshGuid(), type:spec.key, fields:Object.fromEntries(spec.fields.map(name => [name, ''])), tags:[]};
}
export function workspace() { return {format:FORMAT, version:1, deck:'我的制卡', notes:[], media:[]}; }
export function mediaBytes(media) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]*={0,2})$/.exec(media.data);
  if (!match || match[2].length % 4) throw new Error('媒体必须是 PNG、JPEG、WebP 或 GIF 的 base64 数据');
  return Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
}
export function checkMedia(media) {
  if (!media || typeof media.name !== 'string' || !/^at-[a-f0-9]{32}\.(png|jpg|webp|gif)$/.test(media.name)) throw new Error('媒体文件名无效');
  const bytes = mediaBytes(media);
  const hex = Array.from(bytes.slice(0,12), n => n.toString(16).padStart(2,'0')).join('');
  const mime = media.data.slice(5, media.data.indexOf(';'));
  if (!bytes.length || bytes.length > 10 * 1024 * 1024 || !media.name.endsWith('.' + MIME[mime]) ||
      !(mime === 'image/png' ? hex.startsWith('89504e470d0a1a0a') :
        mime === 'image/jpeg' ? hex.startsWith('ffd8ff') :
        mime === 'image/gif' ? hex.startsWith('474946383761') || hex.startsWith('474946383961') :
        hex.startsWith('52494646') && hex.slice(16) === '57454250')) throw new Error('媒体格式、大小或文件名与内容不一致');
}
export function normalizeNotes(input, specs, draft = false) {
  if (!Array.isArray(input) || input.length > MAX_NOTES) throw new Error('笔记必须为数组，最多 ' + MAX_NOTES + ' 条');
  const guids = new Set();
  return input.map((source, index) => {
    const fail = message => { throw new Error('第 ' + (index + 1) + ' 条：' + message); };
    const spec = specs.find(s => s.key === source?.type);
    if (!spec) fail('未知笔记类型');
    if (!source.fields || typeof source.fields !== 'object' || Array.isArray(source.fields)) fail('缺少 fields 对象');
    if (Object.keys(source.fields).some(key => !spec.fields.includes(key))) fail('含不属于此类型的字段');
    const fields = Object.fromEntries(spec.fields.map(name => {
      const value = source.fields[name] ?? '';
      if (typeof value !== 'string' || /\x00|\x1f/.test(value)) fail('字段必须是文字且不能含内部控制字符');
      return [name, value];
    }));
    const guid = source.guid ?? freshGuid();
    if (typeof guid !== 'string' || !/^[!-~]{1,64}$/.test(guid) || /["'\\]/.test(guid) || guids.has(guid)) fail('GUID 无效或重复');
    guids.add(guid);
    if (source.tags !== undefined && (!Array.isArray(source.tags) || source.tags.some(t => typeof t !== 'string' || (!draft && (!t || /\s|[<>\x00-\x1f]/.test(t)))))) fail('标签须为不含空白的文字数组');
    return {guid, type:spec.key, fields, tags:[...new Set(source.tags || [])]};
  });
}
export function normalizeWorkspace(input, specs, draft = false) {
  if (!input || input.format !== FORMAT || input.version !== 1) throw new Error('不支持的工作空间版本');
  if (typeof input.deck !== 'string' || (!draft && (!input.deck.trim() || /[\r\n\t\x00-\x1f<>]/.test(input.deck) || input.deck.split('::').some(s => !s.trim())))) throw new Error('牌组名称不能为空，且不能包含控制字符或空层级');
  if (!Array.isArray(input.media) || input.media.length > 1000) throw new Error('media 必须为数组，最多 1000 个文件');
  const names = new Set();
  const media = input.media.map(m => {
    checkMedia(m);
    if (names.has(m.name)) throw new Error('媒体文件名重复');
    names.add(m.name); return {name:m.name, data:m.data};
  });
  return {format:FORMAT, version:1, deck:input.deck, notes:normalizeNotes(input.notes, specs, draft), media};
}
// A strict CSV/TSV reader. Quoted tabs, quotes and multiline HTML survive.
export function parseDelimited(text, delimiter) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  function endCell() { row.push(cell); cell = ''; closed = false; }
  function endRow() { endCell(); if (row.some(v => v !== '')) rows.push(row); row = []; }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += c;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === delimiter) endCell();
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i+1] === '\n') i++; endRow(); }
    else { if (closed || c === '"') throw new Error('分隔文件的引号格式不正确'); cell += c; }
  }
  if (quoted) throw new Error('分隔文件存在未闭合引号');
  if (cell || row.length || closed) endRow();
  return rows;
}
export const quoteCell = value => '"' + String(value).replace(/"/g, '""') + '"';
export function ankiTSV(notes, spec, deck) {
  if (notes.some(n => !textOnly(n.fields[spec.fields[0]]) && !/<img\b/i.test(n.fields[spec.fields[0]]))) throw new Error(spec.name+'的首字段「'+spec.fields[0]+'」为空，Anki 文本导入会跳过。请填写它，或下载完整 JSON 用官方生成器构包；原生字段仍允许留空。');
  const names = [...spec.fields, '标签', '牌组', 'GUID'];
  const head = ['#separator:Tab', '#html:true', '#notetype:' + spec.name,
    '#tags column:' + (spec.fields.length+1), '#deck column:' + (spec.fields.length+2),
    '#guid column:' + (spec.fields.length+3), '#columns:' + names.join('\t')];
  return head.join('\n') + '\n' + notes.map(note => [...spec.fields.map(n => note.fields[n]), note.tags.join(' '), deck, note.guid].map(quoteCell).join('\t')).join('\n') + '\n';
}
export function importText(text, specs, type, delimiter = '\t') {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('文件超过 40 MiB');
  text = text.trim().replace(/^\uFEFF/, '');
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(text);
  if (fenced) text = fenced[1];
  if (/^[\[{]/.test(text)) {
    let data; try { data = JSON.parse(text); } catch { throw new Error('JSON 格式不正确，请检查引号和括号'); }
    if (Array.isArray(data)) return {...workspace(), notes:normalizeNotes(data, specs)};
    return normalizeWorkspace(data, specs, true);
  }
  const spec = specs.find(s => s.key === type);
  if (!spec) throw new Error('请选择分隔文件对应的笔记类型');
  // Also read the very same Anki TSVs exported by this tool.
  let columns, declaredType;
  while (text.startsWith('#')) {
    const end = text.indexOf('\n'); if (end === -1) throw new Error('文件没有笔记内容');
    const line = text.slice(0,end).replace(/\r$/, ''); text = text.slice(end+1);
    if (line.startsWith('#notetype:')) declaredType = line.slice(10);
    if (line.startsWith('#columns:')) columns = line.slice(9).split('\t');
    if (line === '#separator:Comma') delimiter = ',';
    if (line === '#separator:Tab') delimiter = '\t';
  }
  if (declaredType && declaredType !== spec.name && declaredType !== String(spec.id)) throw new Error('文件笔记类型与所选类型不同');
  const rows = parseDelimited(text, delimiter);
  columns = columns || rows.shift();
  if (!columns?.length || new Set(columns).size !== columns.length || !spec.fields.some(name => columns.includes(name))) throw new Error('首行须为同名字段表头');
  if (columns.some(name => ![...spec.fields,'标签','牌组','GUID'].includes(name))) throw new Error('表头存在未知字段');
  let deck;
  const notes = rows.map((row, index) => {
    if (row.length !== columns.length) throw new Error('数据第 ' + (index+1) + ' 行列数不一致');
    const values = Object.fromEntries(columns.map((name, i) => [name, row[i]]));
    if (values.牌组) { if (deck && deck !== values.牌组) throw new Error('一次工作空间导入只支持一个牌组'); deck = values.牌组; }
    return {type, ...(values.GUID ? {guid:values.GUID} : {}), tags:tagsFrom(values.标签 || ''), fields:Object.fromEntries(spec.fields.map(n => [n, values[n] || '']))};
  });
  return normalizeWorkspace({...workspace(), deck:deck || '我的制卡', notes}, specs);
}
export function mergeWorkspace(current, incoming) {
  const next = structuredClone(current);
  for (const media of incoming.media) {
    const existing = next.media.find(m => m.name === media.name);
    if (existing && existing.data !== media.data) throw new Error('同名媒体内容冲突：' + media.name);
    if (!existing) next.media.push(media);
  }
  for (const note of incoming.notes) {
    const index = next.notes.findIndex(n => n.guid === note.guid);
    if (index >= 0 && next.notes[index].type !== note.type) throw new Error('同一 GUID 不能改变笔记类型，请创建新笔记');
    if (index >= 0) next.notes[index] = note;
    else next.notes.push(note);
  }
  if (next.notes.length > MAX_NOTES) throw new Error('最多 ' + MAX_NOTES + ' 条笔记');
  if (!current.notes.length) next.deck = incoming.deck;
  if (next.media.length > 1000 || new TextEncoder().encode(JSON.stringify(next)).length > MAX_BYTES) throw new Error('合并后的工作空间超过图片数量或 40 MiB 上限，请分批制卡');
  return next;
}
export const clozeNumbers = html => [...new Set(Array.from(html.matchAll(/{{c([1-9]\d*)::/g), m => Number(m[1])))].sort((a,b) => a-b);
// Authoring subset only. Never interprets or renders Cloze answers.
export function rectangles(html) {
  const pieces = html.split(/<br\s*\/?>(?:\s*)|\r?\n/).filter(s => s.trim());
  const result = [];
  for (const piece of pieces) {
    const m = /^{{c([1-9]\d*)::image-occlusion:rect:left=([\d.]+):top=([\d.]+):width=([\d.]+):height=([\d.]+):oi=1}}$/.exec(piece.trim());
    if (!m) return null;
    const [group,left,top,width,height] = m.slice(1).map(Number);
    if (![left,top,width,height].every(Number.isFinite) || left < 0 || top < 0 || width <= 0 || height <= 0 || left+width > 1.00001 || top+height > 1.00001) return null;
    result.push({group,left,top,width,height});
  }
  return result;
}
export function rectangleHTML(rects) {
  const number = n => String(Math.round(n * 1000000) / 1000000);
  return rects.map(r => '{{c' + r.group + '::image-occlusion:rect:left=' + number(r.left) + ':top=' + number(r.top) + ':width=' + number(r.width) + ':height=' + number(r.height) + ':oi=1}}').join('<br>');
}
export function validateNote(note, spec, availableMedia = []) {
  const errors = []; const fields = note.fields;
  if (note.tags.some(t => !t || /\s|[<>\x00-\x1f]/.test(t))) errors.push('标签不能包含空白、尖括号或控制字符');
  const requireContent = name => { if (!textOnly(fields[name]) && !/<img\b/i.test(fields[name])) errors.push(name + '不能为空'); };
  if (spec.kind === 'basic') { requireContent('问题'); requireContent('答案'); }
  if (note.type === 'choice') {
    const parts = fields.选项.split('||'), type = textOnly(fields.题型), answer = textOnly(fields.答案).toUpperCase().replace(/[\s,，、]/g, '');
    if (parts.length < 2 || parts.length > 26 || parts.some(p => !textOnly(p) && !/<img\b/i.test(p))) errors.push('选项需要 2～26 个非空项，以 || 分隔');
    if (!['','单选','多选','判断'].includes(type)) errors.push('题型须留空或为单选、多选、判断');
    if (!/^[A-Z]+$/.test(answer) || new Set(answer).size !== answer.length || Array.from(answer).some(c => c.charCodeAt(0)-65 >= parts.length)) errors.push('答案须是录入顺序对应的字母，且不能重复或越界');
    if (type !== '多选' && answer.length !== 1) errors.push('单选或判断只能选一个答案');
    if (type === '判断' && fields.选项 !== '正确||错误') errors.push('判断的选项须为 正确||错误');
  }
  if (spec.kind === 'cloze') {
    const html = fields[note.type === 'mindmap' ? '内容' : '正文'];
    if (!clozeNumbers(html).length) errors.push('至少需要一处原生 {{c1::答案}} 挖空');
    if (/{{c0\d*::|{{c\d+::\s*(?:::.*?)?}}/.test(html) || (html.match(/{{c\d+::/g) || []).length > (html.match(/}}/g) || []).length) errors.push('挖空为空、编号为零或括号未配对');
    if (note.type === 'mindmap') {
      const tokens = html.match(/{{c\d+::[\s\S]*?}}/g) || [];
      if (tokens.some(t => /<(?:ul|ol|li)\b|{{c\d+::[\s\S]*{{c\d+::/i.test(t))) errors.push('导图挖空须在节点内容中，不能包含子列表或嵌套挖空');
    }
  }
  if (spec.kind === 'occlusion') {
    if (!/<img\b/i.test(fields.Image)) errors.push('需要一张图片');
    if (!clozeNumbers(fields.Occlusion).length || !fields.Occlusion.includes('image-occlusion:')) errors.push('请在图片上绘制遮挡，或导入原生遮挡字段');
  }
  for (const html of Object.values(fields)) {
    errors.push(...markupErrors(html, availableMedia));
    if (/\[sound:/.test(html)) errors.push('当前媒体工具支持图片；音频请在 Anki 中添加');
  }
  return [...new Set(errors)];
}
export function markupErrors(html, availableMedia) {
  const errors = [];
  for (const token of html.matchAll(/<([a-z][a-z0-9-]*)([\s/][^<>]*?)?\s*\/?>/gi)) {
    const tag = token[1].toLowerCase();
    if (['script','iframe','object','embed','form','input','button','textarea','link','meta','style','svg','math','template','base'].includes(tag)) errors.push('字段包含不能用于制卡的活动内容，请在 HTML 模式移除');
    for (const attr of (token[2] || '').matchAll(/([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g)) {
      const name = attr[1].toLowerCase(), value = decodeEntities(attr[2] ?? attr[3] ?? attr[4] ?? '');
      if (name.startsWith('on') || /(?:javascript|vbscript):/i.test(value.replace(/[\s\x00-\x1f]/g,'')) ||
          name === 'srcset' || name === 'poster' || (name === 'style' && /url\s*\(|expression\s*\(|@import|\\/i.test(value))) errors.push('字段包含活动属性或远程样式，请在 HTML 模式移除');
      if (name === 'src' && ['img','audio','video','source'].includes(tag) && !availableMedia.includes(value)) errors.push('缺少本地媒体：' + value);
    }
  }
  return errors;
}
export async function verifyMediaNames(media) {
  for (const m of media) {
    const hash = await crypto.subtle.digest('SHA-256',mediaBytes(m));
    const digest = Array.from(new Uint8Array(hash).slice(0,16),n => n.toString(16).padStart(2,'0')).join('');
    if (!m.name.startsWith('at-' + digest + '.')) throw new Error('媒体内容与名称不一致：' + m.name);
  }
}
export function promptFor(spec, content, count) {
  const example = {type:spec.key, fields:Object.fromEntries(spec.fields.map(n => [n, ''])), tags:[]};
  return '根据下方材料整理 ' + count + ' 条可核对的 Anki 笔记。只使用材料支持的事实，不确定处留待人工核对，不编造来源。每条聚焦一个可回忆的知识点。\n' +
    '只输出 JSON 数组，不含解释；结构如下（字段名和类型必须完全相同）：\n' + JSON.stringify([example], null, 2) + '\n' +
    '字段使用静态 HTML 富文本；纯文字中的 < > & 要转义。不要使用 Markdown、脚本、事件属性或远程媒体。可选字段留空，tags 为不含空格的字符串数组。不要生成 guid。\n' +
    (spec.key === 'choice' ? '选项用 || 分隔 2～26 项，不加字母。答案按录入顺序填写大写字母；单选一字母、多选连写；判断用 正确||错误 和 A/B。题型只为 单选、多选、判断。\n' : '') +
    (spec.kind === 'cloze' ? '挖空仅用原生 {{c1::答案}} 或 {{c1::答案::提示}}；不同编号分卡，同号一起遮住。至少一处挖空。\n' : '') +
    (spec.key === 'mindmap' ? '内容为普通 ul/ol > li 嵌套列表；保留章节上下文，挖空在节点文字中，不能包裹子列表或另一处挖空。\n' : '') +
    '\n材料：\n' + content;
}
