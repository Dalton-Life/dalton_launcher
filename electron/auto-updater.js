const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let enabled = false;
let manualCheck = false;
let startupCheck = false;

function send(type, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('updater:event', { type, ...payload });
}

function getUpdaterToken() {
  return String(
    process.env.GITHUB_UPDATER_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_TOKEN ||
    ''
  ).trim();
}

function formatUpdaterError(error) {
  const message = String(error?.message || error || '');
  const statusCode = Number(error?.statusCode) || null;
  const code = String(error?.code || '');

  if (!getUpdaterToken()) {
    return 'Falta GITHUB_UPDATER_TOKEN en el build. Añádelo a .env.production o al secret ENV_PRODUCTION en CI.';
  }

  if (
    code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' ||
    /latest\.yml|channel file/i.test(message)
  ) {
    return 'El release no incluye latest.yml. Publica con npm run dist -- --publish always (CI o local), no subas solo el .exe a mano.';
  }

  if (
    code === 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' ||
    /Unable to find latest version/i.test(message)
  ) {
    return 'No se encontró ninguna actualización publicada. Comprueba que el release esté publicado en GitHub (no en borrador) y que el token tenga acceso al repositorio.';
  }

  if (statusCode === 404 || /\b404\b/.test(message)) {
    return 'No se pudo acceder al release. Revisa que el token tenga acceso de lectura al repo Dalton-Life/dalton_launcher.';
  }

  if (statusCode === 401 || statusCode === 403 || /\b(401|403)\b/.test(message)) {
    return 'No se pudo acceder al release. Revisa el token de actualizaciones en el build.';
  }

  if (message.length > 160 || message.includes('statusCode') || message.includes('"headers"')) {
    return 'No se pudo comprobar actualizaciones. Inténtalo más tarde.';
  }

  return message || 'No se pudo comprobar actualizaciones.';
}

function configureUpdaterAuth() {
  const token = getUpdaterToken();

  if (!token) {
    console.warn('[updater] GITHUB_UPDATER_TOKEN no configurado; el auto-update no funcionará en repos privados.');
    return false;
  }

  // electron-updater solo usa PrivateGitHubProvider si GH_TOKEN/GITHUB_TOKEN existen
  // al crear el cliente (lee app-update.yml con private: true).
  process.env.GH_TOKEN = token;
  process.env.GITHUB_TOKEN = token;

  autoUpdater.requestHeaders = {
    Authorization: `token ${token}`
  };

  return true;
}

function initAutoUpdater(window) {
  mainWindow = window;
  enabled = app.isPackaged && !process.argv.includes('--enable-logging');

  if (!enabled) {
    return;
  }

  configureUpdaterAuth();
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = {
    info: (...args) => console.log('[updater]', ...args),
    warn: (...args) => console.warn('[updater]', ...args),
    error: (...args) => console.error('[updater]', ...args),
    debug: () => {}
  };

  autoUpdater.on('checking-for-update', () => {
    send('checking', { manual: manualCheck, startup: startupCheck });
  });

  autoUpdater.on('update-available', (info) => {
    send('available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      manual: manualCheck,
      startup: startupCheck
    });
  });

  autoUpdater.on('update-not-available', () => {
    send('not-available', { manual: manualCheck, startup: startupCheck });
    manualCheck = false;
    startupCheck = false;
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
    startupCheck = false;
    send('downloaded', { version: info.version, releaseNotes: info.releaseNotes });
  });

  autoUpdater.on('error', (error) => {
    send('error', {
      message: formatUpdaterError(error),
      manual: manualCheck,
      startup: startupCheck
    });
    manualCheck = false;
    startupCheck = false;
  });
}

async function checkForUpdates({ manual = false, startup = false } = {}) {
  if (!enabled) {
    return { ok: false, skipped: true };
  }

  configureUpdaterAuth();
  manualCheck = Boolean(manual);
  startupCheck = Boolean(startup);

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    send('error', {
      message: formatUpdaterError(error),
      manual: manualCheck,
      startup: startupCheck
    });
    manualCheck = false;
    startupCheck = false;
    return { ok: false, message: formatUpdaterError(error) };
  }
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
  quitAndInstall
};
