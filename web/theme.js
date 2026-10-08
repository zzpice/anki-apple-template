// One website preference for the home, authoring workspace and sample preview.
// Card styles remain owned by the Anki templates.
(() => {
  const key = 'anki-template-theme';
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const normalize = value => ['light', 'dark'].includes(value) ? value : 'system';
  let mode = 'system';
  try { mode = normalize(localStorage.getItem(key)); } catch {}

  function apply() {
    const theme = mode === 'system' ? (system.matches ? 'dark' : 'light') : mode;
    root.dataset.themeMode = mode;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#16171b' : '#f6f6f8';
    root.style.backgroundColor = document.querySelector('meta[name="theme-color"]').content;
    document.querySelector('meta[name="color-scheme"]').content = theme;
    document.querySelectorAll('[data-site-theme]').forEach(select => { select.value = mode; });
    window.dispatchEvent(new CustomEvent('themechange', {detail: {mode, theme}}));
  }

  // Seed srcdoc with the resolved appearance so an iframe cannot flash the
  // system theme while its parent is using a manual override.
  function cardCSS(css) {
    return css.replace(/@media\s*\(prefers-color-scheme:\s*dark\)/g, '@media not all');
  }
  function applyToFrame(frame) {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.documentElement.classList.toggle('nightMode', root.dataset.theme === 'dark');
    doc.documentElement.style.colorScheme = root.dataset.theme;
  }
  window.ankiTheme = {cardCSS, applyToFrame};
  apply();
  system.addEventListener('change', () => { if (mode === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { mode = normalize(event.newValue); apply(); }
  });
  window.addEventListener('pageshow', () => {
    try { mode = normalize(localStorage.getItem(key)); } catch {}
    apply();
  });
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelectorAll('[data-site-theme]').forEach(select => {
      select.hidden = false;
      select.addEventListener('change', () => {
        mode = normalize(select.value);
        try {
          if (mode === 'system') localStorage.removeItem(key);
          else localStorage.setItem(key, mode);
        } catch {}
        apply();
      });
    });
  });
})();
