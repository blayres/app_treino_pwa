const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const assetsDir = path.join(__dirname, '../assets');
const distDir = path.join(__dirname, '../dist');
const appName = 'Focus Improve Train';
const appShortName = 'FIT';
const appIcon = '/favicon.png';

// Copia arquivos estáticos de public/ para dist/
fs.readdirSync(publicDir).forEach(file => {
  fs.copyFileSync(
    path.join(publicDir, file),
    path.join(distDir, file)
  );
  console.log(`📦 ${file}`);
});

// Web icons are small, pre-sized copies of assets/favicon.png (the 1.8k px
// original stays for native app icons): favicon/splash 192, iOS 180, PWA 512.
const iconsDir = path.join(assetsDir, 'icons');
for (const [source, target] of [
  ['icon-192.png', 'favicon.png'],
  ['icon-180.png', 'apple-touch-icon.png'],
  ['icon-512.png', 'icon-512.png'],
]) {
  fs.copyFileSync(path.join(iconsDir, source), path.join(distDir, target));
  console.log(`📦 ${target} (de assets/icons/${source})`);
}

// iOS launch images (scripts/generateSplash.swift). Without them iOS shows a
// black screen before the page paints. iOS picks the one whose media query
// matches the device exactly; the name carries the CSS size and pixel ratio.
const splashDir = path.join(assetsDir, 'splash');
fs.mkdirSync(path.join(distDir, 'splash'), { recursive: true });
const splashTags = fs.readdirSync(splashDir)
  .map(file => {
    const match = file.match(/^splash-(\d+)x(\d+)@(\d)x\.png$/);
    if (!match) return '';
    const [, width, height, ratio] = match;
    fs.copyFileSync(path.join(splashDir, file), path.join(distDir, 'splash', file));
    return `\n    <link rel="apple-touch-startup-image" href="/splash/${file}" media="(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)">`;
  })
  .join('');
console.log(`📦 splash/ (${splashTags.split('\n').length - 1} imagens de abertura iOS)`);

// Injeta meta tags no index.html
const distHtml = path.join(distDir, 'index.html');
let html = fs.readFileSync(distHtml, 'utf8');
html = html.replace(/<meta name="theme-color" content="[^"]*">\s*/g, '');

// Resolve the content-hashed logo filename from the dist/assets folder
const assetsOutputDir = path.join(distDir, 'assets', 'assets');
let logoPreloadTag = '';
try {
  const logoFile = fs.readdirSync(assetsOutputDir).find(f => f.startsWith('logo_completed_light_background'));
  if (logoFile) {
    logoPreloadTag = `\n    <link rel="preload" as="image" href="/assets/assets/${logoFile}" fetchpriority="high">`;
  }
} catch { /* assets dir may not exist in all build configs */ }

const metaTags = `
    <meta name="theme-color" content="#F8F8F2">
    <meta name="background-color" content="#F8F8F2">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="${appShortName}">
    <link rel="icon" type="image/png" href="${appIcon}">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="preload" as="image" href="${appIcon}" fetchpriority="high">${logoPreloadTag}
    <link rel="manifest" href="/manifest.json">${splashTags}
    <script src="/launch-offset.js"></script>`;

const baseStyles = `
    <style>
      html, body, #root {
        margin: 0;
        min-height: 100%;
        background: #F8F8F2;
      }

      #initial-splash {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #F8F8F2;
        z-index: 9999;
        transition: opacity 180ms ease-out;
      }

      /* App ready: fade out instead of disappearing (App.tsx removes it after). */
      #initial-splash.is-done {
        opacity: 0;
        pointer-events: none;
      }

      /* Same place as the iOS launch image, so the logo never jumps. */
      #initial-splash .splash-logo {
        position: relative;
        width: 96px;
        height: 96px;
        transform: translateY(calc(-1 * var(--launch-shift, 0px)));
      }

      #initial-splash img,
      #initial-splash .splash-gap {
        position: absolute;
        inset: 0;
        width: 96px;
        height: 96px;
        object-fit: contain;
        display: block;
      }

      /* Loading motion on the logo's three stripes, cut out of the same
         favicon.png with clip-path (no extra file, identical pixels): the
         stripes glide right and back in a wave, bottom to top. Each one starts
         and ends in place, so it matches the static iOS launch image. Only
         transform/opacity: the browser animates them off the main thread, so
         the motion stays smooth while the app loads and costs nothing to it. */
      #initial-splash .splash-gap { background: #D9D4C5; } /* icon background, under a moving stripe */
      #initial-splash .splash-stripe {
        animation: splash-stripe 1.5s cubic-bezier(0.45, 0, 0.25, 1) infinite;
        will-change: transform, opacity;
      }
      /* Outlines traced from icon-512.png (convex hull of each stripe). The
         background patch is a bit larger than the stripe, so no edge of the
         static stripe shows while the moving one is away. */
      #initial-splash .splash-gap.s1 { clip-path: polygon(23.7% 43.0%, 23.9% 41.1%, 24.2% 39.7%, 25.0% 36.9%, 26.3% 34.3%, 27.5% 32.8%, 29.5% 30.8%, 31.5% 29.4%, 33.7% 28.5%, 54.8% 21.5%, 69.1% 16.8%, 79.8% 13.3%, 82.6% 12.4%, 85.4% 12.8%, 86.2% 15.8%, 85.6% 18.6%, 84.5% 21.3%, 83.5% 23.6%, 82.7% 25.5%, 81.7% 27.5%, 80.8% 28.9%, 78.4% 31.3%, 77.0% 32.3%, 75.6% 33.0%, 62.8% 37.3%, 46.3% 42.6%, 31.7% 47.3%, 26.9% 48.7%, 24.1% 47.6%); }
      #initial-splash .splash-gap.s2 { clip-path: polygon(23.7% 63.5%, 24.2% 60.3%, 24.6% 58.6%, 25.0% 57.3%, 25.9% 55.3%, 27.0% 53.5%, 29.6% 50.9%, 31.2% 49.8%, 32.6% 49.1%, 48.6% 43.7%, 59.9% 40.0%, 63.7% 38.8%, 66.4% 38.6%, 67.9% 42.0%, 67.4% 44.1%, 66.8% 46.0%, 66.0% 48.0%, 65.4% 49.4%, 64.6% 51.2%, 63.1% 54.1%, 62.0% 55.7%, 60.4% 57.3%, 58.8% 58.4%, 57.1% 59.3%, 55.4% 60.0%, 47.1% 62.7%, 39.9% 65.1%, 30.5% 68.0%, 27.8% 68.8%, 24.8% 68.7%, 23.7% 63.9%); }
      #initial-splash .splash-gap.s3 { clip-path: polygon(24.1% 81.6%, 24.4% 79.8%, 25.2% 77.0%, 26.3% 74.8%, 27.5% 73.2%, 29.2% 71.4%, 30.8% 70.3%, 32.2% 69.6%, 37.6% 67.8%, 44.3% 65.6%, 46.9% 65.3%, 48.7% 68.0%, 48.3% 70.3%, 47.6% 72.2%, 46.6% 74.6%, 45.8% 76.4%, 45.0% 78.1%, 44.0% 79.5%, 41.8% 81.8%, 39.7% 83.0%, 26.0% 87.0%); }
      #initial-splash .splash-stripe.s1 { clip-path: polygon(24.9% 43.0%, 25.1% 41.2%, 25.3% 40.0%, 26.1% 37.4%, 27.3% 35.0%, 28.4% 33.5%, 30.2% 31.7%, 32.1% 30.4%, 34.1% 29.6%, 55.2% 22.6%, 69.4% 17.9%, 80.2% 14.4%, 82.8% 13.6%, 84.7% 13.7%, 85.1% 15.8%, 84.4% 18.2%, 83.5% 20.8%, 82.5% 23.2%, 81.7% 25.0%, 80.7% 27.0%, 79.8% 28.2%, 77.6% 30.4%, 76.4% 31.3%, 75.1% 31.9%, 62.4% 36.2%, 46.0% 41.5%, 31.3% 46.2%, 26.9% 47.6%, 25.0% 46.9%); animation-delay: 0.5s; }
      #initial-splash .splash-stripe.s2 { clip-path: polygon(24.9% 63.5%, 25.3% 60.5%, 25.7% 58.9%, 26.1% 57.7%, 26.9% 55.9%, 28.0% 54.2%, 30.4% 51.8%, 31.8% 50.8%, 33.1% 50.1%, 48.9% 44.9%, 60.3% 41.1%, 64.0% 40.0%, 65.8% 39.6%, 66.7% 42.1%, 66.3% 43.8%, 65.7% 45.6%, 64.9% 47.6%, 64.3% 49.0%, 63.5% 50.7%, 62.1% 53.5%, 61.1% 55.0%, 59.7% 56.4%, 58.2% 57.4%, 56.6% 58.3%, 55.0% 58.9%, 46.8% 61.6%, 39.5% 63.9%, 30.2% 66.9%, 27.6% 67.7%, 25.5% 67.7%, 24.9% 63.8%); animation-delay: 0.38s; }
      #initial-splash .splash-stripe.s3 { clip-path: polygon(25.3% 81.6%, 25.5% 80.0%, 26.3% 77.4%, 27.3% 75.4%, 28.4% 73.9%, 30.0% 72.3%, 31.4% 71.3%, 32.7% 70.7%, 38.0% 68.9%, 44.7% 66.7%, 46.4% 66.4%, 47.6% 68.2%, 47.1% 70.0%, 46.5% 71.8%, 45.6% 74.2%, 44.8% 75.9%, 44.0% 77.5%, 43.1% 78.8%, 41.1% 80.8%, 39.2% 81.9%, 26.6% 86.0%); animation-delay: 0.26s; }

      @keyframes splash-stripe {
        0%, 55%, 100% { transform: translateX(0); opacity: 1; }
        22% { transform: translateX(7px); opacity: 0.35; }
      }

      @media (prefers-reduced-motion: reduce) {
        #initial-splash .splash-stripe {
          animation: none;
        }
      }
    </style>
`;

const initialSplash = `
  <div id="initial-splash" role="progressbar" aria-label="Focus Improve Train" aria-busy="true">
    <div class="splash-logo">
      <img src="/favicon.png" width="96" height="96" alt="">
      <div class="splash-gap s1"></div><div class="splash-gap s2"></div><div class="splash-gap s3"></div>
      <img class="splash-stripe s1" src="/favicon.png" width="96" height="96" alt="">
      <img class="splash-stripe s2" src="/favicon.png" width="96" height="96" alt="">
      <img class="splash-stripe s3" src="/favicon.png" width="96" height="96" alt="">
    </div>
  </div>
`;

// Expo's exported title can depend on the active route (for example, "Home").
// Normalize it and replace Expo's default icon tag so Safari receives our PWA
// identity even when the manifest is not consulted during Add to Home Screen.
html = html
  .replace(/<title>[^<]*<\/title>/i, `<title>${appName}</title>`)
  .replace(/\s*<link rel="icon"[^>]*>/gi, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/gi, '')
  .replace(/\s*<link rel="manifest"[^>]*>/gi, '')
  .replace('</head>', `${metaTags}\n${baseStyles}\n  </head>`);
html = html.replace('<body>', `<body>${initialSplash}`);

fs.writeFileSync(distHtml, html);
