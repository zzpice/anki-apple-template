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
  var back = !!document.querySelector('[data-review-back], #answer');
  var stateKey = 'anki-template/current-choice';
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

  // 只存当前卡片；正反面共用，开始下一张正面时清除。
  function saveChoice(state) {
    try { sessionStorage.setItem(stateKey, JSON.stringify(state)); return true; }
    catch (error) { return false; }
  }
  function readChoice() {
    try {
      var stored = sessionStorage.getItem(stateKey);
      return JSON.parse(stored);
    } catch (error) { return null; }
  }
  function clearChoice() {
    try { sessionStorage.removeItem(stateKey); } catch (error) {}
  }
  function seededRandom(text) {
    var seed = 2166136261;
    for (var i = 0; i < text.length; i++) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
    seed = seed || 1;
    return function () {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
  }
  function shuffle(order, random) {
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var value = order[i]; order[i] = order[j]; order[j] = value;
    }
  }

  function choices(sheet) {
    var options = sheet.querySelector('[data-options]');
    if (!options) return;
    if (!options.dataset.ready) {
      var parts = options.innerHTML.split('||');
      if (parts.length < 2 || parts.length > 26) return;
      var type = sheet.querySelector('[data-question-type]');
      type = type ? type.textContent.trim() : '';
      var tags = sheet.querySelector('[data-choice-tags]').textContent.trim().split(/\s+/);
      var fixed = type === '判断' || tags.indexOf('固定顺序') !== -1;
      var key = JSON.stringify([sheet.querySelector('.review-question').innerHTML, parts, type, fixed]);
      var state = readChoice();
      var validState = state && state.key === key && Array.isArray(state.order) &&
        state.order.length === parts.length && new Set(state.order).size === parts.length &&
        state.order.every(function (i) { return Number.isInteger(i) && i >= 0 && i < parts.length; }) &&
        Array.isArray(state.selected);
      if (!validState) {
        state = {key:key, order:parts.map(function (_, i) { return i; }), selected:[]};
        // 存储不可用时用题目内容作种子，两面仍有同一顺序和正确映射。
        var random = !back && saveChoice(state) ? Math.random : seededRandom(key);
        if (!fixed) shuffle(state.order, random);
      }
      if (!back) saveChoice(state);
      options.textContent = '';
      state.order.forEach(function (sourceIndex, displayIndex) {
        var sourceKey = String.fromCharCode(65 + sourceIndex);
        var displayKey = String.fromCharCode(65 + displayIndex);
        var row = document.createElement('div');
        row.className = 'review-choice';
        row.dataset.key = sourceKey;
        row.dataset.displayKey = displayKey;
        var input = document.createElement('input');
        input.type = type === '多选' ? 'checkbox' : 'radio';
        input.name = 'review-choice';
        input.id = 'review-choice-' + sourceKey;
        input.value = sourceKey;
        input.checked = state.selected.indexOf(sourceKey) !== -1;
        var label = document.createElement('label');
        label.htmlFor = input.id;
        var letter = document.createElement('span');
        letter.className = 'review-choice-key';
        letter.textContent = displayKey;
        var content = document.createElement('div');
        content.className = 'content';
        content.innerHTML = parts[sourceIndex].trim();
        label.appendChild(letter);
        label.appendChild(content);
        row.appendChild(input);
        row.appendChild(label);
        options.appendChild(row);
      });
      options.dataset.ready = 'true';
      if (!back) options.addEventListener('change', function () {
        state.selected = Array.from(options.querySelectorAll('.review-choice > input:checked'))
          .map(function (input) { return input.value; });
        saveChoice(state);
      });
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
        letter.textContent = row.dataset.displayKey;
        item.appendChild(letter);
        item.appendChild(row.querySelector('.content').cloneNode(true));
        answer.appendChild(item);
      });
    }
    rows.forEach(function (row) {
      var input = row.querySelector('input');
      input.disabled = true;
      var correct = valid && key.indexOf(row.dataset.key) !== -1;
      if (!input.checked && !correct) return;
      var marks = row.querySelector('.review-choice-marks');
      if (!marks) {
        marks = document.createElement('span');
        marks.className = 'review-choice-marks';
        row.appendChild(marks);
      }
      if (input.checked && !marks.querySelector('.review-selected')) {
        var selected = document.createElement('span');
        selected.className = 'review-selected'; selected.textContent = '已选';
        marks.appendChild(selected);
      }
      if (correct && !marks.querySelector('.review-correct')) {
        row.classList.add('is-correct');
        var mark = document.createElement('span');
        mark.className = 'review-correct'; mark.textContent = '✓ 正确';
        marks.appendChild(mark);
      }
    });
  }
  if (!back && !document.body.hasAttribute('data-review-resume')) clearChoice();

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
    // 监听和放大层属于当前卡片；换卡移除 DOM 即清理。
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
      message.textContent = '请使用支持原生图片遮挡的 Anki 客户端打开这张卡片。';
      var toggle = document.getElementById('toggle');
      if (toggle) toggle.hidden = true;
    }
  }
})();
