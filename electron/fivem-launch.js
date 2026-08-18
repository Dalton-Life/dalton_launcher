const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { DEFAULT_SERVER_PORT: DEFAULT_PORT } = require('./constants');
const CONNECT_SHORTCUT_NAME = 'Dalton Life.url';
const SERVER_NOT_CONFIGURED_MESSAGE =
  'Servidor no configurado en esta versión del launcher. Contacta al equipo de Dalton.';

function readWindowsDocumentsPath() {
  if (process.platform !== 'win32') {
    return null;
  }

  try {
    const output = execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders" /v Personal',
      {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      }
    );
    const match = output.match(/REG_(?:EXPAND_)?SZ\s+(.+)/i);

    if (!match) {
      return null;
    }

    return match[1]
      .trim()
      .replace(/%([^%]+)%/g, (_, name) => process.env[name] || `%${name}%`);
  } catch {
    return null;
  }
}

function getDocumentsDirectory() {
  try {
    const { app } = require('electron');

    if (app?.getPath) {
      return app.getPath('documents');
    }
  } catch {
    // electron may not be available in standalone scripts
  }

  const registryDocuments = readWindowsDocumentsPath();

  if (registryDocuments && fs.existsSync(registryDocuments)) {
    return registryDocuments;
  }

  const oneDrive = process.env.OneDrive;

  if (oneDrive) {
    for (const folderName of ['Documentos', 'Documents']) {
      const candidate = path.join(oneDrive, folderName);

      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  const userProfile = process.env.USERPROFILE;

  if (!userProfile) {
    return null;
  }

  for (const folderName of ['Documentos', 'Documents']) {
    const candidate = path.join(userProfile, folderName);

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(userProfile, 'Documents');
}

function isValidFiveMAppRoot(appRoot) {
  if (!appRoot) {
    return false;
  }

  try {
    const resolved = path.resolve(appRoot);
    const hasMarker =
      fs.existsSync(path.join(resolved, 'CitizenFX.ini')) ||
      fs.existsSync(path.join(resolved, 'components.json'));
    const hasRuntime =
      fs.existsSync(path.join(resolved, 'data')) || fs.existsSync(path.join(resolved, 'citizen'));

    return hasMarker && hasRuntime;
  } catch {
    return false;
  }
}

function getFiveMAppRootCandidates(options = {}) {
  const candidates = [];
  const pushCandidate = (value) => {
    if (!value) {
      return;
    }

    const resolved = path.resolve(value);

    if (!candidates.includes(resolved)) {
      candidates.push(resolved);
    }
  };

  pushCandidate(options.fivemAppPath);

  const localAppData = process.env.LOCALAPPDATA;

  if (localAppData) {
    pushCandidate(path.join(localAppData, 'FiveM', 'FiveM.app'));
  }

  const documentsPath = getDocumentsDirectory();

  if (documentsPath) {
    pushCandidate(path.join(documentsPath, 'FiveM.app'));
    pushCandidate(path.join(documentsPath, 'FiveM', 'FiveM.app'));
  }

  const protocolExecutable = readRegistryProtocolExecutable();

  if (protocolExecutable) {
    const protocolDir = path.dirname(protocolExecutable);

    pushCandidate(path.join(protocolDir, 'FiveM.app'));

    if (path.basename(protocolDir).toLowerCase() === 'fivem.app') {
      pushCandidate(protocolDir);
    }
  }

  return candidates;
}

function resolveFiveMAppRoot(options = {}) {
  for (const candidate of getFiveMAppRootCandidates(options)) {
    if (isValidFiveMAppRoot(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getFiveMDataPath(options = {}) {
  const appRoot = resolveFiveMAppRoot(options);

  return appRoot ? path.join(appRoot, 'data') : null;
}

function getDefaultFiveMExecutablePaths() {
  const localAppData = process.env.LOCALAPPDATA;

  if (!localAppData) {
    return [];
  }

  const root = path.join(localAppData, 'FiveM');

  return [path.join(root, 'FiveM.exe'), path.join(root, 'FiveM.app', 'FiveM.exe')];
}

function readRegistryProtocolExecutable() {
  if (process.platform !== 'win32') {
    return null;
  }

  const keys = [
    'HKCU\\Software\\Classes\\fivem\\shell\\open\\command',
    'HKCR\\fivem\\shell\\open\\command'
  ];

  for (const key of keys) {
    try {
      const output = execSync(`reg query "${key}" /ve`, {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      });

      const valueLine = output.split(/\r?\n/).find((line) => /REG_(EXPAND_)?SZ/i.test(line));

      if (!valueLine) {
        continue;
      }

      const value = valueLine.replace(/.*REG_(?:EXPAND_)?SZ\s+/i, '').trim();
      const quotedMatch = value.match(/"([^"]+\.exe)"/i);

      if (quotedMatch) {
        return quotedMatch[1];
      }

      const unquotedMatch = value.match(/([A-Za-z]:\\[^\s"]+\.exe)/i);

      if (unquotedMatch) {
        return unquotedMatch[1];
      }
    } catch {
      // try next registry key
    }
  }

  return null;
}

function getFiveMExecutablePath() {
  for (const candidate of getDefaultFiveMExecutablePaths()) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const protocolExecutable = readRegistryProtocolExecutable();

  if (protocolExecutable && fs.existsSync(protocolExecutable)) {
    return protocolExecutable;
  }

  return null;
}

function isFiveMInstalled(options = {}) {
  if (getFiveMExecutablePath()) {
    return true;
  }

  if (resolveFiveMAppRoot(options)) {
    return true;
  }

  const playState = getFiveMPlayState();

  if (playState.running || playState.inGame) {
    return true;
  }

  return Boolean(readRegistryProtocolExecutable());
}

let processListCache = {
  output: '',
  expiresAt: 0
};

const PROCESS_LIST_TTL_MS = 2000;

function getProcessListOutput() {
  const now = Date.now();

  if (now < processListCache.expiresAt) {
    return processListCache.output;
  }

  let output = '';

  try {
    output = execSync('tasklist /NH', {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    }).toLowerCase();
  } catch {
    output = '';
  }

  processListCache = {
    output,
    expiresAt: now + PROCESS_LIST_TTL_MS
  };

  return output;
}

function isFiveMInGame(processListOutput = getProcessListOutput()) {
  return /fivem(?:_b\d+)?_gtaprocess/.test(processListOutput);
}

function isFiveMRunning(processListOutput = getProcessListOutput()) {
  return /\bfivem\.exe\b/.test(processListOutput);
}

function getFiveMPlayState() {
  const processListOutput = getProcessListOutput();

  return {
    inGame: isFiveMInGame(processListOutput),
    running: isFiveMRunning(processListOutput)
  };
}

function normalizeServerPort(serverPort) {
  const port = Number(serverPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Puerto del servidor inválido.');
  }

  return port;
}

function validateServerHost(serverIp) {
  const host = String(serverIp || '').trim();

  if (!host) {
    throw new Error(SERVER_NOT_CONFIGURED_MESSAGE);
  }

  if (host.toLowerCase() === 'localhost') {
    return '127.0.0.1';
  }

  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;

  if (ipv4Pattern.test(host)) {
    const isValid = host.split('.').every((octet) => {
      const value = Number(octet);
      return value >= 0 && value <= 255;
    });

    if (!isValid) {
      throw new Error('IP del servidor inválida.');
    }

    return host;
  }

  const hostnamePattern =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (hostnamePattern.test(host)) {
    return host;
  }

  throw new Error('IP del servidor inválida.');
}

function buildConnectUrl(serverIp, serverPort = DEFAULT_PORT) {
  const ip = validateServerHost(serverIp);
  const port = normalizeServerPort(serverPort);

  return `fivem://connect/${ip}:${port}`;
}

function getConnectShortcutPath(installRoot) {
  return path.join(installRoot, CONNECT_SHORTCUT_NAME);
}

function writeConnectShortcut(installRoot, serverIp, serverPort) {
  const connectUrl = buildConnectUrl(serverIp, serverPort);
  const shortcutPath = getConnectShortcutPath(installRoot);

  fs.mkdirSync(installRoot, { recursive: true });
  fs.writeFileSync(shortcutPath, `[InternetShortcut]\r\nURL=${connectUrl}\r\n`, 'utf8');

  return { connectUrl, shortcutPath };
}

async function launchViaExplorerShortcut(shortcutPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('explorer.exe', [shortcutPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      shell: false
    });

    child.once('error', reject);
    child.unref();
    resolve();
  });
}

async function launchDaltonLife(serverIp, serverPort, options = {}) {
  if (!isFiveMInstalled(options)) {
    return {
      ok: false,
      message: 'FiveM no está instalado. Instálalo desde fivem.net primero.'
    };
  }

  const installRoot = options.installRoot;

  if (!installRoot) {
    return {
      ok: false,
      message: 'Instala el launcher primero.'
    };
  }

  const { connectUrl, shortcutPath } = writeConnectShortcut(installRoot, serverIp, serverPort);
  await launchViaExplorerShortcut(shortcutPath);

  return {
    ok: true,
    message: 'Abriendo FiveM y conectando a Dalton Life...',
    connectUrl,
    shortcutPath
  };
}

module.exports = {
  DEFAULT_PORT,
  SERVER_NOT_CONFIGURED_MESSAGE,
  getFiveMDataPath,
  getFiveMPlayState,
  isFiveMInstalled,
  launchDaltonLife,
  validateServerHost,
  writeConnectShortcut
};
