const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const DEFAULT_PORT = 30120;
const CONNECT_SHORTCUT_NAME = 'Dalton Life.url';
const SERVER_NOT_CONFIGURED_MESSAGE =
  'Servidor no configurado en esta versión del launcher. Contacta al equipo de Dalton.';

function getFiveMExecutablePath() {
  const localAppData = process.env.LOCALAPPDATA;

  if (!localAppData) {
    return null;
  }

  return path.join(localAppData, 'FiveM', 'FiveM.exe');
}

function isFiveMInstalled() {
  const executablePath = getFiveMExecutablePath();
  return Boolean(executablePath && fs.existsSync(executablePath));
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
  if (!isFiveMInstalled()) {
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
  CONNECT_SHORTCUT_NAME,
  DEFAULT_PORT,
  SERVER_NOT_CONFIGURED_MESSAGE,
  buildConnectUrl,
  getConnectShortcutPath,
  getFiveMExecutablePath,
  getFiveMPlayState,
  isFiveMInstalled,
  launchDaltonLife,
  validateServerHost,
  writeConnectShortcut
};
