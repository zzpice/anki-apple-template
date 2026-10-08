(function () {
      var frame = document.getElementById('preview');
      var sample = document.getElementById('sample');
      var card = document.getElementById('card');
      var flip = document.getElementById('flip');
      var status = document.getElementById('status');
      var examples, css, back = false;

      function applyTheme() {
        window.ankiTheme.applyToFrame(frame);
      }
      function render(resume) {
        var example = examples[Number(sample.value)];
        var content = example.cards[Number(card.value) || 0][back ? 'back' : 'front'];
        // 卡片 HTML 由 Anki 生成，与安装包共用样式和媒体。
        var base = new URL('./cards/media/', location.href).href;
        frame.srcdoc = '<!doctype html><html lang="zh-CN" class="' + (document.documentElement.dataset.theme === 'dark' ? 'nightMode' : '') + '"><head>' +
          '<meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<base href="' + base + '"><style>' + window.ankiTheme.cardCSS(css + (example.css || '')) + '</style></head>' +
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
      window.addEventListener('themechange', applyTheme);
      sample.onchange = chooseSample;
      card.onchange = function () { back = false; render(); };
      flip.onclick = function () { back = !back; render(!back); };
      document.addEventListener('keydown', function (event) {
        if (event.code === 'Space' && event.target === document.body && examples) {
          event.preventDefault(); flip.click();
        }
      });
      function load() {
      document.getElementById('retry').hidden=true;document.getElementById('preview-loading').hidden=false;document.getElementById('load-message').textContent='正在读取卡片…';frame.hidden=true;sample.disabled=flip.disabled=true;sample.textContent='';
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
        var requested=location.hash.slice(1);
        var index=examples.findIndex(function(example){return example.type===requested;});
        sample.value=index>=0?index:examples.findIndex(function (example) { return example.key === 'single'; });
        sample.disabled = flip.disabled = false;
        frame.hidden=false;document.getElementById('preview-loading').hidden=true;
        chooseSample();
      }).catch(function (error) {
        status.textContent = '';document.getElementById('load-message').textContent='暂时无法加载卡片预览，请检查网络后重试。';document.getElementById('retry').hidden=false;
      });
      }
      document.getElementById('retry').onclick=load;
      load();
    })();
