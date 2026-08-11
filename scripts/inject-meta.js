const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const assetsDir = path.join(__dirname, '../assets');
const distDir = path.join(__dirname, '../dist');

// Copia arquivos estáticos de public/ para dist/
fs.readdirSync(publicDir).forEach(file => {
  fs.copyFileSync(
    path.join(publicDir, file),
    path.join(distDir, file)
  );
  console.log(`📦 Copiado: ${file}`);
});

// Favicon e splash usam a mesma imagem — fonte única em assets/
const faviconSrc = path.join(assetsDir, 'favicon.png');
fs.copyFileSync(faviconSrc, path.join(distDir, 'favicon.png'));
console.log('📦 Copiado: favicon.png (de assets/)');

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
    <meta name="apple-mobile-web-app-title" content="Treino">
    <link rel="icon" type="image/png" href="/favicon.png">
    <link rel="apple-touch-icon" href="/favicon.png">
    <link rel="preload" as="image" href="/favicon.png" fetchpriority="high">${logoPreloadTag}
    <link rel="manifest" href="/manifest.json">`;

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
      }

      #initial-splash img {
        width: 96px;
        height: 96px;
        object-fit: contain;
        display: block;
      }
    </style>
`;

const initialSplash = `
  <div id="initial-splash">
    <img src="/favicon.png" width="96" height="96" alt="">
  </div>
`;

html = html.replace('<title>App Treino</title>', `${metaTags}\n${baseStyles}\n    <title>App Treino</title>`);
html = html.replace('<body>', `<body>${initialSplash}`);

fs.writeFileSync(distHtml, html);
console.log('Meta tags injetadas com sucesso');
