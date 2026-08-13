const path = require('path');
const { fileURLToPath } = require('url');

function lockRendererNavigation(contents, srcRoot) {
  const normalizedRoot = path.normalize(srcRoot);

  contents.on('will-navigate', (event, url) => {
    let targetPath;

    try {
      const parsed = new URL(url);

      if (parsed.protocol !== 'file:') {
        event.preventDefault();
        return;
      }

      targetPath = path.normalize(fileURLToPath(parsed));
    } catch {
      event.preventDefault();
      return;
    }

    if (!targetPath.startsWith(normalizedRoot)) {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

module.exports = {
  lockRendererNavigation
};
