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
const { isFiveMInstalled, launchDaltonLife, getFiveMPlayState, SERVER_NOT_CONFIGURED_MESSAGE } = require('./fivem-launch');
const { getServerStatus } = require('./fivem-server-api');
const { getNews } = require('./news');
const { clearFiveMCache } = require('./fivem-cache');
const {
  destroyDiscordPresence,
  syncDiscordPresence
} = require('./discord-presence');
const { loadEnv, getServerEnv } = require('./env');
const { parseAllowedExternalUrl } = require('./safe-url');
const {
  initAutoUpdater,
  checkForUpdates,
  quitAndInstall
} = require('./auto-updater');
const { lockRendererNavigation } = require('./secure-window');
const { createIpcTrust } = require('./ipc-trust');
const { clampVolumePercent } = require('./volume');
const {
  configureAppPaths,
  configureSingleInstance,
  configureWindowsIdentity,
  attachRendererRecovery
} = require('./app-lifecycle');

const projectRoot = path.join(__dirname, '..');
const rendererRoot = path.join(projectRoot, 'src');
const indexHtmlPath = path.join(rendererRoot, 'index.html');

loadEnv(projectRoot);
configureWindowsIdentity();
configureAppPaths();

const isDev = process.argv.includes('--enable-logging');
let mainWindow = null;

const { trustedHandle, trustedOn } = createIpcTrust(() => mainWindow);

if (
  !configureSingleInstance({
    onSecondInstance() {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }

      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      mainWindow.show();
      mainWindow.focus();
    }
  })
) {
  process.exit(0);
}

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
    muteBackgroundMusic: false,
    muteButtonSounds: false,
    backgroundMusicVolume: 22,
    readNotificationIds: []
  };
}

function getFiveMOptions(config = readNormalizedConfig()) {
  const fivemAppPath = String(config.fivemAppPath || '').trim();

  return fivemAppPath ? { fivemAppPath } : {};
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
  const fivemAppPath = String(config.fivemAppPath || '').trim();

  return {
    ...config,
    launcherInstallPath,
    fivemAppPath: fivemAppPath || undefined,
    serverIp,
    serverPort,
    muteBackgroundMusic: Boolean(config.muteBackgroundMusic),
    muteButtonSounds: Boolean(config.muteButtonSounds),
    backgroundMusicVolume: clampVolumePercent(config.backgroundMusicVolume, 22),
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
  delete persisted.installPath;

  fs.mkdirSync(userDataPath(), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(persisted, null, 2), 'utf8');
}

function readNormalizedConfig() {
  return normalizeConfig(readConfig());
}

let configWriteQueue = Promise.resolve();

function enqueueConfigWrite(work) {
  const result = configWriteQueue.then(work, work);
  configWriteQueue = result.catch(() => {});
  return result;
}

function writeNormalizedConfig(partial) {
  return enqueueConfigWrite(() => {
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
  });
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
      sandbox: true
    }
  });

  lockRendererNavigation(mainWindow.webContents, rendererRoot);
  attachRendererRecovery(mainWindow.webContents, () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.loadFile(indexHtmlPath);
  });
  mainWindow.loadFile(indexHtmlPath);

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
  createWindow();
  initAutoUpdater(mainWindow);

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

trustedHandle(ipcMain, 'app:get-version', () => app.getVersion());

trustedHandle(ipcMain, 'app:relaunch', () => {
  app.relaunch();
  app.exit(0);
  return { ok: true };
});

trustedHandle(ipcMain, 'updater:check', (_event, options) => checkForUpdates(options || {}));

trustedHandle(ipcMain, 'updater:install', () => {
  quitAndInstall();
  return { ok: true };
});

trustedHandle(ipcMain, 'config:get', () => ({
  ...readNormalizedConfig(),
  packaged: app.isPackaged
}));

trustedHandle(ipcMain, 'config:set', async (_event, partial) => writeNormalizedConfig(partial));

trustedHandle(ipcMain, 'dialog:select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

trustedHandle(ipcMain, 'launcher:resolve-install-path', (_event, targetPath) => {
  const resolved = resolveInstallRoot(targetPath || getDefaultLauncherInstallPath(app), app);
  const validation = validateInstallRoot(resolved, app);

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  return { ok: true, path: validation.installRoot };
});

trustedHandle(ipcMain, 'launcher:install', async (_event, options) => {
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

    const next = await writeNormalizedConfig({
      launcherInstalled: installResult.launcherInstalled,
      launcherInstallPath: installResult.launcherInstallPath
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
      message: error.message || 'Error al configurar el launcher.'
    };
  }
});

trustedHandle(ipcMain, 'launcher:start-dalton-life', async () => {
  const config = readNormalizedConfig();

  if (!config.launcherInstalled) {
    return { ok: false, message: 'Completa la configuración inicial primero.' };
  }

  if (!config.serverIp?.trim()) {
    return {
      ok: false,
      message: SERVER_NOT_CONFIGURED_MESSAGE
    };
  }

  try {
    return await launchDaltonLife(config.serverIp, config.serverPort, {
      installRoot: config.launcherInstallPath,
      ...getFiveMOptions(config)
    });
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'No se pudo abrir FiveM.'
    };
  }
});

trustedHandle(ipcMain, 'fivem:is-installed', () => isFiveMInstalled(getFiveMOptions()));

trustedHandle(ipcMain, 'fivem:get-play-state', () => getFiveMPlayState());

trustedHandle(ipcMain, 'fivem:confirm-clear-cache', async () => {
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

trustedHandle(ipcMain, 'fivem:clear-cache', async () => clearFiveMCache(getFiveMOptions()));

trustedHandle(ipcMain, 'fivem:show-cache-result', async (_event, result) => {
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

trustedHandle(ipcMain, 'fivem:get-server-status', async () => {
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

trustedHandle(ipcMain, 'news:get', () => getNews(projectRoot));

trustedHandle(ipcMain, 'discord:sync', async (_event, state = 'idle') => {
  const ok = await syncDiscordPresence(state);
  return { ok };
});

trustedHandle(ipcMain, 'shell:open-external', async (_event, url) => {
  const safeUrl = parseAllowedExternalUrl(url);

  if (!safeUrl) {
    return { ok: false, message: 'URL no permitida.' };
  }

  await shell.openExternal(safeUrl);
  return { ok: true };
});

trustedOn(ipcMain, 'window:minimize', () => {
  mainWindow?.minimize();
});

trustedOn(ipcMain, 'window:close', () => {
  mainWindow?.close();
});
