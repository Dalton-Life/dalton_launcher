const RPC = require('discord-rpc');
const { getDiscordEnv } = require('./env');

let client = null;
let ready = false;
let startTimestamp = null;
let activeClientId = null;
let activeImageKey = 'dalton_logo';
let activeImageText = 'Dalton Life RP';

const PRESENCE = {
  launcher: {
    details: 'Dalton Launcher',
    state: 'Iniciando...'
  },
  idle: {
    details: 'Dalton Life',
    state: 'En el launcher'
  },
  connecting: {
    details: 'Dalton Life',
    state: 'Conectando al servidor...'
  },
  running: {
    details: 'Dalton Life',
    state: 'Jugando en Dalton City'
  }
};

async function initDiscordPresence(clientId, options = {}) {
  const normalizedId = String(clientId || '').trim();

  if (!normalizedId) {
    await destroyDiscordPresence();
    return false;
  }

  activeImageKey = options.largeImageKey || 'dalton_logo';
  activeImageText = options.largeImageText || 'Dalton Life RP';

  if (ready && client && activeClientId === normalizedId) {
    return true;
  }

  await destroyDiscordPresence();

  try {
    RPC.register(normalizedId);
    client = new RPC.Client({ transport: 'ipc' });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Discord RPC timeout')), 10000);

      client.once('ready', () => {
        clearTimeout(timeout);
        ready = true;
        activeClientId = normalizedId;
        startTimestamp = Math.floor(Date.now() / 1000);
        resolve();
      });

      client.login({ clientId: normalizedId }).catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    return true;
  } catch {
    client = null;
    ready = false;
    activeClientId = null;
    startTimestamp = null;
    return false;
  }
}

function setDiscordPresence(state = 'idle') {
  if (!ready || !client) {
    return false;
  }

  const preset = PRESENCE[state] || PRESENCE.idle;

  try {
    client.setActivity({
      details: preset.details,
      state: preset.state,
      startTimestamp,
      largeImageKey: activeImageKey,
      largeImageText: activeImageText,
      instance: false
    });
    return true;
  } catch {
    ready = false;
    return false;
  }
}

async function destroyDiscordPresence() {
  ready = false;
  activeClientId = null;
  startTimestamp = null;

  if (!client) {
    return;
  }

  try {
    await client.clearActivity();
    await client.destroy();
  } catch {
    // Discord may already be closed.
  }

  client = null;
}

async function syncDiscordPresence(state = 'idle') {
  const env = getDiscordEnv();

  if (!env.enabled) {
    await destroyDiscordPresence();
    return false;
  }

  const initialized = await initDiscordPresence(env.applicationId, {
    largeImageKey: env.largeImageKey,
    largeImageText: env.largeImageText
  });

  if (!initialized) {
    return false;
  }

  return setDiscordPresence(state);
}

module.exports = {
  destroyDiscordPresence,
  syncDiscordPresence
};
