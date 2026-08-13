const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const DEFAULT_PORT = 30120;
const CONNECT_SHORTCUT_NAME = 'Dalton Life.url';

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

function getProcessListOutput() {
  try {
    return execSync('tasklist /NH', {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    }).toLowerCase();
  } catch {
    return '';
  }
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

function buildConnectUrl(serverIp, serverPort = DEFAULT_PORT) {
  const ip = String(serverIp || '').trim();
  const port = Number(serverPort) || DEFAULT_PORT;

  if (!ip) {
    throw new Error('Configura la IP del servidor en ajustes.');
  }

  if (!/^[\d.a-zA-Z:-]+$/.test(ip)) {
    throw new Error('IP del servidor inválida.');
  }

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
  buildConnectUrl,
  getConnectShortcutPath,
  getFiveMExecutablePath,
  getFiveMPlayState,
  isFiveMInstalled,
  launchDaltonLife,
  writeConnectShortcut
};
