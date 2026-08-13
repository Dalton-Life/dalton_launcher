const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  getDefaultLauncherInstallPath,
  resolveInstallRoot,
  validateInstallRoot,
  isLauncherInstalled,
  installLauncher
} = require('./launcher-install');
const { DEFAULT_PORT, isFiveMInstalled, launchDaltonLife, getFiveMPlayState, SERVER_NOT_CONFIGURED_MESSAGE } = require('./fivem-launch');
const { getServerStatus } = require('./fivem-server-api');
const { getNews } = require('./news');
const { clearFiveMCache } = require('./fivem-cache');
const {
  setDiscordPresence,
  destroyDiscordPresence,
  syncDiscordPresence,
  isDiscordPresenceEnabled
} = require('./discord-presence');
const { loadEnv, getServerEnv } = require('./env');
const { parseAllowedExternalUrl } = require('./safe-url');
const { getAppVersion } = require('./version');
const {
  initAutoUpdater,
  checkForUpdates,
  quitAndInstall
} = require('./auto-updater');

const projectRoot = path.join(__dirname, '..');

loadEnv(projectRoot);

const isDev = process.argv.includes('--enable-logging');
let mainWindow = null;

const iconPath = path.join(__dirname, '../assets/icon.ico');

const userDataPath = () => app.getPath('userData');
const configPath = () => path.join(userDataPath(), 'config.json');

function readConfig() {
  try {
    if (fs.existsSync(configPath())) {
      return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    }
  } catch {
    // ignore corrupt config
  }

  return {
    launcherInstalled: false,
    launcherInstallPath: getDefaultLauncherInstallPath(app),
    installPath: path.join(getDefaultLauncherInstallPath(app), 'server'),
    muteBackgroundMusic: false,
    muteButtonSounds: false,
    backgroundMusicVolume: 22,
    readNotificationIds: []
  };
}

function normalizeMusicVolume(value, fallback = 22) {
  if (value === '' || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function normalizeConfig(config) {
  let launcherInstallPath = resolveInstallRoot(
    config.launcherInstallPath || getDefaultLauncherInstallPath(app),
    app
  );
  const pathValidation = validateInstallRoot(launcherInstallPath, app);

  if (!pathValidation.ok) {
    launcherInstallPath = getDefaultLauncherInstallPath(app);
  } else {
    launcherInstallPath = pathValidation.installRoot;
  }

  const { serverIp, serverPort } = getServerEnv();

  return {
    ...config,
    launcherInstallPath,
    installPath: config.installPath || path.join(launcherInstallPath, 'server'),
    serverIp,
    serverPort,
    muteBackgroundMusic: Boolean(config.muteBackgroundMusic),
    muteButtonSounds: Boolean(config.muteButtonSounds),
    backgroundMusicVolume: normalizeMusicVolume(config.backgroundMusicVolume, 22),
    readNotificationIds: Array.isArray(config.readNotificationIds)
      ? config.readNotificationIds.map(String)
      : [],
    launcherInstalled: isLauncherInstalled(config, launcherInstallPath)
  };
}

function writeConfig(config) {
  const persisted = { ...config };
  delete persisted.serverIp;
  delete persisted.serverPort;
  delete persisted.serverConnect;
  delete persisted.repositories;
  delete persisted.serverInstalled;

  fs.mkdirSync(userDataPath(), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(persisted, null, 2), 'utf8');
}

function readNormalizedConfig() {
  return normalizeConfig(readConfig());
}

function writeNormalizedConfig(partial) {
  const next = normalizeConfig({ ...readConfig(), ...partial });
  writeConfig(next);

  if (next.launcherInstalled && next.serverIp?.trim() && next.launcherInstallPath) {
    try {
      const { writeConnectShortcut } = require('./fivem-launch');
      writeConnectShortcut(next.launcherInstallPath, next.serverIp, next.serverPort);
    } catch {
      // ignore shortcut sync errors
    }
  }

  return next;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    frame: false,
    backgroundColor: '#1c1c1c',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.dalton.launcher');
  }

  const startupConfig = readNormalizedConfig();

  createWindow();
  initAutoUpdater(mainWindow);

  if (startupConfig.launcherInstalled && startupConfig.serverIp?.trim() && startupConfig.launcherInstallPath) {
    try {
      const { writeConnectShortcut } = require('./fivem-launch');
      writeConnectShortcut(startupConfig.launcherInstallPath, startupConfig.serverIp, startupConfig.serverPort);
    } catch {
      // ignore shortcut sync errors
    }
  }

  await syncDiscordPresence('launcher');
});

app.on('before-quit', () => {
  destroyDiscordPresence();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('app:get-version', () => getAppVersion(app));

ipcMain.handle('app:relaunch', () => {
  app.relaunch();
  app.exit(0);
  return { ok: true };
});

ipcMain.handle('updater:check', (_event, options) => checkForUpdates(options || {}));

ipcMain.handle('updater:install', () => {
  quitAndInstall();
  return { ok: true };
});

ipcMain.handle('config:get', () => ({
  ...readNormalizedConfig(),
  packaged: app.isPackaged
}));

ipcMain.handle('config:set', (_event, partial) => writeNormalizedConfig(partial));

ipcMain.handle('dialog:select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('launcher:resolve-install-path', (_event, targetPath) => {
  const resolved = resolveInstallRoot(targetPath || getDefaultLauncherInstallPath(app), app);
  const validation = validateInstallRoot(resolved, app);

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  return { ok: true, path: validation.installRoot };
});

ipcMain.handle('launcher:install', async (_event, options) => {
  try {
    const targetPath = options?.installPath || readNormalizedConfig().launcherInstallPath;
    const createDesktopShortcut = Boolean(options?.createDesktopShortcut);
    const installResult = installLauncher(app, readConfig(), targetPath, {
      createDesktopShortcut,
      iconPath,
      projectRoot
    });

    const shortcutCreated = Boolean(installResult.shortcutResult?.ok);

    if (createDesktopShortcut && !shortcutCreated) {
      return {
        ok: false,
        message:
          installResult.shortcutResult?.message ||
          'No se pudo crear el acceso directo en el escritorio.',
        installPath: installResult.launcherInstallPath,
        shortcutCreated: false
      };
    }

    const next = writeNormalizedConfig({
      ...installResult,
      installPath: installResult.serverInstallPath,
      desktopShortcut: createDesktopShortcut && shortcutCreated
    });

    return {
      ok: true,
      message:
        createDesktopShortcut && shortcutCreated
          ? 'Launcher instalado y acceso directo creado.'
          : 'Launcher instalado correctamente.',
      installPath: next.launcherInstallPath,
      shortcutCreated
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'Error al instalar el launcher.'
    };
  }
});

ipcMain.handle('launcher:start-dalton-life', async () => {
  const config = readNormalizedConfig();

  if (!config.launcherInstalled) {
    return { ok: false, message: 'Instala el launcher primero.' };
  }

  if (!config.serverIp?.trim()) {
    return {
      ok: false,
      message: SERVER_NOT_CONFIGURED_MESSAGE
    };
  }

  try {
    return await launchDaltonLife(config.serverIp, config.serverPort, {
      installRoot: config.launcherInstallPath
    });
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'No se pudo abrir FiveM.'
    };
  }
});

ipcMain.handle('fivem:is-installed', () => isFiveMInstalled());

ipcMain.handle('fivem:get-play-state', () => getFiveMPlayState());

ipcMain.handle('fivem:confirm-clear-cache', async () => {
  const confirm = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancelar', 'Borrar caché'],
    defaultId: 0,
    cancelId: 0,
    title: 'Borrar caché de FiveM',
    message: '¿Borrar la caché de FiveM?',
    detail:
      'Se eliminarán las carpetas server-cache, server-cache-priv y cache dentro de FiveM.app\\data. ' +
      'No se tocarán game-storage ni nui-storage. Cierra FiveM antes de continuar.'
  });

  return confirm.response === 1;
});

ipcMain.handle('fivem:clear-cache', async () => clearFiveMCache());

ipcMain.handle('fivem:show-cache-result', async (_event, result) => {
  if (!result?.message) {
    return;
  }

  await dialog.showMessageBox(mainWindow, {
    type: result.ok ? 'info' : 'error',
    buttons: ['Aceptar'],
    title: result.ok ? 'Caché borrada' : 'Error al borrar caché',
    message: result.message
  });
});

ipcMain.handle('fivem:get-server-status', async () => {
  try {
    const { serverIp, serverPort } = readNormalizedConfig();
    return await getServerStatus(serverIp, serverPort);
  } catch (error) {
    return {
      online: false,
      error: error.message || 'Error consultando servidor'
    };
  }
});

ipcMain.handle('news:get', () => getNews(projectRoot));

ipcMain.handle('discord:set-presence', (_event, state) => {
  if (!isDiscordPresenceEnabled()) {
    return { ok: false };
  }

  return { ok: setDiscordPresence(state) };
});

ipcMain.handle('discord:sync', async (_event, state = 'idle') => {
  const ok = await syncDiscordPresence(state);
  return { ok };
});

ipcMain.handle('shell:open-external', async (_event, url) => {
  const safeUrl = parseAllowedExternalUrl(url);

  if (!safeUrl) {
    return { ok: false, message: 'URL no permitida.' };
  }

  await shell.openExternal(safeUrl);
  return { ok: true };
});

ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});
