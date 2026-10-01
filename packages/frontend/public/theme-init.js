// Applies the saved light/dark choice before the app renders, so the page never flashes the wrong theme.
(function () {
  var preference = 'system';
  try {
    preference = localStorage.getItem('farmflow-theme') || 'system';
  } catch (e) {
    /* storage blocked: follow the system */
  }
  var dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0d131b' : '#ffffff');
})();
