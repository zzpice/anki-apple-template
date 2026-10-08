/* Copyright (c) 2026 zzpice. MIT License. */
import {escapeHTML} from './data.mjs';
const allowed = new Set('p div span b strong i em u s sub sup ul ol li br hr img a table thead tbody tfoot tr th td pre code blockquote h1 h2 h3 h4 h5 h6 dl dt dd'.split(' '));
// A static rich-text view: imported active markup never runs in the editor/iframe.
export function safeHTML(html, media = new Map()) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const remove = new Set('script style iframe object embed form input button textarea link meta svg math template'.split(' '));
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    const tag = el.tagName.toLowerCase();
    if (remove.has(tag)) { el.remove(); continue; }
    if (!allowed.has(tag)) { el.replaceWith(...el.childNodes); continue; }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name, value = attr.value;
      const keep = ['alt','title','width','height','colspan','rowspan','start'].includes(name) ||
        (name === 'class' && value === 'no-zoom') || (name === 'src' && tag === 'img') || (name === 'href' && tag === 'a');
      if (!keep) el.removeAttribute(name);
    }
    if (tag === 'img') {
      const src = el.getAttribute('src') || '';
      if (media.has(src)) el.setAttribute('src',media.get(src));
      else if (!/^at-[a-f0-9]{32}\.(png|jpg|webp|gif)$/.test(src) && !/^_[\w.-]+\.(png|jpg|webp|gif|svg)$/.test(src)) el.removeAttribute('src');
    }
    if (tag === 'a') {
      const href = el.getAttribute('href') || '';
      if (!/^(https?:\/\/|mailto:|#)/i.test(href)) el.removeAttribute('href');
      el.setAttribute('target','_blank'); el.setAttribute('rel','noopener noreferrer');
    }
  }
  return doc.body.innerHTML;
}
export function templateHTML(source, fields) {
  // This only substitutes the current basic/choice templates. Native Cloze is
  // never parsed in the browser; Anki renders its authoritative cards.
  function conditions(text) {
    return text.replace(/{{([#^])([^}]+)}}([\s\S]*?){{\/\2}}/g, (_,kind,name,content) =>
      (kind === '#' ? !!fields[name] : !fields[name]) ? conditions(content) : '');
  }
  source = conditions(source);
  return source.replace(/{{([^}]+)}}/g, (_,name) => fields[name] || '');
}
export function makePreview(resources, note, media, back = false, resume = false) {
  const spec = resources.specs.find(s => s.key === note.type);
  const fields = Object.fromEntries(Object.entries(note.fields).map(([name,value]) => [name,safeHTML(value,media)]));
  fields.Tags = escapeHTML(note.tags.join(' '));
  let content;
  if (spec.kind === 'basic') {
    fields.FrontSide = templateHTML(resources.templates[spec.front],fields);
    content = back ? templateHTML(resources.templates[spec.back],fields) : fields.FrontSide;
    content = content.replace(/src="_review.js"/g,'src="' + new URL('../../cards/media/_review.js',import.meta.url).href + '"');
  } else {
    const title = note.fields.标题 || note.fields.章节 || note.fields.Header || spec.name;
    const body = spec.kind === 'occlusion' ? fields.Image + fields['Back Extra'] + fields.Comments : fields[note.type === 'mindmap' ? '内容' : '正文'];
    content = '<article class="review-sheet"><header class="review-context">' + safeHTML(title,media) + '</header><div class="content review-question">' + body + '</div></article>';
  }
  // Only the project's own review script can execute. No user scripts, remote
  // media, form submissions or inherited styles can affect the working page.
  const script = new URL('../../cards/media/_review.js',import.meta.url).href;
  const base = new URL('../../cards/media/',import.meta.url).href;
  const policy = "default-src 'none'; script-src " + script + "; style-src 'unsafe-inline'; img-src data: blob: " + base + "; form-action 'none'; base-uri " + base;
  return '<!doctype html><html lang="zh-CN" class="' + (document.documentElement.dataset.theme === 'dark' ? 'nightMode' : '') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="' + policy + '"><base href="' + base + '"><style>' + window.ankiTheme.cardCSS(resources.css) + '</style></head><body class="card"' + (resume ? ' data-review-resume' : '') + '>' + content + '</body></html>';
}
export function applyPreviewTheme(frame) {
  window.ankiTheme.applyToFrame(frame);
}
