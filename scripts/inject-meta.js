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

const metaTags = `
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Treino">
    <link rel="apple-touch-icon" href="/icon-192x192.png">
    <link rel="manifest" href="/manifest.json">`;

html = html.replace('<title>App Treino</title>', `${metaTags}\n    <title>App Treino</title>`);

fs.writeFileSync(distHtml, html);
console.log('Meta tags injetadas com sucesso');
