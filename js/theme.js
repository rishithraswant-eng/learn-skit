// Theme Manager for learn-skit
(function(){
  const STORAGE_KEY = 'learn-skit-theme';

  function getSavedTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch(e) {}
    return 'light';
  }

  function disableTransitions() {
    const root = document.documentElement;
    root.classList.add('no-transitions');
    void root.offsetHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('no-transitions');
      });
    });
  }

  function apply(theme, animated) {
    if (animated) disableTransitions();
    const isDark = theme === 'dark';
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
    root.style.colorScheme = isDark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#1C1D20' : '#F6F5FD');

    updateSwitch(isDark);

    try {
      if (window.LearnSkit && window.LearnSkit.state && window.LearnSkit.state.preferences) {
        window.LearnSkit.state.preferences.theme = theme;
      }
    } catch(e){}
  }

  function setTheme(newTheme) {
    newTheme = newTheme === 'dark' ? 'dark' : 'light';
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch(e){}
    apply(newTheme, true);
  }

  function toggle() {
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    setTheme(isCurrentlyDark ? 'light' : 'dark');
  }

  function updateSwitch(isDark) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', isDark ? 'true' : 'false');
    btn.setAttribute('aria-label', 'Dark mode');
    btn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  function initUI() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    const isDark = document.documentElement.classList.contains('dark');
    updateSwitch(isDark);

    btn.onclick = (e) => {
      e.preventDefault();
      toggle();
    };
  }

  window.Theme = {
    get: () => document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    set: setTheme,
    toggle: toggle,
    apply: () => apply(getSavedTheme(), false),
    initUI: initUI
  };

  apply(getSavedTheme(), false);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
