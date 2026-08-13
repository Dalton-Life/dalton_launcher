const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const productionEnvPath = path.join(projectRoot, '.env.production');

if (!fs.existsSync(productionEnvPath)) {
  console.error('Missing .env.production');
  console.error('Copy .env.production.example to .env.production and set production values before running npm run dist.');
  process.exit(1);
}

const contents = fs.readFileSync(productionEnvPath, 'utf8');

if (!/^SERVER_IP=.+/m.test(contents)) {
  console.error('.env.production must define SERVER_IP.');
  process.exit(1);
}

if (/^SERVER_IP=127\.0\.0\.1\s*$/m.test(contents)) {
  console.warn('Warning: SERVER_IP is still 127.0.0.1. Use your public server IP for client builds.');
}

console.log('Using .env.production for the installer build.');
