/*
MIT License

Copyright (c) 2026 zzpice

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
(function () {
  var back = !!document.getElementById('answer');
  var sheets = document.querySelectorAll('[data-review]');

  function openImage(image, sheet) {
    var dialog = document.createElement('dialog');
    dialog.className = 'review-zoom';
    dialog.setAttribute('aria-label', '图片放大');
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = '关闭';
    var enlarged = document.createElement('img');
    enlarged.src = image.currentSrc || image.src;
    enlarged.alt = image.alt;
    dialog.appendChild(close);
    dialog.appendChild(enlarged);
    sheet.appendChild(dialog);
    dialog.addEventListener('click', function (event) {
      event.stopPropagation();
      dialog.close();
    });
    dialog.addEventListener('close', function () { dialog.remove(); });
    dialog.showModal();
  }

  function choices(sheet) {
    var options = sheet.querySelector('[data-options]');
    if (!options) return;
    if (!options.dataset.ready) {
      // 字段留在 HTML 中读取；不把用户内容插进 JavaScript 字符串。
      var parts = options.innerHTML.split('||');
      if (parts.length < 2 || parts.length > 26) return;
      options.textContent = '';
      var type = sheet.querySelector('[data-question-type]');
      var multi = type && type.textContent.trim() === '多选';
      parts.forEach(function (html, index) {
        var key = String.fromCharCode(65 + index);
        var row = document.createElement('div');
        row.className = 'review-choice';
        row.dataset.key = key;
        var input = document.createElement('input');
        input.type = multi ? 'checkbox' : 'radio';
        input.name = 'review-choice';
        input.id = 'review-choice-' + key;
        var label = document.createElement('label');
        label.htmlFor = input.id;
        var letter = document.createElement('span');
        letter.className = 'review-choice-key';
        letter.textContent = key;
        var content = document.createElement('div');
        content.className = 'content';
        content.innerHTML = html.trim();
        label.appendChild(letter);
        label.appendChild(content);
        row.appendChild(input);
        row.appendChild(label);
        options.appendChild(row);
      });
      options.dataset.ready = 'true';
    }
    if (!back) return;
    var answer = document.querySelector('[data-answer]');
    var key = answer ? (answer.dataset.key || answer.textContent).toUpperCase().replace(/[\s,，、]/g, '') : '';
    var rows = options.querySelectorAll('.review-choice');
    var valid = /^[A-Z]+$/.test(key) && key.split('').every(function (letter) {
      return letter.charCodeAt(0) - 65 < rows.length;
    });
    if (valid && !answer.dataset.key) {
      answer.dataset.key = key;
      answer.textContent = '';
      rows.forEach(function (row) {
        if (key.indexOf(row.dataset.key) === -1) return;
        var item = document.createElement('div');
        item.className = 'review-answer-choice';
        var letter = document.createElement('span');
        letter.className = 'review-choice-key';
        letter.textContent = row.dataset.key;
        item.appendChild(letter);
        item.appendChild(row.querySelector('.content').cloneNode(true));
        answer.appendChild(item);
      });
    }
    rows.forEach(function (row) {
      row.querySelector('input').disabled = true;
      if (valid && key.indexOf(row.dataset.key) !== -1 && !row.querySelector('.review-correct')) {
        row.classList.add('is-correct');
        var mark = document.createElement('span');
        mark.className = 'review-correct';
        mark.textContent = '✓ 正确';
        row.appendChild(mark);
      }
    });
  }

  sheets.forEach(function (sheet) {
    choices(sheet);
    sheet.querySelectorAll('.review-context, .review-meta').forEach(function (element) {
      if (!element.childElementCount && !element.textContent.trim()) element.hidden = true;
    });
    sheet.querySelectorAll('table').forEach(function (table) {
      if (table.parentElement.classList.contains('review-scroll')) return;
      var wrapper = document.createElement('div');
      wrapper.className = 'review-scroll';
      wrapper.tabIndex = 0;
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', '表格，可左右滚动');
      table.before(wrapper);
      wrapper.appendChild(table);
    });
    if (sheet.dataset.events) return;
    sheet.dataset.events = 'true';
    // 所有监听和放大层属于当前卡片；换卡移除 DOM 即清理，无全局状态。
    sheet.addEventListener('click', function (event) {
      var target = event.target;
      if (target.closest('.review-choice, details, #toggle')) event.stopPropagation();
      var image = target.closest('img');
      if (!image || image.closest('a, button, #image-occlusion-container') ||
          image.classList.contains('no-zoom')) return;
      event.preventDefault();
      event.stopPropagation();
      openImage(image, sheet);
    });
  });

  var container = document.getElementById('image-occlusion-container');
  if (container) {
    try {
      // 编辑、卡片生成和遮挡绘制全部由客户端内置的 Anki API 提供。
      anki.imageOcclusion.setup();
    } catch (error) {
      container.hidden = true;
      var message = document.getElementById('occlusion-error');
      message.hidden = false;
      message.textContent = '图片遮挡需要支持原生图片遮挡的 Anki 客户端。请更新客户端后复习；在线预览不模拟此功能。';
      var toggle = document.getElementById('toggle');
      if (toggle) toggle.hidden = true;
    }
  }
})();
