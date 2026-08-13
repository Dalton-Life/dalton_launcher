const splashView = document.getElementById('splash-view');
const installView = document.getElementById('install-view');
const homeView = document.getElementById('home-view');
const settingsPanel = document.getElementById('settings-panel');
const notificationsPanel = document.getElementById('notifications-panel');
const updateOverlay = document.getElementById('update-overlay');
const updateTitle = document.getElementById('update-title');
const updateHint = document.getElementById('update-hint');
const updateSpinner = document.getElementById('update-spinner');
const updateProgressRow = document.getElementById('update-progress-row');
const installOverlay = document.getElementById('install-overlay');
const updateMessage = document.getElementById('update-message');
const installMessage = document.getElementById('install-message');
const progressBar = document.getElementById('progress-bar');
const installProgressBar = document.getElementById('install-progress-bar');
const progressValue = document.getElementById('progress-value');
const installProgressValue = document.getElementById('install-progress-value');
const installStatusLabel = document.getElementById('install-status-label');
const installStatusPath = document.getElementById('install-status-path');
const footerVersion = document.getElementById('footer-version');
const installFooterVersion = document.getElementById('install-footer-version');
const launcherInstallPathInput = document.getElementById('launcher-install-path');
const btnInstallLauncher = document.getElementById('btn-install-launcher');
const btnStartDalton = document.getElementById('btn-start-dalton');
const serverStatusDot = document.getElementById('server-status-dot');
const serverStatusText = document.getElementById('server-status-text');
const serverPlayers = document.getElementById('server-players');
const serverPing = document.getElementById('server-ping');
const serverCard = document.getElementById('server-card');
const notificationsList = document.getElementById('notifications-list');
const notificationBadge = document.getElementById('notification-badge');
const btnNotifications = document.getElementById('btn-notifications');
const musicVolumeInput = document.getElementById('music-volume');
const musicVolumeValue = document.getElementById('music-volume-value');

let config = null;
let serverStatusTimer = null;
let playStateTimer = null;
let launchPending = false;
let currentPlayState = 'idle';
let fivemOpenedDuringConnect = false;
let lastServerOnlineState = null;
let hasDisplayedServerStatus = false;
let serverStatusRequestId = 0;
let serverStatusInFlight = null;
let notificationItems = [];
const SERVER_STATUS_MAX_ATTEMPTS = 3;
const SERVER_STATUS_INTERVAL_MS = 15000;
const PLAY_STATE_INTERVAL_MS = 2000;

function isButtonSoundsMuted() {
  return Boolean(config?.muteButtonSounds);
}

function isBackgroundMusicMuted() {
  return Boolean(config?.muteBackgroundMusic);
}

function getBackgroundMusicVolume() {
  return Math.min(100, Math.max(0, Number(config?.backgroundMusicVolume) || 22));
}

function getAudioSettings() {
  return {
    muteButtonSounds: isButtonSoundsMuted(),
    muteBackgroundMusic: isBackgroundMusicMuted(),
    backgroundMusicVolume: getBackgroundMusicVolume()
  };
}

function updateMusicVolumeUi(volume = getBackgroundMusicVolume()) {
  musicVolumeInput.value = String(volume);
  musicVolumeValue.textContent = `${volume}%`;
  musicVolumeInput.disabled = isBackgroundMusicMuted();
  musicVolumeInput.classList.toggle('settings-range--disabled', isBackgroundMusicMuted());
}

function refreshAudioSettings() {
  window.daltonSounds?.refresh(getAudioSettings());
}

function syncDiscordPresence(state = currentPlayState) {
  window.dalton?.syncDiscordPresence?.(state);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setInstallStatus(label, pathText = '') {
  installStatusLabel.textContent = label;
  installStatusPath.textContent = pathText ? `DIR: ${pathText.toUpperCase()}` : '';
}

function showView(view) {
  document.querySelectorAll('.view').forEach((element) => {
    element.classList.remove('view--active');
  });
  view.classList.add('view--active');
}

function transitionFromSplash(targetView) {
  return new Promise((resolve) => {
    targetView.classList.add('view--active', 'home-enter');
    splashView.classList.add('splash-exit');

    splashView.addEventListener('animationend', (event) => {
      if (event.target !== splashView || event.animationName !== 'splash-view-out') return;

      splashView.classList.remove('view--active', 'splash-exit');
      targetView.classList.remove('home-enter');
      resolve();
    });
  });
}

function transitionToHome() {
  return transitionFromSplash(homeView);
}

function transitionToInstall() {
  return transitionFromSplash(installView);
}

function transitionInstallToHome() {
  return new Promise((resolve) => {
    installView.classList.add('splash-exit');
    homeView.classList.add('view--active', 'home-enter');

    installView.addEventListener(
      'animationend',
      (event) => {
        if (event.target !== installView || event.animationName !== 'splash-view-out') return;

        installView.classList.remove('view--active', 'splash-exit');
        homeView.classList.remove('home-enter');
        resolve();
      }
    );
  });
}

function toggleSettings(open) {
  if (open) {
    toggleNotifications(false);
  }

  settingsPanel.classList.toggle('is-open', open);
  settingsPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function toggleNotifications(open) {
  if (open) {
    toggleSettings(false);
  }

  notificationsPanel.classList.toggle('is-open', open);
  notificationsPanel.setAttribute('aria-hidden', open ? 'false' : 'true');

  if (open) {
    markAllNotificationsRead();
  }
}

function getNotificationId(item) {
  return String(item?.id || item?.title || '');
}

function getUnreadNotifications(items = notificationItems) {
  const read = new Set((config?.readNotificationIds || []).map(String));
  return items.filter((item) => {
    const id = getNotificationId(item);
    return id && !read.has(id);
  });
}

function updateNotificationBadge() {
  if (!notificationBadge) return;

  const count = getUnreadNotifications().length;

  if (count <= 0) {
    notificationBadge.classList.add('hidden');
    notificationBadge.setAttribute('aria-hidden', 'true');
    notificationBadge.textContent = '0';
    return;
  }

  notificationBadge.classList.remove('hidden');
  notificationBadge.setAttribute('aria-hidden', 'false');
  notificationBadge.textContent = count > 9 ? '9+' : String(count);
}

async function markAllNotificationsRead() {
  if (!notificationItems.length) {
    updateNotificationBadge();
    return;
  }

  const merged = [
    ...new Set([
      ...(config?.readNotificationIds || []).map(String),
      ...notificationItems.map(getNotificationId).filter(Boolean)
    ])
  ];

  if (merged.length === (config?.readNotificationIds || []).length) {
    renderNotifications();
    updateNotificationBadge();
    return;
  }

  config = await window.dalton.setConfig({ readNotificationIds: merged });
  renderNotifications();
  updateNotificationBadge();
}

function getServerEndpoint() {
  const ip = String(config?.serverIp || '').trim();
  const port = Number(config?.serverPort) || 30120;
  return ip ? `${ip}:${port}` : '';
}

function getPingLevel(ping) {
  if (ping == null || Number.isNaN(ping)) return 'none';
  if (ping <= 80) return 'good';
  if (ping <= 150) return 'medium';
  return 'bad';
}

function updateServerPing(ping) {
  if (!serverPing) return;

  if (ping == null || Number.isNaN(ping)) {
    serverPing.textContent = '—';
    serverPing.className = 'server-card__ping server-card__ping--none';
    return;
  }

  const roundedPing = Math.max(0, Math.round(ping));
  serverPing.textContent = `${roundedPing} MS`;
  serverPing.className = `server-card__ping server-card__ping--${getPingLevel(roundedPing)}`;
}

function setServerCardChecking(initial = false) {
  if (!initial && hasDisplayedServerStatus) {
    return;
  }

  serverCard.classList.remove('server-card--online-flash');

  if (!launchPending) {
    serverCard.classList.remove('server-card--connecting');
  }

  serverStatusDot.className = 'server-card__dot server-card__dot--checking';
  serverStatusText.textContent = 'VERIFICANDO...';
  serverPlayers.textContent = 'JUGADORES: —';

  if (initial) {
    updateServerPing(null);
  }
}

function triggerServerOnlineAnimation() {
  serverCard.classList.remove('server-card--online-flash');
  void serverCard.offsetWidth;
  serverCard.classList.add('server-card--online-flash');
}

function updateServerCardConnectingAnimation(isConnecting) {
  serverCard.classList.toggle('server-card--connecting', isConnecting);
}

function applyServerStatus(status) {
  if (!status) {
    setServerCardChecking(true);
    return;
  }

  hasDisplayedServerStatus = true;

  const wasOnline = lastServerOnlineState;
  lastServerOnlineState = Boolean(status.online);

  if (!status.online) {
    serverCard.classList.remove('server-card--online-flash');
    serverStatusDot.className = 'server-card__dot server-card__dot--offline';
    serverStatusText.textContent = 'OFFLINE';
    serverPlayers.textContent = status.error ? status.error.toUpperCase() : 'JUGADORES: —';
    updateServerPing(null);

    if (currentPlayState === 'idle' && !launchPending) {
      updateStartButton('idle');
    }

    return;
  }

  if (wasOnline === false) {
    triggerServerOnlineAnimation();
  }

  serverStatusDot.className = 'server-card__dot server-card__dot--online';
  serverStatusText.textContent = 'EN LÍNEA';
  serverPlayers.textContent = `JUGADORES: ${status.clients} / ${status.maxClients || '—'}`;
  updateServerPing(status.ping);

  if (currentPlayState === 'idle' && !launchPending) {
    updateStartButton('idle');
  }
}

async function queryServerStatus() {
  if (!window.dalton?.getServerStatus) {
    return {
      online: false,
      error: 'No se pudo consultar el servidor'
    };
  }

  let lastStatus = {
    online: false,
    error: 'Servidor offline'
  };

  for (let attempt = 1; attempt <= SERVER_STATUS_MAX_ATTEMPTS; attempt += 1) {
    const status = await window.dalton.getServerStatus();

    if (status?.online) {
      return status;
    }

    lastStatus = status || lastStatus;

    if (attempt < SERVER_STATUS_MAX_ATTEMPTS) {
      await sleep(350);
    }
  }

  return lastStatus;
}

async function refreshServerStatusNow() {
  const ip = String(config?.serverIp || '').trim();

  if (!ip) {
    hasDisplayedServerStatus = true;
    lastServerOnlineState = false;
    serverStatusDot.className = 'server-card__dot server-card__dot--offline';
    serverStatusText.textContent = 'SIN CONFIGURAR';
    serverPlayers.textContent = 'JUGADORES: —';
    updateServerPing(null);

    if (currentPlayState === 'idle' && !launchPending) {
      updateStartButton('idle');
    }

    return;
  }

  const requestId = ++serverStatusRequestId;

  if (!launchPending && currentPlayState === 'idle') {
    setServerCardChecking(!hasDisplayedServerStatus);
  }

  try {
    const status = await queryServerStatus();

    if (requestId !== serverStatusRequestId) {
      return;
    }

    applyServerStatus(status);
  } catch (error) {
    if (requestId !== serverStatusRequestId) {
      return;
    }

    applyServerStatus({
      online: false,
      endpoint: getServerEndpoint(),
      error: error?.message || 'Error consultando servidor'
    });
  }
}

function refreshServerStatus() {
  if (serverStatusInFlight) {
    return serverStatusInFlight;
  }

  serverStatusInFlight = refreshServerStatusNow().finally(() => {
    serverStatusInFlight = null;
  });

  return serverStatusInFlight;
}

function startServerStatusPolling() {
  stopServerStatusPolling();
  refreshServerStatus();
  serverStatusTimer = setInterval(refreshServerStatus, SERVER_STATUS_INTERVAL_MS);
}

function stopServerStatusPolling() {
  if (serverStatusTimer) {
    clearInterval(serverStatusTimer);
    serverStatusTimer = null;
  }
}

function updateStartButton(state) {
  currentPlayState = state;
  btnStartDalton.classList.remove('cta--running', 'cta--connecting', 'cta--offline');

  if (state === 'running') {
    btnStartDalton.disabled = true;
    btnStartDalton.classList.add('cta--running');
    btnStartDalton.textContent = 'EN EJECUCIÓN';
    updateServerCardConnectingAnimation(false);
    syncDiscordPresence(state);
    return;
  }

  if (state === 'connecting') {
    btnStartDalton.disabled = true;
    btnStartDalton.classList.add('cta--connecting');
    btnStartDalton.textContent = 'CONECTANDO...';
    updateServerCardConnectingAnimation(true);
    syncDiscordPresence(state);
    return;
  }

  updateServerCardConnectingAnimation(false);

  if (hasDisplayedServerStatus && lastServerOnlineState === false) {
    btnStartDalton.disabled = true;
    btnStartDalton.classList.add('cta--offline');
    btnStartDalton.textContent = 'SERVIDOR OFFLINE';
    syncDiscordPresence(state);
    return;
  }

  btnStartDalton.disabled = false;
  btnStartDalton.textContent = 'INICIAR DALTON LIFE';
  syncDiscordPresence(state);
}

async function refreshPlayState() {
  try {
    const playState = await window.dalton.getFiveMPlayState();
    const previousState = currentPlayState;

    if (playState.inGame) {
      launchPending = false;
      updateStartButton('running');
      return;
    }

    if (launchPending) {
      if (playState.running) {
        fivemOpenedDuringConnect = true;
      }

      if (fivemOpenedDuringConnect && !playState.running) {
        launchPending = false;
        fivemOpenedDuringConnect = false;
        updateStartButton('idle');
        refreshServerStatus();
        return;
      }

      updateStartButton('connecting');
      return;
    }

    if (previousState === 'running' || previousState === 'connecting') {
      launchPending = false;
      fivemOpenedDuringConnect = false;
    }

    updateStartButton('idle');

    if (previousState !== 'idle') {
      refreshServerStatus();
    }
  } catch {
    if (!launchPending) {
      updateStartButton('idle');
    }
  }
}

function startPlayStatePolling() {
  stopPlayStatePolling();
  refreshPlayState();
  playStateTimer = setInterval(refreshPlayState, PLAY_STATE_INTERVAL_MS);
}

function stopPlayStatePolling() {
  if (playStateTimer) {
    clearInterval(playStateTimer);
    playStateTimer = null;
  }

  launchPending = false;
  fivemOpenedDuringConnect = false;
  currentPlayState = 'idle';
  updateStartButton('idle');
  updateServerCardConnectingAnimation(false);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderNotifications(items = notificationItems) {
  if (!notificationsList) return;

  if (!items.length) {
    notificationsList.innerHTML = '<p class="news-block__empty">No hay notificaciones por ahora.</p>';
    updateNotificationBadge();
    return;
  }

  const read = new Set((config?.readNotificationIds || []).map(String));

  notificationsList.innerHTML = items
    .map((item) => {
      const id = getNotificationId(item);
      const isUnread = id && !read.has(id);
      const link = item.link
        ? `<button type="button" class="news-item__link" data-social-url="${escapeHtml(item.link)}">${escapeHtml(item.linkLabel || 'Ver más')}</button>`
        : '';

      return `
        <article class="news-item${isUnread ? ' news-item--unread' : ''}">
          <span class="news-item__tag">${escapeHtml(item.tag || 'AVISO')}</span>
          <h4 class="news-item__title">${escapeHtml(item.title || '')}</h4>
          <p class="news-item__body">${escapeHtml(item.body || '')}</p>
          ${link}
        </article>
      `;
    })
    .join('');

  notificationsList.querySelectorAll('[data-social-url]').forEach((button) => {
    button.addEventListener('click', () => {
      const url = button.getAttribute('data-social-url');
      if (url) window.dalton.openExternal(url);
    });
  });

  window.daltonSounds?.attachButtonSounds?.(notificationsList);
  updateNotificationBadge();
}

async function loadNotifications() {
  try {
    const payload = await window.dalton.getNews();
    notificationItems = payload?.items || [];
  } catch {
    notificationItems = [];
  }

  renderNotifications();
}

function applyConfigToUi() {
  footerVersion.textContent = `VERSION v${config.appVersion} — EARLY ACCESS`;
  installFooterVersion.textContent = footerVersion.textContent;
  launcherInstallPathInput.value = config.launcherInstallPath;
  document.getElementById('mute-music').checked = config.muteBackgroundMusic;
  document.getElementById('mute-sfx').checked = config.muteButtonSounds;
  updateMusicVolumeUi(getBackgroundMusicVolume());
  setInstallStatus('LISTO PARA INSTALAR', config.launcherInstallPath);

  if (homeView.classList.contains('view--active')) {
    refreshServerStatus();
    updateNotificationBadge();
  }

  refreshAudioSettings();
  syncDiscordPresence(currentPlayState);
}

async function runOverlayProgress(overlay, messageEl, barEl, valueEl, message, steps = 5) {
  updateTitle.textContent = 'ACTUALIZANDO';
  updateTitle.setAttribute('data-text', 'ACTUALIZANDO');
  updateHint.textContent = 'No cierres el launcher.';
  updateSpinner.classList.add('hidden');
  updateSpinner.setAttribute('aria-hidden', 'true');
  updateProgressRow.classList.remove('hidden');

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  messageEl.textContent = message;

  for (let step = 1; step <= steps; step += 1) {
    const percent = Math.round((step / steps) * 100);
    barEl.style.width = `${percent}%`;
    valueEl.textContent = `${percent}%`;
    await sleep(350);
  }

  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  barEl.style.width = '0%';
  valueEl.textContent = '0%';
}

function showBusyOverlay({ title, message, hint = 'No cierres el launcher.' }) {
  updateTitle.textContent = title;
  updateTitle.setAttribute('data-text', title);
  updateMessage.textContent = message;
  updateHint.textContent = hint;
  updateProgressRow.classList.add('hidden');
  updateSpinner.classList.remove('hidden');
  updateSpinner.setAttribute('aria-hidden', 'false');
  updateOverlay.classList.remove('hidden');
  updateOverlay.setAttribute('aria-hidden', 'false');
}

function hideBusyOverlay() {
  updateOverlay.classList.add('hidden');
  updateOverlay.setAttribute('aria-hidden', 'true');
  updateSpinner.classList.add('hidden');
  updateSpinner.setAttribute('aria-hidden', 'true');
  updateProgressRow.classList.remove('hidden');
  updateTitle.textContent = 'ACTUALIZANDO';
  updateTitle.setAttribute('data-text', 'ACTUALIZANDO');
  updateHint.textContent = 'No cierres el launcher.';
}

async function runProgress(message, steps = 5) {
  return runOverlayProgress(
    updateOverlay,
    updateMessage,
    progressBar,
    progressValue,
    message,
    steps
  );
}

async function runInstallProgress(message, steps = 5) {
  return runOverlayProgress(
    installOverlay,
    installMessage,
    installProgressBar,
    installProgressValue,
    message,
    steps
  );
}

async function saveConfigPartial(partial) {
  config = await window.dalton.setConfig(partial);
  applyConfigToUi();
}

async function bootstrap() {
  const version = await window.dalton.getVersion();
  config = await window.dalton.getConfig();
  config.appVersion = version;
  applyConfigToUi();

  window.daltonSounds.init(getAudioSettings());
  syncDiscordPresence('launcher');

  await sleep(2700);

  if (config.launcherInstalled) {
    await transitionToHome();
    syncDiscordPresence('idle');
    startServerStatusPolling();
    startPlayStatePolling();
    await loadNotifications();
    return;
  }

  stopServerStatusPolling();
  stopPlayStatePolling();
  syncDiscordPresence('launcher');
  await transitionToInstall();
}

document.getElementById('btn-minimize').addEventListener('click', () => {
  window.dalton.minimizeWindow();
});

document.getElementById('btn-close').addEventListener('click', () => {
  window.dalton.closeWindow();
});

document.getElementById('btn-minimize-install').addEventListener('click', () => {
  window.dalton.minimizeWindow();
});

document.getElementById('btn-close-install').addEventListener('click', () => {
  window.dalton.closeWindow();
});

document.getElementById('btn-notifications').addEventListener('click', () => {
  const isOpen = notificationsPanel.classList.contains('is-open');
  toggleNotifications(!isOpen);
});

document.getElementById('btn-close-notifications').addEventListener('click', () => {
  toggleNotifications(false);
});

document.getElementById('btn-settings').addEventListener('click', () => {
  toggleSettings(true);
});

document.getElementById('btn-close-settings').addEventListener('click', () => {
  toggleSettings(false);
});

document.getElementById('btn-browse-launcher').addEventListener('click', async () => {
  const selected = await window.dalton.selectFolder();
  if (!selected) return;

  const resolvedPath = await window.dalton.resolveInstallPath(selected);
  await saveConfigPartial({ launcherInstallPath: resolvedPath });
});

document.getElementById('mute-music').addEventListener('change', async (event) => {
  await saveConfigPartial({ muteBackgroundMusic: event.target.checked });
  updateMusicVolumeUi();
});

musicVolumeInput.addEventListener('input', (event) => {
  const volume = Math.min(100, Math.max(0, Number(event.target.value) || 0));
  musicVolumeValue.textContent = `${volume}%`;
  window.daltonSounds?.refresh({
    ...getAudioSettings(),
    backgroundMusicVolume: volume
  });
});

musicVolumeInput.addEventListener('change', async (event) => {
  const volume = Math.min(100, Math.max(0, Number(event.target.value) || 0));
  await saveConfigPartial({ backgroundMusicVolume: volume });
});

document.getElementById('mute-sfx').addEventListener('change', async (event) => {
  await saveConfigPartial({ muteButtonSounds: event.target.checked });
});

btnInstallLauncher.addEventListener('click', async () => {
  setInstallStatus('INSTALANDO...', config.launcherInstallPath);

  const createDesktopShortcut = document.getElementById('create-desktop-shortcut').checked;

  await runInstallProgress('Creando carpetas del launcher...', 3);
  await runInstallProgress('Configurando Dalton Launcher...', 4);

  if (createDesktopShortcut) {
    await runInstallProgress('Creando acceso directo en el escritorio...', 2);
  }

  const result = await window.dalton.installLauncher({
    installPath: config.launcherInstallPath,
    createDesktopShortcut
  });

  if (!result.ok) {
    setInstallStatus('ERROR DE INSTALACIÓN', config.launcherInstallPath);
    return;
  }

  config = await window.dalton.getConfig();
  config.appVersion = await window.dalton.getVersion();
  applyConfigToUi();
  syncDiscordPresence('idle');
  await transitionInstallToHome();
  await loadNotifications();
  startServerStatusPolling();
  startPlayStatePolling();
});

btnStartDalton.addEventListener('click', async () => {
  if (btnStartDalton.disabled) {
    return;
  }

  launchPending = true;
  fivemOpenedDuringConnect = false;
  updateStartButton('connecting');

  const result = await window.dalton.startDaltonLife();

  if (!result.ok) {
    launchPending = false;
    updateStartButton('idle');
    return;
  }

  await refreshPlayState();
});

document.querySelectorAll('[data-social-url]').forEach((button) => {
  button.addEventListener('click', () => {
    const url = button.getAttribute('data-social-url');
    if (url) window.dalton.openExternal(url);
  });
});

serverCard.addEventListener('animationend', (event) => {
  if (event.animationName === 'server-card-online-in') {
    serverCard.classList.remove('server-card--online-flash');
  }
});

document.getElementById('btn-open-fivem-site').addEventListener('click', () => {
  window.dalton.openExternal('https://fivem.net/');
});

document.getElementById('btn-clear-fivem-cache').addEventListener('click', async () => {
  const confirmed = await window.dalton.confirmClearFiveMCache();
  if (!confirmed) {
    return;
  }

  showBusyOverlay({
    title: 'BORRANDO CACHÉ',
    message: 'Eliminando carpetas de FiveM...',
    hint: 'Esto puede tardar unos segundos.'
  });

  await sleep(50);

  try {
    const result = await window.dalton.clearFiveMCache();
    hideBusyOverlay();
    await window.dalton.showCacheClearResult(result);
  } catch (error) {
    hideBusyOverlay();
    await window.dalton.showCacheClearResult({
      ok: false,
      message: error.message || 'Error inesperado al borrar la caché.'
    });
  }
});

bootstrap();
