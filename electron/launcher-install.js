const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const LAUNCHER_FOLDER_NAME = 'Dalton Launcher';
const SHORTCUT_NAME = 'Dalton Launcher.lnk';

function getDefaultLauncherInstallPath(app) {
  return path.join(app.getPath('documents'), LAUNCHER_FOLDER_NAME);
}

function getLauncherManifestPath(installRoot) {
  return path.join(installRoot, 'install.json');
}

function getCriticalPaths(app) {
  const paths = [
    app.getPath('home'),
    app.getPath('appData'),
    app.getPath('userData'),
    app.getPath('temp'),
    process.env.SystemRoot,
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    path.dirname(app.getPath('exe'))
  ].filter(Boolean);

  return [...new Set(paths.map((entry) => path.resolve(entry)))];
}

function validateInstallRoot(installRoot, app) {
  if (!installRoot || !app) {
    return { ok: false, message: 'Ruta de instalación inválida.' };
  }

  const resolved = path.resolve(installRoot);
  const folderName = path.basename(resolved);

  if (folderName.toLowerCase() !== LAUNCHER_FOLDER_NAME.toLowerCase()) {
    return { ok: false, message: 'La carpeta de instalación debe llamarse "Dalton Launcher".' };
  }

  const normalized = resolved.toLowerCase();

  for (const criticalPath of getCriticalPaths(app)) {
    if (normalized === criticalPath.toLowerCase()) {
      return { ok: false, message: 'No se puede usar esa ubicación para instalar el launcher.' };
    }
  }

  return { ok: true, installRoot: resolved };
}

function resolveInstallRoot(targetPath, app) {
  const trimmed = String(targetPath || '').trim();
  const base = trimmed ? path.resolve(trimmed) : getDefaultLauncherInstallPath(app);
  const folderName = path.basename(base);

  if (folderName.toLowerCase() === LAUNCHER_FOLDER_NAME.toLowerCase()) {
    return base;
  }

  return path.join(base, LAUNCHER_FOLDER_NAME);
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

  try {
    execFileSync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { stdio: 'pipe' }
    );

    return { ok: true, shortcutPath };
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'No se pudo crear el acceso directo en el escritorio.'
    };
  }
}

function installLauncher(app, _config, targetPath, options = {}) {
  const installRoot = resolveInstallRoot(targetPath, app);
  const validation = validateInstallRoot(installRoot, app);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  fs.mkdirSync(validation.installRoot, { recursive: true });

  for (const folder of ['data', 'cache', 'logs', 'server']) {
    fs.mkdirSync(path.join(validation.installRoot, folder), { recursive: true });
  }

  const manifest = {
    version: app.getVersion(),
    installedAt: new Date().toISOString(),
    installPath: validation.installRoot,
    desktopShortcut: Boolean(options.createDesktopShortcut)
  };

  fs.writeFileSync(
    getLauncherManifestPath(validation.installRoot),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  let shortcutResult = null;

  if (options.createDesktopShortcut) {
    shortcutResult = createDesktopShortcut(
      app,
      validation.installRoot,
      options.iconPath,
      options.projectRoot
    );
  }

  return {
    launcherInstalled: true,
    launcherInstallPath: validation.installRoot,
    serverInstallPath: path.join(validation.installRoot, 'server'),
    desktopShortcut: Boolean(options.createDesktopShortcut),
    shortcutResult
  };
}

module.exports = {
  getDefaultLauncherInstallPath,
  resolveInstallRoot,
  validateInstallRoot,
  isLauncherInstalled,
  installLauncher
};
