// iOS home-screen app: the page starts below the status bar, but the launch image
// (assets/splash) is centred on the whole screen. Expose half the status bar height
// so #initial-splash (inject-meta.js) keeps the logo exactly where the launch image had it.
if (navigator.standalone) {
  document.documentElement.style.setProperty(
    '--launch-shift',
    Math.max(0, (screen.height - window.innerHeight) / 2) + 'px',
  );
}
