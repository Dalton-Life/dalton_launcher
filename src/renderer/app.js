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
const updateSize = document.getElementById('update-size');
const updateNotes = document.getElementById('update-notes');
const installMessage = document.getElementById('install-message');
const installProgressBar = document.getElementById('install-progress-bar');
const installProgressValue = document.getElementById('install-progress-value');
const installStatusLabel = document.getElementById('install-status-label');
const installStatusPath = document.getElementById('install-status-path');
const footerVersion = document.getElementById('footer-version');
const installFooterVersion = document.getElementById('install-footer-version');
const progressBar = document.getElementById('progress-bar');
const progressValue = document.getElementById('progress-value');
const updateActionsRow = document.getElementById('update-actions-row');
const btnUpdateRestart = document.getElementById('btn-update-restart');
const btnUpdateLater = document.getElementById('btn-update-later');
const btnCheckUpdates = document.getElementById('btn-check-updates');
const updateStatus = document.getElementById('update-status');
const updateFeedbackActions = document.getElementById('update-feedback-actions');
const btnRetryUpdates = document.getElementById('btn-retry-updates');
const btnRelaunchLauncher = document.getElementById('btn-relaunch-launcher');
const updateBadge = document.getElementById('update-badge');
const pendingUpdateBanner = document.getElementById('pending-update-banner');
const pendingUpdateBannerText = document.getElementById('pending-update-banner-text');
const updateToast = document.getElementById('update-toast');
const updateToastMessage = document.getElementById('update-toast-message');
const btnUpdateToastRetry = document.getElementById('btn-update-toast-retry');
const btnUpdateToastDismiss = document.getElementById('btn-update-toast-dismiss');
const btnPendingUpdateRestart = document.getElementById('btn-pending-update-restart');
const DEFAULT_APP_VERSION = '0.1.0';
let appVersion = DEFAULT_APP_VERSION;
let updateInProgress = false;
let pendingUpdateVersion = null;
let pendingUpdateReleaseNotes = null;
let pendingUpdateBannerVisible = false;
let resolveStartupUpdateCheck = null;
let toastActionHandler = null;
const STARTUP_UPDATE_TIMEOUT_MS = 20000;
const FIVEM_DOWNLOAD_URL = 'https://fivem.net/';
const launcherInstallPathInput = document.getElementById('launcher-install-path');
const btnInstallLauncher = document.getElementById('btn-install-launcher');
const btnStartDalton = document.getElementById('btn-start-dalton');
const serverStatusDot = document.getElementById('server-status-dot');
const serverStatusText = document.getElementById('server-status-text');
const serverPlayers = document.getElementById('server-players');
const serverPing = document.getElementById('server-ping');
const serverHostname = document.getElementById('server-hostname');
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
let fivemRunningAtLaunchStart = false;
let lastServerOnlineState = null;
let hasDisplayedServerStatus = false;
let serverStatusRequestId = 0;
let serverStatusInFlight = null;
let notificationItems = [];
const SERVER_STATUS_MAX_ATTEMPTS = 3;
const SERVER_STATUS_INTERVAL_MS = 15000;
const PLAY_STATE_INTERVAL_MS = 2000;

function formatDisplayVersion(version) {
  const raw = String(version || DEFAULT_APP_VERSION).trim().replace(/^v/i, '');
  return raw || DEFAULT_APP_VERSION;
}

function formatVersionLabel(version = appVersion) {
  return `VERSION v${formatDisplayVersion(version)} — EARLY ACCESS`;
}

function formatUpdateVersion(version) {
  const raw = String(version || '').trim().replace(/^v/i, '');
  return raw || formatDisplayVersion(appVersion);
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatReleaseNotes(notes) {
  if (!notes) {
    return '';
  }

  const text = typeof notes === 'string'
    ? notes
    : Array.isArray(notes)
      ? notes.map((entry) => (typeof entry === 'string' ? entry : entry?.note || '')).join('\n')
      : '';

  const trimmed = text.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.length <= 280) {
    return trimmed;
  }

  return `${trimmed.slice(0, 277)}...`;
}

function setUpdateNotes(notes, visible = true) {
  if (!updateNotes) {
    return;
  }

  const formatted = formatReleaseNotes(notes);

  if (!visible || !formatted) {
    updateNotes.textContent = '';
    updateNotes.classList.add('hidden');
    return;
  }

  updateNotes.textContent = formatted;
  updateNotes.classList.remove('hidden');
}

function setUpdateSize(transferred, total) {
  if (!updateSize) {
    return;
  }

  const safeTotal = Number(total) || 0;
  const safeTransferred = Number(transferred) || 0;

  if (safeTotal <= 0) {
    updateSize.textContent = '';
    updateSize.classList.add('hidden');
    return;
  }

  updateSize.textContent = `${formatBytes(safeTransferred)} / ${formatBytes(safeTotal)}`;
  updateSize.classList.remove('hidden');
}

function clearUpdateSize() {
  if (!updateSize) {
    return;
  }

  updateSize.textContent = '';
  updateSize.classList.add('hidden');
}

function refreshPendingUpdateBadge() {
  const showBadge = Boolean(pendingUpdateVersion) && !updateInProgress;
  updateBadge?.classList.toggle('hidden', !showBadge);
  updateBadge?.setAttribute('aria-hidden', showBadge ? 'false' : 'true');

  if (!pendingUpdateBanner || !pendingUpdateBannerText) {
    return;
  }

  const showBanner = showBadge && pendingUpdateBannerVisible;

  if (showBanner) {
    pendingUpdateBannerText.textContent = `Actualización v${formatUpdateVersion(pendingUpdateVersion)} lista. Reinicia para instalarla.`;
  }

  pendingUpdateBanner.classList.toggle('hidden', !showBanner);
  pendingUpdateBanner.setAttribute('aria-hidden', showBanner ? 'false' : 'true');
}

function showUpdateToast(
  message,
  { type = 'error', retry = false, actionLabel = '', onAction = null } = {}
) {
  if (!updateToast || !updateToastMessage) {
    return;
  }

  updateToastMessage.textContent = message;
  updateToast.className = `update-toast update-toast--${type}`;
  updateToast.classList.remove('hidden');

  const hasCustomAction = Boolean(actionLabel && onAction);
  toastActionHandler = hasCustomAction ? onAction : retry ? 'update-retry' : null;

  if (btnUpdateToastRetry) {
    btnUpdateToastRetry.textContent = hasCustomAction ? actionLabel : 'Reintentar';
    btnUpdateToastRetry.classList.toggle('hidden', !retry && !hasCustomAction);
  }
}

function hideUpdateToast() {
  updateToast?.classList.add('hidden');
  btnUpdateToastRetry?.classList.add('hidden');
  toastActionHandler = null;
}

function isFiveMInstallError(message = '') {
  return /fivem no está instalado/i.test(message);
}

function showLaunchError(message) {
  const text = message?.trim() || 'No se pudo abrir FiveM. Inténtalo de nuevo.';

  if (isFiveMInstallError(text)) {
    showUpdateToast(text, {
      type: 'error',
      actionLabel: 'Descargar FiveM',
      onAction: () => window.dalton.openExternal(FIVEM_DOWNLOAD_URL)
    });
    return;
  }

  showUpdateToast(text, { type: 'error' });
}

function setUpdateStatus(message, type = 'info') {
  if (!updateStatus) {
    return;
  }

  updateStatus.textContent = message;
  updateStatus.className = `update-status update-status--${type}`;
  updateStatus.classList.remove('hidden');
}

function setUpdateFeedbackActions({ showRetry = false, showRelaunch = false } = {}) {
  const visible = showRetry || showRelaunch;
  updateFeedbackActions?.classList.toggle('hidden', !visible);
  btnRetryUpdates?.classList.toggle('hidden', !showRetry);
  btnRelaunchLauncher?.classList.toggle('hidden', !showRelaunch);
}

function showUpdateError(message, { manual = false, startup = false } = {}) {
  if (manual) {
    setUpdateStatus(message, 'error');
    setUpdateFeedbackActions({ showRetry: true, showRelaunch: true });
  }

  if (manual || startup) {
    showUpdateToast(message, { type: 'error', retry: true });
  }
}

function clearUpdateStatus() {
  updateStatus?.classList.add('hidden');
  setUpdateFeedbackActions();
}

function refreshUpdateButton() {
  if (!btnCheckUpdates) {
    return;
  }

  btnCheckUpdates.textContent = pendingUpdateVersion
    ? 'Reiniciar para actualizar'
    : 'Buscar actualizaciones';
}

function setManualUpdateChecking(isChecking) {
  if (!btnCheckUpdates || pendingUpdateVersion) {
    return;
  }

  btnCheckUpdates.disabled = isChecking;
  btnCheckUpdates.textContent = isChecking ? 'Buscando...' : 'Buscar actualizaciones';
}

function clampVolumePercent(value, fallback = 22) {
  if (value === '' || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function isButtonSoundsMuted() {
  return Boolean(config?.muteButtonSounds);
}

function isBackgroundMusicMuted() {
  return Boolean(config?.muteBackgroundMusic);
}

function getBackgroundMusicVolume() {
  return clampVolumePercent(config?.backgroundMusicVolume, 22);
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

function formatServerPlayersLine(status) {
  if (!status.online) {
    if (status.error) {
      const error = String(status.error).trim();
      if (/offline|no disponible/i.test(error)) {
        return 'No disponible';
      }

      return error.charAt(0).toUpperCase() + error.slice(1);
    }

    return 'Sin jugadores';
  }

  return `${status.clients} / ${status.maxClients || '—'} jugadores`;
}

function updateServerPing(ping) {
  if (!serverPing) return;

  if (ping == null || Number.isNaN(ping)) {
    serverPing.textContent = '—';
    serverPing.className = 'server-card__ping server-card__ping--none';
    return;
  }

  const roundedPing = Math.max(0, Math.round(ping));
  serverPing.textContent = `${roundedPing} ms`;
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
  serverStatusText.textContent = 'Verificando';
  serverPlayers.textContent = '—';

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
    serverStatusText.textContent = 'Offline';
    serverHostname.textContent = 'Dalton Life';
    serverPlayers.textContent = formatServerPlayersLine(status);
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
  serverStatusText.textContent = 'En línea';
  serverHostname.textContent = String(status.hostname || 'Dalton Life').trim() || 'Dalton Life';
  serverPlayers.textContent = formatServerPlayersLine(status);
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
    serverStatusText.textContent = 'Sin configurar';
    serverPlayers.textContent = '—';
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
      if (playState.running && !fivemRunningAtLaunchStart) {
        fivemOpenedDuringConnect = true;
      }
      if (fivemRunningAtLaunchStart) {
        launchPending = false;
        fivemRunningAtLaunchStart = false;
        fivemOpenedDuringConnect = false;
        updateStartButton(playState.inGame ? 'running' : 'idle');
        if (!playState.inGame) {
          refreshServerStatus();
        }
        return;
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
  fivemRunningAtLaunchStart = false;
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
  const versionLabel = formatVersionLabel(appVersion);
  footerVersion.textContent = versionLabel;
  installFooterVersion.textContent = versionLabel;
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

function showBusyOverlay({ title, message, hint = 'No cierres el launcher.' }) {
  if (updateInProgress) {
    return;
  }

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
  if (updateInProgress) {
    return;
  }

  updateOverlay.classList.add('hidden');
  updateOverlay.setAttribute('aria-hidden', 'true');
  updateSpinner.classList.add('hidden');
  updateSpinner.setAttribute('aria-hidden', 'true');
  updateProgressRow.classList.remove('hidden');
  updateTitle.textContent = 'ACTUALIZANDO';
  updateTitle.setAttribute('data-text', 'ACTUALIZANDO');
  updateHint.textContent = 'No cierres el launcher.';
}

function showUpdateOverlay({ title, message, hint = 'No cierres el launcher.', mode = 'progress' }) {
  updateInProgress = true;
  updateTitle.textContent = title;
  updateTitle.setAttribute('data-text', title);
  updateMessage.textContent = message;
  updateHint.textContent = hint;
  updateActionsRow?.classList.toggle('hidden', mode !== 'ready');

  if (mode === 'spinner') {
    updateProgressRow.classList.add('hidden');
    updateSpinner.classList.remove('hidden');
    updateSpinner.setAttribute('aria-hidden', 'false');
  } else if (mode === 'ready') {
    updateSpinner.classList.add('hidden');
    updateSpinner.setAttribute('aria-hidden', 'true');
    updateProgressRow.classList.add('hidden');
  } else {
    updateSpinner.classList.add('hidden');
    updateSpinner.setAttribute('aria-hidden', 'true');
    updateProgressRow.classList.remove('hidden');
  }

  updateOverlay.classList.remove('hidden');
  updateOverlay.setAttribute('aria-hidden', 'false');
}

function hideUpdateOverlay() {
  updateInProgress = false;
  updateOverlay.classList.add('hidden');
  updateOverlay.setAttribute('aria-hidden', 'true');
  updateSpinner.classList.add('hidden');
  updateSpinner.setAttribute('aria-hidden', 'true');
  updateProgressRow.classList.remove('hidden');
  updateActionsRow?.classList.add('hidden');
  updateTitle.textContent = 'ACTUALIZANDO';
  updateTitle.setAttribute('data-text', 'ACTUALIZANDO');
  updateMessage.textContent = 'Descargando componentes...';
  updateHint.textContent = 'No cierres el launcher.';
  progressBar.style.width = '0%';
  progressValue.textContent = '0%';
  clearUpdateSize();
  setUpdateNotes(null, false);
  refreshPendingUpdateBadge();
}

function showUpdateReady(version, releaseNotes = pendingUpdateReleaseNotes) {
  pendingUpdateVersion = version;
  pendingUpdateReleaseNotes = releaseNotes || pendingUpdateReleaseNotes;
  pendingUpdateBannerVisible = false;
  refreshUpdateButton();
  refreshPendingUpdateBadge();
  setUpdateOverlayProgress(100);
  setUpdateNotes(pendingUpdateReleaseNotes, true);
  clearUpdateSize();
  showUpdateOverlay({
    title: 'LISTO PARA REINICIAR',
    message: `La versión v${formatUpdateVersion(version)} está lista para instalar.`,
    mode: 'ready',
    hint: 'Debes reiniciar el launcher para aplicar la actualización. No basta con recargar la ventana.'
  });
}

function setUpdateOverlayProgress(percent, transferred, total) {
  const safePercent = Math.min(100, Math.max(0, Number(percent) || 0));

  progressBar.style.width = `${safePercent}%`;
  progressValue.textContent = `${Math.round(safePercent)}%`;
  setUpdateSize(transferred, total);
}

function resolveStartupUpdateCheckIfNeeded() {
  if (resolveStartupUpdateCheck) {
    resolveStartupUpdateCheck();
    resolveStartupUpdateCheck = null;
  }
}

function waitForStartupUpdateCheck() {
  return new Promise((resolve) => {
    resolveStartupUpdateCheck = resolve;
  });
}

async function runStartupUpdateCheck() {
  if (!config?.packaged) {
    return;
  }

  const waitPromise = waitForStartupUpdateCheck();
  void window.dalton.checkForUpdates({ startup: true });

  await Promise.race([waitPromise, sleep(STARTUP_UPDATE_TIMEOUT_MS)]);
  resolveStartupUpdateCheckIfNeeded();
}

function setupUpdaterListeners() {
  if (!window.dalton.onUpdaterEvent) {
    return () => {};
  }

  return window.dalton.onUpdaterEvent((event) => {
    switch (event.type) {
      case 'checking':
        if (event.manual) {
          clearUpdateStatus();
          hideUpdateToast();
          setManualUpdateChecking(true);
        }
        break;
      case 'available':
        setManualUpdateChecking(false);
        hideUpdateToast();
        setUpdateFeedbackActions();
        resolveStartupUpdateCheckIfNeeded();
        pendingUpdateReleaseNotes = event.releaseNotes || null;
        setUpdateNotes(null, false);
        clearUpdateSize();
        showUpdateOverlay({
          title: 'ACTUALIZANDO',
          message: `Descargando v${formatUpdateVersion(event.version)}...`,
          mode: 'progress'
        });
        setUpdateOverlayProgress(0, 0, 0);
        break;
      case 'progress':
        setUpdateOverlayProgress(event.percent, event.transferred, event.total);
        break;
      case 'downloaded':
        setManualUpdateChecking(false);
        showUpdateReady(event.version, event.releaseNotes || pendingUpdateReleaseNotes);
        break;
      case 'not-available':
        setManualUpdateChecking(false);
        resolveStartupUpdateCheckIfNeeded();
        hideUpdateOverlay();
        setUpdateFeedbackActions();
        if (event.manual) {
          setUpdateStatus('Ya tienes la última versión.', 'success');
        }
        break;
      case 'error':
        setManualUpdateChecking(false);
        resolveStartupUpdateCheckIfNeeded();
        hideUpdateOverlay();
        showUpdateError(event.message || 'No se pudo comprobar actualizaciones.', {
          manual: Boolean(event.manual),
          startup: Boolean(event.startup)
        });
        break;
      default:
        break;
    }
  });
}

function setInstallOverlayProgress(message, percent) {
  const safePercent = Math.min(100, Math.max(0, Number(percent) || 0));

  installOverlay.classList.remove('hidden');
  installOverlay.setAttribute('aria-hidden', 'false');
  installMessage.textContent = message;
  installProgressBar.style.width = `${safePercent}%`;
  installProgressValue.textContent = `${safePercent}%`;
}

function hideInstallOverlay() {
  installOverlay.classList.add('hidden');
  installOverlay.setAttribute('aria-hidden', 'true');
  installProgressBar.style.width = '0%';
  installProgressValue.textContent = '0%';
}

async function saveConfigPartial(partial) {
  config = await window.dalton.setConfig(partial);
  applyConfigToUi();
}

async function bootstrap() {
  setupUpdaterListeners();

  try {
    appVersion = formatDisplayVersion(await window.dalton.getVersion());
  } catch {
    appVersion = DEFAULT_APP_VERSION;
  }

  config = await window.dalton.getConfig();
  applyConfigToUi();
  refreshUpdateButton();
  refreshPendingUpdateBadge();

  window.daltonSounds.init(getAudioSettings());
  syncDiscordPresence('launcher');

  await sleep(2700);

  if (config.launcherInstalled) {
    await transitionToHome();
    void runStartupUpdateCheck();
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

document.getElementById('btn-settings-install').addEventListener('click', () => {
  toggleSettings(true);
});

document.getElementById('btn-close-settings').addEventListener('click', () => {
  toggleSettings(false);
});

document.getElementById('btn-browse-launcher').addEventListener('click', async () => {
  const selected = await window.dalton.selectFolder();
  if (!selected) return;

  const result = await window.dalton.resolveInstallPath(selected);

  if (!result?.ok) {
    setInstallStatus(
      result?.message || 'No se pudo usar esa carpeta de instalación.',
      config.launcherInstallPath
    );
    return;
  }

  await saveConfigPartial({ launcherInstallPath: result.path });
});

document.getElementById('mute-music').addEventListener('change', async (event) => {
  await saveConfigPartial({ muteBackgroundMusic: event.target.checked });
  updateMusicVolumeUi();
});

musicVolumeInput.addEventListener('input', (event) => {
  const volume = clampVolumePercent(event.target.value, 0);
  musicVolumeInput.value = String(volume);
  musicVolumeValue.textContent = `${volume}%`;
  window.daltonSounds?.refresh({
    ...getAudioSettings(),
    backgroundMusicVolume: volume
  });
});

musicVolumeInput.addEventListener('change', async (event) => {
  const volume = clampVolumePercent(event.target.value, 0);
  musicVolumeInput.value = String(volume);
  updateMusicVolumeUi(volume);
  await saveConfigPartial({ backgroundMusicVolume: volume });
});

document.getElementById('mute-sfx').addEventListener('change', async (event) => {
  await saveConfigPartial({ muteButtonSounds: event.target.checked });
});

btnInstallLauncher.addEventListener('click', async () => {
  setInstallStatus('INSTALANDO...', config.launcherInstallPath);

  const createDesktopShortcut = document.getElementById('create-desktop-shortcut').checked;

  setInstallOverlayProgress('Preparando instalación...', 10);

  try {
    setInstallOverlayProgress('Creando carpetas del launcher...', 40);

    const result = await window.dalton.installLauncher({
      installPath: config.launcherInstallPath,
      createDesktopShortcut
    });

    if (!result.ok) {
      hideInstallOverlay();
      setInstallStatus(result.message || 'ERROR DE INSTALACIÓN', config.launcherInstallPath);
      return;
    }

    setInstallOverlayProgress(
      createDesktopShortcut ? 'Acceso directo creado. Finalizando...' : 'Instalación completada.',
      100
    );

    await sleep(250);
    hideInstallOverlay();

    config = await window.dalton.getConfig();
    try {
      appVersion = formatDisplayVersion(await window.dalton.getVersion());
    } catch {
      appVersion = DEFAULT_APP_VERSION;
    }
    applyConfigToUi();
    syncDiscordPresence('idle');
    await transitionInstallToHome();
    await loadNotifications();
    startServerStatusPolling();
    startPlayStatePolling();
  } catch (error) {
    hideInstallOverlay();
    setInstallStatus(error.message || 'ERROR DE INSTALACIÓN', config.launcherInstallPath);
  }
});

btnStartDalton.addEventListener('click', async () => {
  if (btnStartDalton.disabled) {
    return;
  }

  const playStateBefore = await window.dalton.getFiveMPlayState();

  if (playStateBefore.inGame) {
    updateStartButton('running');
    return;
  }

  fivemRunningAtLaunchStart = playStateBefore.running;
  launchPending = true;
  fivemOpenedDuringConnect = false;
  updateStartButton('connecting');

  const result = await window.dalton.startDaltonLife();

  if (!result.ok) {
    launchPending = false;
    updateStartButton('idle');
    showLaunchError(result.message);
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
  window.dalton.openExternal(FIVEM_DOWNLOAD_URL);
});

document.getElementById('btn-check-updates')?.addEventListener('click', async () => {
  if (pendingUpdateVersion) {
    await window.dalton.installUpdate();
    return;
  }

  clearUpdateStatus();
  const result = await window.dalton.checkForUpdates({ manual: true });

  if (result?.skipped) {
    setUpdateStatus('Las actualizaciones solo están disponibles en la versión instalada.', 'info');
  }
});

btnUpdateRestart?.addEventListener('click', async () => {
  await window.dalton.installUpdate();
});

btnUpdateLater?.addEventListener('click', () => {
  hideUpdateOverlay();
  pendingUpdateBannerVisible = true;
  refreshPendingUpdateBadge();

  if (pendingUpdateVersion) {
    setUpdateStatus(
      `Actualización v${formatUpdateVersion(pendingUpdateVersion)} lista. Pulsa "Reiniciar para actualizar" para aplicarla.`,
      'info'
    );
  }
});

btnRetryUpdates?.addEventListener('click', async () => {
  clearUpdateStatus();
  hideUpdateToast();
  await window.dalton.checkForUpdates({ manual: true });
});

btnRelaunchLauncher?.addEventListener('click', async () => {
  await window.dalton.relaunchApp();
});

btnPendingUpdateRestart?.addEventListener('click', async () => {
  await window.dalton.installUpdate();
});

btnUpdateToastDismiss?.addEventListener('click', () => {
  hideUpdateToast();
});

btnUpdateToastRetry?.addEventListener('click', async () => {
  const handler = toastActionHandler;
  hideUpdateToast();

  if (handler === 'update-retry') {
    await window.dalton.checkForUpdates({ manual: true });
    return;
  }

  if (typeof handler === 'function') {
    handler();
  }
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
