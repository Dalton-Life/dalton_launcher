const fs = require('fs');
const path = require('path');
const { DEFAULT_PORT } = require('./fivem-launch');

let loaded = false;

function isPackagedApp() {
  return process.env.ELECTRON_IS_PACKAGED === '1' || process.defaultApp === false;
}

function getEnvCandidates(projectRoot) {
  const candidates = [path.join(projectRoot, '.env')];

  if (isPackagedApp()) {
    candidates.push(path.join(path.dirname(process.execPath), '.env'));
  }

  return candidates;
}

function loadEnv(projectRoot) {
  if (loaded) {
    return;
  }

  loaded = true;

  try {
    const dotenv = require('dotenv');

    for (const envPath of getEnvCandidates(projectRoot)) {
      if (!fs.existsSync(envPath)) {
        continue;
      }

      dotenv.config({ path: envPath, quiet: true });
    }
  } catch {
    // dotenv optional at runtime if env vars are set externally
  }
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function getDiscordEnv() {
  const applicationId = String(process.env.DISCORD_APPLICATION_ID || '').trim();
  const enabled = parseBoolean(process.env.DISCORD_RICH_PRESENCE, Boolean(applicationId));

  return {
    enabled: enabled && Boolean(applicationId),
    applicationId,
    largeImageKey: String(process.env.DISCORD_LARGE_IMAGE_KEY || 'dalton_logo').trim(),
    largeImageText: String(process.env.DISCORD_LARGE_IMAGE_TEXT || 'Dalton Life RP').trim()
  };
}

function getServerEnv() {
  const serverIp = String(process.env.SERVER_IP || '127.0.0.1').trim();
  const serverPort = Number(process.env.SERVER_PORT) || DEFAULT_PORT;

  return {
    serverIp,
    serverPort
  };
}

module.exports = {
  loadEnv,
  getDiscordEnv,
  getServerEnv
};
