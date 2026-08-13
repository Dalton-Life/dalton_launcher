const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let enabled = false;
let manualCheck = false;

function send(type, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('updater:event', { type, ...payload });
}

function initAutoUpdater(window) {
  mainWindow = window;
  enabled = app.isPackaged && !process.argv.includes('--enable-logging');

  if (!enabled) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = {
    info: (...args) => console.log('[updater]', ...args),
    warn: (...args) => console.warn('[updater]', ...args),
    error: (...args) => console.error('[updater]', ...args),
    debug: () => {}
  };

  autoUpdater.on('checking-for-update', () => {
    send('checking', { manual: manualCheck });
  });

  autoUpdater.on('update-available', (info) => {
    send('available', { version: info.version, manual: manualCheck });
  });

  autoUpdater.on('update-not-available', () => {
    send('not-available', { manual: manualCheck });
    manualCheck = false;
  });

  autoUpdater.on('download-progress', (progress) => {
    send('progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    manualCheck = false;
    send('downloaded', { version: info.version });
  });

  autoUpdater.on('error', (error) => {
    send('error', {
      message: error?.message || 'Error de actualización',
      manual: manualCheck
    });
    manualCheck = false;
  });
}

async function checkForUpdates({ manual = false } = {}) {
  if (!enabled) {
    return { ok: false, skipped: true };
  }

  manualCheck = Boolean(manual);

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    send('error', {
      message: error.message || 'No se pudo comprobar actualizaciones.',
      manual: manualCheck
    });
    manualCheck = false;
    return { ok: false, message: error.message };
  }
}

function scheduleUpdateCheck(delayMs = 3000) {
  if (!enabled) {
    return;
  }

  setTimeout(() => {
    checkForUpdates({ manual: false }).catch((error) => {
      console.error('[updater] scheduled check failed:', error?.message || error);
    });
  }, delayMs);
}

function quitAndInstall() {
  if (!enabled) {
    return;
  }

  autoUpdater.quitAndInstall();
}

module.exports = {
  initAutoUpdater,
  checkForUpdates,
  scheduleUpdateCheck,
  quitAndInstall
};
