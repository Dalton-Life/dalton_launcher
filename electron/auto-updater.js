const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let enabled = false;

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
  autoUpdater.logger = null;

  autoUpdater.on('checking-for-update', () => {
    send('checking');
  });

  autoUpdater.on('update-available', (info) => {
    send('available', { version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    send('not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    send('progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send('downloaded', { version: info.version });
  });

  autoUpdater.on('error', (error) => {
    send('error', { message: error?.message || 'Error de actualización' });
  });
}

async function checkForUpdates() {
  if (!enabled) {
    return { ok: false, skipped: true };
  }

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    send('error', { message: error.message || 'No se pudo comprobar actualizaciones.' });
    return { ok: false, message: error.message };
  }
}

function scheduleUpdateCheck(delayMs = 3000) {
  if (!enabled) {
    return;
  }

  setTimeout(() => {
    checkForUpdates().catch(() => {});
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
