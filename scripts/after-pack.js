const path = require('path');
const { rcedit } = require('rcedit');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const productFilename = context.packager.appInfo.productFilename;
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, 'assets', 'icon.ico');

  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      ProductName: context.packager.appInfo.productName,
      FileDescription: context.packager.appInfo.productName,
      CompanyName: 'Dalton Life',
      LegalCopyright: context.packager.appInfo.copyright || 'Copyright © Dalton Life'
    },
    'file-version': context.packager.appInfo.version,
    'product-version': context.packager.appInfo.version
  });

  console.log(`Embedded Dalton icon into ${productFilename}.exe`);
};
