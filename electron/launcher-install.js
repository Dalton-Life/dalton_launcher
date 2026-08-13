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

function readLauncherManifest(installRoot) {
  const manifestPath = getLauncherManifestPath(installRoot);
  if (!fs.existsSync(manifestPath)) { return null; }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
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

function validateInstallRoot(installRoot, app, { requireManifest = false } = {}) {
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

  if (requireManifest) {
    const manifest = readLauncherManifest(resolved);

    if (!manifest) {
      return { ok: false, message: 'No se encontró una instalación válida del launcher.' };
    }

    if (path.resolve(manifest.installPath || '') !== resolved) {
      return { ok: false, message: 'La ruta de instalación no coincide con el manifiesto.' };
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

function removeDesktopShortcut(app) {
  const shortcutPath = getDesktopShortcutPath(app);

  if (fs.existsSync(shortcutPath)) {
    fs.unlinkSync(shortcutPath);
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

function uninstallLauncher(config, app) {
  const defaultPath = getDefaultLauncherInstallPath(app);
  const resetPaths = {
    launcherInstallPath: defaultPath,
    installPath: path.join(defaultPath, 'server')
  };
  const validation = validateInstallRoot(config?.launcherInstallPath, app, {
    requireManifest: true
  });

  if (!validation.ok) {
    return {
      ok: false,
      message: validation.message,
      ...resetPaths
    };
  }

  if (fs.existsSync(validation.installRoot)) {
    fs.rmSync(validation.installRoot, { recursive: true, force: true });
  }

  removeDesktopShortcut(app);

  return {
    ok: true,
    message: 'Launcher desinstalado.',
    ...resetPaths
  };
}

module.exports = {
  LAUNCHER_FOLDER_NAME,
  getDefaultLauncherInstallPath,
  resolveInstallRoot,
  validateInstallRoot,
  isLauncherInstalled,
  installLauncher,
  uninstallLauncher,
  createDesktopShortcut,
  removeDesktopShortcut
};
