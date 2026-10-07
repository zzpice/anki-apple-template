(function () {
      var frame = document.getElementById('preview');
      var sample = document.getElementById('sample');
      var card = document.getElementById('card');
      var theme = document.getElementById('theme');
      var flip = document.getElementById('flip');
      var status = document.getElementById('status');
      var examples, css, back = false;

      function applyTheme() {
        document.body.dataset.theme = theme.value;
        var doc = frame.contentDocument;
        if (!doc || !doc.styleSheets.length) return;
        doc.documentElement.className = theme.value === 'dark' ? 'nightMode' : '';
        Array.from(doc.styleSheets[0].cssRules).forEach(function (rule) {
          if (rule.conditionText && rule.conditionText.indexOf('prefers-color-scheme') !== -1) {
            rule.reviewThemeMedia = true;
          }
          if (rule.reviewThemeMedia) {
            rule.media.mediaText = theme.value === 'system' ? '(prefers-color-scheme:dark)' : 'not all';
          }
        });
      }
      function render(resume) {
        var example = examples[Number(sample.value)];
        var content = example.cards[Number(card.value) || 0][back ? 'back' : 'front'];
        // 卡片 HTML 由 Anki 生成，与安装包共用样式和媒体。
        var base = new URL('./cards/media/', location.href).href;
        frame.srcdoc = '<!doctype html><html lang="zh-CN"><head>' +
          '<meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<base href="' + base + '"><style>' + css + (example.css || '') + '</style></head>' +
          '<body class="card"' + (resume ? ' data-review-resume' : '') + '>' + content + '</body></html>';
        flip.textContent = back ? '返回正面' : '显示答案';
        status.textContent = example.type === 'occlusion' ?
          '图片遮挡请在 Anki 中导入体验。' :
          example.type === 'choice' ? '翻面后可核对已选项和正确答案。' :
          '按空格或点击按钮翻面。';
      }
      function chooseSample() {
        var example = examples[Number(sample.value)];
        card.textContent = '';
        example.cards.forEach(function (_, index) {
          var option = document.createElement('option');
          option.value = index;
          option.textContent = '第 ' + (index + 1) + ' 张';
          card.appendChild(option);
        });
        document.getElementById('card-label').hidden = example.cards.length < 2;
        back = false;
        render();
      }
      frame.onload = applyTheme;
      document.getElementById('viewport').onchange = function () { document.body.dataset.viewport = this.value; };
      theme.onchange = applyTheme;
      sample.onchange = chooseSample;
      card.onchange = function () { back = false; render(); };
      flip.onclick = function () { back = !back; render(!back); };
      document.addEventListener('keydown', function (event) {
        if (event.code === 'Space' && event.target === document.body && examples) {
          event.preventDefault(); flip.click();
        }
      });
      Promise.all(['web/preview-cards.json', 'cards/style.css'].map(function (name) {
        return fetch(name).then(function (response) {
          if (!response.ok) throw new Error(name + ': ' + response.status);
          return response.text();
        });
      })).then(function (files) {
        examples = JSON.parse(files[0]); css = files[1];
        examples.forEach(function (example, index) {
          var option = document.createElement('option');
          option.value = index; option.textContent = example.label; sample.appendChild(option);
        });
        sample.value = examples.findIndex(function (example) { return example.key === 'single'; });
        sample.disabled = flip.disabled = false;
        chooseSample();
      }).catch(function (error) {
        status.textContent = '无法加载预览：' + error.message + '。本地预览方法见使用说明。';
      });
    })();
