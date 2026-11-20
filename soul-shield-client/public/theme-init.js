// Applies the saved light/dark theme before the first paint, so a dark-mode
// user never sees a white flash while React boots. Mirrors ThemeContext.jsx
// (kept as a same-origin file because the CSP forbids inline scripts).
(function () {
  var pref = 'system';
  try { pref = localStorage.getItem('soulshield_theme') || 'system'; } catch { /* storage blocked */ }
  var dark;
  if (pref === 'lemon-dark' || /-dark$/.test(pref)) dark = true;
  else if (pref === 'lemon-light' || /-light$/.test(pref)) dark = false;
  else dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var root = document.documentElement;
  root.setAttribute('data-theme', dark ? 'lemon-dark' : 'lemon-light');
  root.setAttribute('data-scheme', dark ? 'dark' : 'light');
})();
