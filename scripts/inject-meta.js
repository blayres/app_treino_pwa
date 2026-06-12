const fs = require('fs');
const path = require('path');

// Copia todos os arquivos da public/ para dist/
const publicDir = path.join(__dirname, '../public');
const distDir = path.join(__dirname, '../dist');

fs.readdirSync(publicDir).forEach(file => {
  fs.copyFileSync(
    path.join(publicDir, file),
    path.join(distDir, file)
  );
  console.log(`📦 Copiado: ${file}`);
});

// Injeta meta tags no index.html
const distHtml = path.join(distDir, 'index.html');
let html = fs.readFileSync(distHtml, 'utf8');
html = html.replace(/<meta name="theme-color" content="[^"]*">\s*/g, '');

// Find the actual hashed favicon asset path from the built HTML
const faviconMatch = html.match(/src="([^"]*favicon[^"]*\.png[^"]*)"/);
const faviconPath = faviconMatch ? faviconMatch[1] : null;

const metaTags = `
    <meta name="theme-color" content="#F8F8F2">
    <meta name="background-color" content="#F8F8F2">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Treino">
    <link rel="apple-touch-icon" href="/icon-192x192.png">
    <link rel="manifest" href="/manifest.json">${faviconPath ? `
    <link rel="preload" as="image" href="${faviconPath}" fetchpriority="high">` : ''}`;

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
