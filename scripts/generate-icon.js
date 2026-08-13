const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sourcePath = path.join(__dirname, '../src/assets/Frame 1.png');
const iconDir = path.join(__dirname, '../assets');
const icoPath = path.join(iconDir, 'icon.ico');
const pngPath = path.join(iconDir, 'icon.png');
const png256Path = path.join(iconDir, '.icon-source-256.png');

async function generateIcon() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing icon source: ${sourcePath}`);
  }

  const resizeOptions = {
    fit: 'contain',
    background: { r: 28, g: 28, b: 28, alpha: 1 }
  };

  await sharp(sourcePath).resize(256, 256, resizeOptions).png().toFile(png256Path);
  await sharp(sourcePath).resize(512, 512, resizeOptions).png().toFile(pngPath);

  const pngToIco = (await import('png-to-ico')).default;
  const icoBuffer = await pngToIco(png256Path);
  fs.writeFileSync(icoPath, icoBuffer);
  fs.unlinkSync(png256Path);

  console.log(`Generated ${icoPath}`);
}

generateIcon().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
