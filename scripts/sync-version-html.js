const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
);
const indexPath = path.join(projectRoot, 'src', 'index.html');
const versionLabel = `VERSION v${packageJson.version} — EARLY ACCESS`;

let html = fs.readFileSync(indexPath, 'utf8');

html = html.replace(
  /<span id="install-footer-version">[^<]*<\/span>/,
  `<span id="install-footer-version">${versionLabel}</span>`
);
html = html.replace(
  /<span id="footer-version">[^<]*<\/span>/,
  `<span id="footer-version">${versionLabel}</span>`
);

fs.writeFileSync(indexPath, html, 'utf8');
console.log(`Synced footer version to v${packageJson.version} in src/index.html`);
