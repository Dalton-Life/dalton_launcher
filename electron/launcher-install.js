const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const LAUNCHER_FOLDER_NAME = 'Dalton Launcher';
const SHORTCUT_NAME = 'Dalton Launcher.lnk';

function getDefaultLauncherInstallPath(app) {
  return path.join(app.getPath('documents'), LAUNCHER_FOLDER_NAME);
}

function resolveInstallRoot(targetPath) {
  const base = path.resolve(targetPath || '');
  const folderName = path.basename(base);

  if (folderName.toLowerCase() === LAUNCHER_FOLDER_NAME.toLowerCase()) {
    return base;
  }

  return path.join(base, LAUNCHER_FOLDER_NAME);
}

function getLauncherManifestPath(installRoot) {
  return path.join(installRoot, 'install.json');
}

function isLauncherInstalled(config, installRoot) {
  if (!config?.launcherInstalled || !installRoot) return false;
  return fs.existsSync(getLauncherManifestPath(installRoot));
}

function getDesktopShortcutPath(app) {
  return path.join(app.getPath('desktop'), SHORTCUT_NAME);
}

function escapePsSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
}

function createDesktopShortcut(app, _installRoot, iconPath, projectRoot) {
  if (process.platform !== 'win32') {
    return { ok: false, message: 'Acceso directo solo disponible en Windows.' };
  }

  const shortcutPath = getDesktopShortcutPath(app);
  const targetPath = process.execPath;
  const workingDirectory = app.isPackaged ? path.dirname(process.execPath) : projectRoot;
  const argumentsValue = app.isPackaged ? '' : path.join(projectRoot, 'electron', 'main.js');

  const script = `
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut('${escapePsSingleQuoted(shortcutPath)}')
$shortcut.TargetPath = '${escapePsSingleQuoted(targetPath)}'
$shortcut.Arguments = '${escapePsSingleQuoted(argumentsValue)}'
$shortcut.WorkingDirectory = '${escapePsSingleQuoted(workingDirectory)}'
$shortcut.IconLocation = '${escapePsSingleQuoted(iconPath)}'
$shortcut.Description = 'Dalton Launcher'
$shortcut.Save()
`;

  execFileSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { stdio: 'pipe' }
  );

  return { ok: true, shortcutPath };
}

function removeDesktopShortcut(app) {
  const shortcutPath = getDesktopShortcutPath(app);

  if (fs.existsSync(shortcutPath)) {
    fs.unlinkSync(shortcutPath);
  }
}

function installLauncher(app, config, targetPath, options = {}) {
  const installRoot = resolveInstallRoot(targetPath);
  fs.mkdirSync(installRoot, { recursive: true });

  for (const folder of ['data', 'cache', 'logs', 'server']) {
    fs.mkdirSync(path.join(installRoot, folder), { recursive: true });
  }

  const manifest = {
    version: app.getVersion(),
    installedAt: new Date().toISOString(),
    installPath: installRoot,
    desktopShortcut: Boolean(options.createDesktopShortcut)
  };

  fs.writeFileSync(getLauncherManifestPath(installRoot), JSON.stringify(manifest, null, 2), 'utf8');

  if (config?.serverIp?.trim()) {
    try {
      const { writeConnectShortcut } = require('./fivem-launch');
      writeConnectShortcut(installRoot, config.serverIp, config.serverPort);
    } catch {
      // ignore shortcut sync errors
    }
  }

  let shortcutResult = null;

  if (options.createDesktopShortcut) {
    shortcutResult = createDesktopShortcut(
      app,
      installRoot,
      options.iconPath,
      options.projectRoot
    );
  }

  return {
    launcherInstalled: true,
    launcherInstallPath: installRoot,
    serverInstallPath: path.join(installRoot, 'server'),
    desktopShortcut: Boolean(options.createDesktopShortcut),
    shortcutResult
  };
}

function uninstallLauncher(config, app) {
  const installRoot = config?.launcherInstallPath;

  if (installRoot && fs.existsSync(installRoot)) {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }

  removeDesktopShortcut(app);

  const defaultPath = getDefaultLauncherInstallPath(app);

  return {
    launcherInstallPath: defaultPath,
    installPath: path.join(defaultPath, 'server')
  };
}

module.exports = {
  LAUNCHER_FOLDER_NAME,
  getDefaultLauncherInstallPath,
  resolveInstallRoot,
  isLauncherInstalled,
  installLauncher,
  uninstallLauncher,
  createDesktopShortcut,
  removeDesktopShortcut
};
