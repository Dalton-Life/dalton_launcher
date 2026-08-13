const path = require('path');
const { app } = require('electron');

function configureAppPaths() {
  app.setPath('sessionData', path.join(app.getPath('userData'), 'Session'));
}

function configureSingleInstance({ onSecondInstance }) {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
    return false;
  }

  app.on('second-instance', () => {
    onSecondInstance();
  });

  return true;
}

function configureWindowsIdentity() {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.dalton.launcher');
  }
}

function attachRendererRecovery(contents, reload) {
  contents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit') {
      return;
    }

    console.error('[renderer] proceso terminado:', details.reason);
    reload();
  });
}

module.exports = {
  configureAppPaths,
  configureSingleInstance,
  configureWindowsIdentity,
  attachRendererRecovery
};
