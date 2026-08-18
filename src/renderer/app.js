const splashView = document.getElementById("splash-view");
const installView = document.getElementById("install-view");
const homeView = document.getElementById("home-view");
const settingsPanel = document.getElementById("settings-panel");
const notificationsPanel = document.getElementById("notifications-panel");
const updateOverlay = document.getElementById("update-overlay");
const updateTitle = document.getElementById("update-title");
const updateHint = document.getElementById("update-hint");
const updateSpinner = document.getElementById("update-spinner");
const updateProgressRow = document.getElementById("update-progress-row");
const installOverlay = document.getElementById("install-overlay");
const updateMessage = document.getElementById("update-message");
const updateSize = document.getElementById("update-size");
const updateNotes = document.getElementById("update-notes");
const installMessage = document.getElementById("install-message");
const installProgressBar = document.getElementById("install-progress-bar");
const installProgressValue = document.getElementById("install-progress-value");
const installStatusLabel = document.getElementById("install-status-label");
const installStatusPath = document.getElementById("install-status-path");
const footerVersion = document.getElementById("footer-version");
const installFooterVersion = document.getElementById("install-footer-version");
const progressBar = document.getElementById("progress-bar");
const progressValue = document.getElementById("progress-value");
const updateActionsRow = document.getElementById("update-actions-row");
const btnUpdateRestart = document.getElementById("btn-update-restart");
const btnUpdateLater = document.getElementById("btn-update-later");
const btnCheckUpdates = document.getElementById("btn-check-updates");
const updateStatus = document.getElementById("update-status");
const updateFeedbackActions = document.getElementById(
  "update-feedback-actions",
);
const btnRetryUpdates = document.getElementById("btn-retry-updates");
const btnRelaunchLauncher = document.getElementById("btn-relaunch-launcher");
const updateBadge = document.getElementById("update-badge");
const pendingUpdateBanner = document.getElementById("pending-update-banner");
const pendingUpdateBannerText = document.getElementById(
  "pending-update-banner-text",
);
const updateToast = document.getElementById("update-toast");
const updateToastMessage = document.getElementById("update-toast-message");
const btnUpdateToastRetry = document.getElementById("btn-update-toast-retry");
const btnUpdateToastDismiss = document.getElementById(
  "btn-update-toast-dismiss",
);
const btnPendingUpdateRestart = document.getElementById(
  "btn-pending-update-restart",
);
const DEFAULT_APP_VERSION = "0.0.0";
let appVersion = DEFAULT_APP_VERSION;
let updateInProgress = false;
let pendingUpdateVersion = null;
let pendingUpdateReleaseNotes = null;
let pendingUpdateBannerVisible = false;
let resolveStartupUpdateCheck = null;
let toastActionHandler = null;
const STARTUP_UPDATE_TIMEOUT_MS = 20000;
const FIVEM_DOWNLOAD_URL = "https://fivem.net/";
const SOCIAL_LINKS = [
  {
    url: "https://discord.gg/g2wYRtqphT",
    title: "Discord",
    label: "Discord",
    icon: "../assets/discord-icon.svg",
  },
  {
    url: "https://www.tiktok.com/@daltonliferp",
    title: "TikTok",
    label: "TikTok",
    icon: "../assets/tiktok-icon.svg",
  },
  {
    url: "https://www.instagram.com/daltonxlife/",
    title: "Instagram",
    label: "Instagram",
    icon: "../assets/instagram-icon.svg",
  },
  {
    url: "https://store.daltonxlife.org/",
    title: "Página web",
    label: "Página web",
    icon: "../assets/web-icon.svg",
  },
];
const launcherInstallPathInput = document.getElementById(
  "launcher-install-path",
);
const btnInstallLauncher = document.getElementById("btn-install-launcher");
const btnStartDalton = document.getElementById("btn-start-dalton");
const serverStatusDot = document.getElementById("server-status-dot");
const serverStatusText = document.getElementById("server-status-text");
const serverPlayers = document.getElementById("server-players");
const serverPing = document.getElementById("server-ping");
const serverHostname = document.getElementById("server-hostname");
const serverCard = document.getElementById("server-card");
const notificationsList = document.getElementById("notifications-list");
const notificationBadge = document.getElementById("notification-badge");
const musicVolumeInput = document.getElementById("music-volume");
const musicVolumeValue = document.getElementById("music-volume-value");

let config = null;
let serverStatusTimer = null;
let playStateTimer = null;
let launchPending = false;
let currentPlayState = "idle";
let fivemOpenedDuringConnect = false;
let lastServerOnlineState = null;
let hasDisplayedServerStatus = false;
let serverStatusRequestId = 0;
let serverStatusInFlight = null;
let notificationItems = [];
let consecutiveServerOfflineChecks = 0;
let lastDiscordPresenceState = null;
let fivemInstallWarningShown = false;
const SERVER_STATUS_INTERVAL_MS = 15000;
const SERVER_STATUS_INTERVAL_OFFLINE_MS = 30000;
const PLAY_STATE_INTERVAL_MS = 2000;
const SPLASH_EXIT_TIMEOUT_MS = 1000;
const SPLASH_DELAY_MS = 2700;
const SPLASH_DELAY_REDUCED_MS = 400;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getSplashDelayMs() {
  return prefersReducedMotion() ? SPLASH_DELAY_REDUCED_MS : SPLASH_DELAY_MS;
}

function waitForViewExitAnimation(animatedView, onFinish) {
  return new Promise((resolve) => {
    let finished = false;

    const finish = () => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeoutId);
      animatedView.removeEventListener("animationend", onAnimationEnd);
      onFinish();
      resolve();
    };

    const onAnimationEnd = (event) => {
      if (
        event.target !== animatedView ||
        event.animationName !== "splash-view-out"
      ) {
        return;
      }

      finish();
    };

    animatedView.addEventListener("animationend", onAnimationEnd);
    const timeoutMs = prefersReducedMotion() ? 50 : SPLASH_EXIT_TIMEOUT_MS;
    const timeoutId = setTimeout(finish, timeoutMs);
  });
}

function formatDisplayVersion(version, fallback = DEFAULT_APP_VERSION) {
  const raw = String(version || fallback)
    .trim()
    .replace(/^v/i, "");
  return raw || fallback;
}

function formatVersionLabel(version = appVersion) {
  return `VERSION v${formatDisplayVersion(version)} — EARLY ACCESS`;
}

function formatUpdateVersion(version) {
  return formatDisplayVersion(version || appVersion);
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
    return "";
  }

  const text =
    typeof notes === "string"
      ? notes
      : Array.isArray(notes)
        ? notes
            .map((entry) =>
              typeof entry === "string" ? entry : entry?.note || "",
            )
            .join("\n")
        : "";

  const trimmed = text.trim();

  if (!trimmed) {
    return "";
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
    updateNotes.textContent = "";
    updateNotes.classList.add("hidden");
    return;
  }

  updateNotes.textContent = formatted;
  updateNotes.classList.remove("hidden");
}

function setUpdateSize(transferred, total) {
  if (!updateSize) {
    return;
  }

  const safeTotal = Number(total) || 0;
  const safeTransferred = Number(transferred) || 0;

  if (safeTotal <= 0) {
    updateSize.textContent = "";
    updateSize.classList.add("hidden");
    return;
  }

  updateSize.textContent = `${formatBytes(safeTransferred)} / ${formatBytes(safeTotal)}`;
  updateSize.classList.remove("hidden");
}

function clearUpdateSize() {
  if (!updateSize) {
    return;
  }

  updateSize.textContent = "";
  updateSize.classList.add("hidden");
}

function refreshPendingUpdateBadge() {
  const showBadge = Boolean(pendingUpdateVersion) && !updateInProgress;
  updateBadge?.classList.toggle("hidden", !showBadge);
  updateBadge?.setAttribute("aria-hidden", showBadge ? "false" : "true");

  if (!pendingUpdateBanner || !pendingUpdateBannerText) {
    return;
  }

  const showBanner = showBadge && pendingUpdateBannerVisible;

  if (showBanner) {
    pendingUpdateBannerText.textContent = `Actualización v${formatUpdateVersion(pendingUpdateVersion)} lista. Reinicia para instalarla.`;
  }

  pendingUpdateBanner.classList.toggle("hidden", !showBanner);
  pendingUpdateBanner.setAttribute(
    "aria-hidden",
    showBanner ? "false" : "true",
  );
}

function showUpdateToast(
  message,
  { retry = false, actionLabel = "", onAction = null } = {},
) {
  if (!updateToast || !updateToastMessage) {
    return;
  }

  updateToastMessage.textContent = message;
  updateToast.className = "update-toast";
  updateToast.classList.remove("hidden");

  const hasCustomAction = Boolean(actionLabel && onAction);
  toastActionHandler = hasCustomAction
    ? onAction
    : retry
      ? "update-retry"
      : null;

  if (btnUpdateToastRetry) {
    btnUpdateToastRetry.textContent = hasCustomAction
      ? actionLabel
      : "Reintentar";
    btnUpdateToastRetry.classList.toggle("hidden", !retry && !hasCustomAction);
  }
}

function hideUpdateToast() {
  updateToast?.classList.add("hidden");
  btnUpdateToastRetry?.classList.add("hidden");
  toastActionHandler = null;
}

function isFiveMInstallError(message = "") {
  return /fivem no está instalado/i.test(message);
}

function showLaunchError(message) {
  const text = message?.trim() || "No se pudo abrir FiveM. Inténtalo de nuevo.";

  if (isFiveMInstallError(text)) {
    showUpdateToast(text, {
      actionLabel: "Descargar FiveM",
      onAction: () => window.dalton.openExternal(FIVEM_DOWNLOAD_URL),
    });
    return;
  }

  showUpdateToast(text);
}

function setUpdateStatus(message, type = "info") {
  if (!updateStatus) {
    return;
  }

  updateStatus.textContent = message;
  updateStatus.className = `update-status update-status--${type}`;
  updateStatus.classList.remove("hidden");
}

function setUpdateFeedbackActions({
  showRetry = false,
  showRelaunch = false,
} = {}) {
  const visible = showRetry || showRelaunch;
  updateFeedbackActions?.classList.toggle("hidden", !visible);
  btnRetryUpdates?.classList.toggle("hidden", !showRetry);
  btnRelaunchLauncher?.classList.toggle("hidden", !showRelaunch);
}

function showUpdateError(message, { manual = false, startup = false } = {}) {
  if (manual) {
    setUpdateStatus(message, "error");
    setUpdateFeedbackActions({ showRetry: true, showRelaunch: true });
  }

  if (manual || startup) {
    showUpdateToast(message, { retry: true });
  }
}

function clearUpdateStatus() {
  updateStatus?.classList.add("hidden");
  setUpdateFeedbackActions();
}

function refreshUpdateButton() {
  if (!btnCheckUpdates) {
    return;
  }

  btnCheckUpdates.textContent = pendingUpdateVersion
    ? "Reiniciar para actualizar"
    : "Buscar actualizaciones";
}

function setManualUpdateChecking(isChecking) {
  if (!btnCheckUpdates || pendingUpdateVersion) {
    return;
  }

  btnCheckUpdates.disabled = isChecking;
  btnCheckUpdates.textContent = isChecking
    ? "Buscando..."
    : "Buscar actualizaciones";
}

function isButtonSoundsMuted() {
  return Boolean(config?.muteButtonSounds);
}

function isBackgroundMusicMuted() {
  return Boolean(config?.muteBackgroundMusic);
}

function getBackgroundMusicVolume() {
  return window.daltonSounds?.clampVolumePercent?.(
    config?.backgroundMusicVolume,
    22,
  ) ?? 22;
}

function getAudioSettings() {
  return {
    muteButtonSounds: isButtonSoundsMuted(),
    muteBackgroundMusic: isBackgroundMusicMuted(),
    backgroundMusicVolume: getBackgroundMusicVolume(),
  };
}

function updateMusicVolumeUi(volume = getBackgroundMusicVolume()) {
  musicVolumeInput.value = String(volume);
  musicVolumeValue.textContent = `${volume}%`;
  musicVolumeInput.disabled = isBackgroundMusicMuted();
}

function refreshAudioSettings() {
  window.daltonSounds?.refresh(getAudioSettings());
}

function syncDiscordPresence(state = currentPlayState) {
  if (state === lastDiscordPresenceState) {
    return;
  }

  lastDiscordPresenceState = state;
  window.dalton?.syncDiscordPresence?.(state);
}

function renderSocialLinks() {
  const markup = SOCIAL_LINKS.map(
    (link) => `
      <button
        class="social-btn"
        type="button"
        data-social-url="${link.url}"
        title="${link.title}"
        aria-label="${link.label}"
      >
        <img src="${link.icon}" alt="" class="social-btn__icon" />
      </button>
    `,
  ).join("");

  document.querySelectorAll(".social-links").forEach((container) => {
    container.innerHTML = markup;
  });
}

function setupSidePanelKeyboard() {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (settingsPanel.classList.contains("is-open")) {
      toggleSettings(false);
    }

    if (notificationsPanel.classList.contains("is-open")) {
      toggleNotifications(false);
    }
  });
}

async function checkFiveMInstalledOnHome() {
  if (fivemInstallWarningShown || !window.dalton?.isFiveMInstalled) {
    return;
  }

  try {
    const installed = await window.dalton.isFiveMInstalled();

    if (!installed) {
      fivemInstallWarningShown = true;
      showLaunchError(
        "FiveM no está instalado. Instálalo desde fivem.net para poder jugar.",
      );
    }
  } catch {
    // ignore detection errors
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setInstallStatus(label, pathText = "") {
  installStatusLabel.textContent = label;
  installStatusPath.textContent = pathText
    ? `DIR: ${pathText.toUpperCase()}`
    : "";
}

function transitionFromSplash(targetView) {
  targetView.classList.add("view--active", "home-enter");
  splashView.classList.add("splash-exit");

  return waitForViewExitAnimation(splashView, () => {
    splashView.classList.remove("view--active", "splash-exit");
    targetView.classList.remove("home-enter");
  });
}

function transitionToHome() {
  return transitionFromSplash(homeView);
}

function transitionToInstall() {
  return transitionFromSplash(installView);
}

function transitionInstallToHome() {
  installView.classList.add("splash-exit");
  homeView.classList.add("view--active", "home-enter");

  return waitForViewExitAnimation(installView, () => {
    installView.classList.remove("view--active", "splash-exit");
    homeView.classList.remove("home-enter");
  });
}

function closeSidePanels() {
  toggleSettings(false);
  toggleNotifications(false);
}

function isBlockingOverlayActive() {
  if (updateInProgress) {
    return true;
  }

  const isVisible = (element) =>
    element && !element.classList.contains("hidden");

  return isVisible(updateOverlay) || isVisible(installOverlay);
}

function toggleSettings(open) {
  if (open && isBlockingOverlayActive()) {
    return;
  }

  if (open) {
    toggleNotifications(false);
  }

  settingsPanel.classList.toggle("is-open", open);
  settingsPanel.setAttribute("aria-hidden", open ? "false" : "true");
}

function toggleNotifications(open) {
  if (open && isBlockingOverlayActive()) {
    return;
  }

  if (open) {
    toggleSettings(false);
  }

  notificationsPanel.classList.toggle("is-open", open);
  notificationsPanel.setAttribute("aria-hidden", open ? "false" : "true");

  if (open) {
    markAllNotificationsRead();
  }
}

function getNotificationId(item) {
  return String(item?.id || item?.title || "");
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
    notificationBadge.classList.add("hidden");
    notificationBadge.setAttribute("aria-hidden", "true");
    notificationBadge.textContent = "0";
    return;
  }

  notificationBadge.classList.remove("hidden");
  notificationBadge.setAttribute("aria-hidden", "false");
  notificationBadge.textContent = count > 9 ? "9+" : String(count);
}

async function markAllNotificationsRead() {
  if (!notificationItems.length) {
    updateNotificationBadge();
    return;
  }

  const merged = [
    ...new Set([
      ...(config?.readNotificationIds || []).map(String),
      ...notificationItems.map(getNotificationId).filter(Boolean),
    ]),
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

function getPingLevel(ping) {
  if (ping == null || Number.isNaN(ping)) return "none";
  if (ping <= 80) return "good";
  if (ping <= 150) return "medium";
  return "bad";
}

function formatServerPlayersLine(status) {
  if (!status.online) {
    if (status.error) {
      const error = String(status.error).trim();
      if (/offline|no disponible/i.test(error)) {
        return "No disponible";
      }

      return error.charAt(0).toUpperCase() + error.slice(1);
    }

    return "Sin jugadores";
  }

  return `${status.clients} / ${status.maxClients || "—"} jugadores`;
}

function updateServerPing(ping) {
  if (!serverPing) return;

  if (ping == null || Number.isNaN(ping)) {
    serverPing.textContent = "—";
    serverPing.className = "server-card__ping server-card__ping--none";
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

  serverCard.classList.remove("server-card--online-flash");

  if (!launchPending) {
    serverCard.classList.remove("server-card--connecting");
  }

  serverStatusDot.className = "server-card__dot server-card__dot--checking";
  serverStatusText.textContent = "Verificando";
  serverPlayers.textContent = "—";

  if (initial) {
    updateServerPing(null);
  }
}

function triggerServerOnlineAnimation() {
  serverCard.classList.remove("server-card--online-flash");
  void serverCard.offsetWidth;
  serverCard.classList.add("server-card--online-flash");
}

function updateServerCardConnectingAnimation(isConnecting) {
  serverCard.classList.toggle("server-card--connecting", isConnecting);
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
    consecutiveServerOfflineChecks += 1;
    serverCard.classList.remove("server-card--online-flash");
    serverStatusDot.className = "server-card__dot server-card__dot--offline";
    serverStatusText.textContent = "Offline";
    serverHostname.textContent = "Dalton Life";
    serverPlayers.textContent = formatServerPlayersLine(status);
    updateServerPing(null);

    if (currentPlayState === "idle" && !launchPending) {
      updateStartButton("idle");
    }

    return;
  }

  consecutiveServerOfflineChecks = 0;

  if (wasOnline === false) {
    triggerServerOnlineAnimation();
  }

  serverStatusDot.className = "server-card__dot server-card__dot--online";
  serverStatusText.textContent = "En línea";
  serverHostname.textContent =
    String(status.hostname || "Dalton Life").trim() || "Dalton Life";
  serverPlayers.textContent = formatServerPlayersLine(status);
  updateServerPing(status.ping);

  if (currentPlayState === "idle" && !launchPending) {
    updateStartButton("idle");
  }
}

async function queryServerStatus() {
  if (!window.dalton?.getServerStatus) {
    return {
      online: false,
      error: "No se pudo consultar el servidor",
    };
  }

  const status = await window.dalton.getServerStatus();

  return (
    status || {
      online: false,
      error: "Servidor offline",
    }
  );
}

async function refreshServerStatusNow() {
  const ip = String(config?.serverIp || "").trim();

  if (!ip) {
    hasDisplayedServerStatus = true;
    lastServerOnlineState = false;
    serverStatusDot.className = "server-card__dot server-card__dot--offline";
    serverStatusText.textContent = "Servidor no configurado";
    serverPlayers.textContent = "—";
    updateServerPing(null);

    if (currentPlayState === "idle" && !launchPending) {
      updateStartButton("idle");
    }

    return;
  }

  const requestId = ++serverStatusRequestId;

  if (!launchPending && currentPlayState === "idle") {
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
      error: error?.message || "Error consultando servidor",
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

function getServerStatusIntervalMs() {
  return consecutiveServerOfflineChecks >= 3
    ? SERVER_STATUS_INTERVAL_OFFLINE_MS
    : SERVER_STATUS_INTERVAL_MS;
}

function startServerStatusPolling() {
  stopServerStatusPolling();

  const tick = async () => {
    await refreshServerStatus();
    serverStatusTimer = setTimeout(tick, getServerStatusIntervalMs());
  };

  tick();
}

function stopServerStatusPolling() {
  if (serverStatusTimer) {
    clearTimeout(serverStatusTimer);
    serverStatusTimer = null;
  }
}

function updateStartButton(state) {
  currentPlayState = state;
  btnStartDalton.classList.remove(
    "cta--running",
    "cta--connecting",
    "cta--offline",
  );

  if (state === "running") {
    btnStartDalton.disabled = true;
    btnStartDalton.classList.add("cta--running");
    btnStartDalton.textContent = "EN EJECUCIÓN";
    updateServerCardConnectingAnimation(false);
    syncDiscordPresence(state);
    return;
  }

  if (state === "connecting") {
    btnStartDalton.disabled = true;
    btnStartDalton.classList.add("cta--connecting");
    btnStartDalton.textContent = "CONECTANDO...";
    updateServerCardConnectingAnimation(true);
    syncDiscordPresence(state);
    return;
  }

  updateServerCardConnectingAnimation(false);

  if (hasDisplayedServerStatus && lastServerOnlineState === false) {
    btnStartDalton.disabled = true;
    btnStartDalton.classList.add("cta--offline");
    btnStartDalton.textContent = "SERVIDOR OFFLINE";
    syncDiscordPresence(state);
    return;
  }

  btnStartDalton.disabled = false;
  btnStartDalton.textContent = "INICIAR DALTON LIFE";
  syncDiscordPresence(state);
}

async function refreshPlayState() {
  try {
    const playState = await window.dalton.getFiveMPlayState();
    const previousState = currentPlayState;

    if (playState.inGame) {
      launchPending = false;
      updateStartButton("running");
      return;
    }

    if (launchPending) {
      if (playState.running) {
        fivemOpenedDuringConnect = true;
      }

      if (fivemOpenedDuringConnect && !playState.running) {
        launchPending = false;
        fivemOpenedDuringConnect = false;
        updateStartButton("idle");
        showLaunchError(
          "FiveM se cerró antes de conectar. Inténtalo de nuevo.",
        );
        refreshServerStatus();
        return;
      }

      updateStartButton("connecting");
      return;
    }

    if (previousState === "running" || previousState === "connecting") {
      launchPending = false;
      fivemOpenedDuringConnect = false;
    }

    updateStartButton("idle");

    if (previousState !== "idle") {
      refreshServerStatus();
    }
  } catch {
    if (!launchPending) {
      updateStartButton("idle");
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
  currentPlayState = "idle";
  updateStartButton("idle");
  updateServerCardConnectingAnimation(false);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNotifications(items = notificationItems) {
  if (!notificationsList) return;

  if (!items.length) {
    notificationsList.innerHTML =
      '<p class="news-block__empty">No hay notificaciones por ahora.</p>';
    updateNotificationBadge();
    return;
  }

  const read = new Set((config?.readNotificationIds || []).map(String));

  notificationsList.innerHTML = items
    .map((item) => {
      const id = getNotificationId(item);
      const isUnread = id && !read.has(id);
      const link = item.link
        ? `<button type="button" class="news-item__link" data-social-url="${escapeHtml(item.link)}">${escapeHtml(item.linkLabel || "Ver más")}</button>`
        : "";

      return `
        <article class="news-item${isUnread ? " news-item--unread" : ""}">
          <span class="news-item__tag">${escapeHtml(item.tag || "AVISO")}</span>
          <h4 class="news-item__title">${escapeHtml(item.title || "")}</h4>
          <p class="news-item__body">${escapeHtml(item.body || "")}</p>
          ${link}
        </article>
      `;
    })
    .join("");

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
  if (!config) {
    return;
  }
  const versionLabel = formatVersionLabel(appVersion);
  footerVersion.textContent = versionLabel;
  installFooterVersion.textContent = versionLabel;
  launcherInstallPathInput.value = String(config.launcherInstallPath || "").trim();
  document.getElementById("mute-music").checked = config.muteBackgroundMusic;
  document.getElementById("mute-sfx").checked = config.muteButtonSounds;
  updateMusicVolumeUi(getBackgroundMusicVolume());
  setInstallStatus("LISTO PARA CONFIGURAR", config.launcherInstallPath);

  if (homeView.classList.contains("view--active")) {
    refreshServerStatus();
    updateNotificationBadge();
  }

  refreshAudioSettings();
  syncDiscordPresence(currentPlayState);
}

function showBusyOverlay({ title, message, hint = "No cierres el launcher." }) {
  if (updateInProgress) {
    return;
  }

  closeSidePanels();
  updateTitle.textContent = title;
  updateMessage.textContent = message;
  updateHint.textContent = hint;
  updateProgressRow.classList.add("hidden");
  updateSpinner.classList.remove("hidden");
  updateSpinner.setAttribute("aria-hidden", "false");
  updateOverlay.classList.remove("hidden");
  updateOverlay.setAttribute("aria-hidden", "false");
}

function hideBusyOverlay() {
  if (updateInProgress) {
    return;
  }

  updateOverlay.classList.add("hidden");
  updateOverlay.setAttribute("aria-hidden", "true");
  updateSpinner.classList.add("hidden");
  updateSpinner.setAttribute("aria-hidden", "true");
  updateProgressRow.classList.remove("hidden");
  updateTitle.textContent = "ACTUALIZANDO";
  updateHint.textContent = "No cierres el launcher.";
}

function showUpdateOverlay({
  title,
  message,
  hint = "No cierres el launcher.",
  mode = "progress",
}) {
  updateInProgress = true;
  closeSidePanels();
  updateTitle.textContent = title;
  updateMessage.textContent = message;
  updateHint.textContent = hint;
  updateActionsRow?.classList.toggle("hidden", mode !== "ready");

  if (mode === "spinner") {
    updateProgressRow.classList.add("hidden");
    updateSpinner.classList.remove("hidden");
    updateSpinner.setAttribute("aria-hidden", "false");
  } else if (mode === "ready") {
    updateSpinner.classList.add("hidden");
    updateSpinner.setAttribute("aria-hidden", "true");
    updateProgressRow.classList.add("hidden");
  } else {
    updateSpinner.classList.add("hidden");
    updateSpinner.setAttribute("aria-hidden", "true");
    updateProgressRow.classList.remove("hidden");
  }

  updateOverlay.classList.remove("hidden");
  updateOverlay.setAttribute("aria-hidden", "false");
}

function hideUpdateOverlay() {
  updateInProgress = false;
  updateOverlay.classList.add("hidden");
  updateOverlay.setAttribute("aria-hidden", "true");
  updateSpinner.classList.add("hidden");
  updateSpinner.setAttribute("aria-hidden", "true");
  updateProgressRow.classList.remove("hidden");
  updateActionsRow?.classList.add("hidden");
  updateTitle.textContent = "ACTUALIZANDO";
  updateMessage.textContent = "Descargando componentes...";
  updateHint.textContent = "No cierres el launcher.";
  progressBar.style.width = "0%";
  progressValue.textContent = "0%";
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
    title: "LISTO PARA REINICIAR",
    message: `La versión v${formatUpdateVersion(version)} está lista para instalar.`,
    mode: "ready",
    hint: "Debes reiniciar el launcher para aplicar la actualización. No basta con recargar la ventana.",
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
  if (!window.dalton?.onUpdaterEvent) {
    return () => {};
  }

  return window.dalton.onUpdaterEvent((event) => {
    switch (event.type) {
      case "checking":
        if (event.manual) {
          clearUpdateStatus();
          hideUpdateToast();
          setManualUpdateChecking(true);
        }
        break;
      case "available":
        setManualUpdateChecking(false);
        hideUpdateToast();
        setUpdateFeedbackActions();
        resolveStartupUpdateCheckIfNeeded();
        pendingUpdateReleaseNotes = event.releaseNotes || null;
        setUpdateNotes(null, false);
        clearUpdateSize();
        showUpdateOverlay({
          title: "ACTUALIZANDO",
          message: `Descargando v${formatUpdateVersion(event.version)}...`,
          mode: "progress",
        });
        setUpdateOverlayProgress(0, 0, 0);
        break;
      case "progress":
        setUpdateOverlayProgress(event.percent, event.transferred, event.total);
        break;
      case "downloaded":
        setManualUpdateChecking(false);
        showUpdateReady(
          event.version,
          event.releaseNotes || pendingUpdateReleaseNotes,
        );
        break;
      case "not-available":
        setManualUpdateChecking(false);
        resolveStartupUpdateCheckIfNeeded();
        hideUpdateOverlay();
        setUpdateFeedbackActions();
        if (event.manual) {
          setUpdateStatus("Ya tienes la última versión.", "success");
        }
        break;
      case "error":
        setManualUpdateChecking(false);
        resolveStartupUpdateCheckIfNeeded();
        hideUpdateOverlay();
        showUpdateError(
          event.message || "No se pudo comprobar actualizaciones.",
          {
            manual: Boolean(event.manual),
            startup: Boolean(event.startup),
          },
        );
        break;
      default:
        break;
    }
  });
}

function setInstallOverlayProgress(message, percent) {
  const safePercent = Math.min(100, Math.max(0, Number(percent) || 0));

  closeSidePanels();
  installOverlay.classList.remove("hidden");
  installOverlay.setAttribute("aria-hidden", "false");
  installMessage.textContent = message;
  installProgressBar.style.width = `${safePercent}%`;
  installProgressValue.textContent = `${safePercent}%`;
}

function hideInstallOverlay() {
  installOverlay.classList.add("hidden");
  installOverlay.setAttribute("aria-hidden", "true");
  installProgressBar.style.width = "0%";
  installProgressValue.textContent = "0%";
}

async function saveConfigPartial(partial) {
  config = await window.dalton.setConfig(partial);
  applyConfigToUi();
}

async function bootstrap() {
  if (!window.dalton?.getConfig) {
    throw new Error("No se pudo inicializar el launcher.");
  }

  const unsubscribeUpdater = setupUpdaterListeners();
  window.addEventListener("beforeunload", unsubscribeUpdater);
  renderSocialLinks();
  setupSidePanelKeyboard();

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
  syncDiscordPresence("launcher");

  const startupTasks = [sleep(getSplashDelayMs())];

  if (config?.packaged && config.launcherInstalled) {
    startupTasks.push(runStartupUpdateCheck());
  }

  await Promise.all(startupTasks);

  if (config.launcherInstalled) {
    await transitionToHome();
    await checkFiveMInstalledOnHome();
    syncDiscordPresence("idle");
    startServerStatusPolling();
    startPlayStatePolling();
    await loadNotifications();
    return;
  }

  stopServerStatusPolling();
  stopPlayStatePolling();
  syncDiscordPresence("launcher");
  await transitionToInstall();
  applyConfigToUi();
}

document.getElementById("btn-minimize").addEventListener("click", () => {
  window.dalton.minimizeWindow();
});

document.getElementById("btn-close").addEventListener("click", () => {
  window.dalton.closeWindow();
});

document
  .getElementById("btn-minimize-install")
  .addEventListener("click", () => {
    window.dalton.minimizeWindow();
  });

document.getElementById("btn-close-install").addEventListener("click", () => {
  window.dalton.closeWindow();
});

document.getElementById("btn-notifications").addEventListener("click", () => {
  const isOpen = notificationsPanel.classList.contains("is-open");
  toggleNotifications(!isOpen);
});

document
  .getElementById("btn-close-notifications")
  .addEventListener("click", () => {
    toggleNotifications(false);
  });

document.getElementById("btn-settings").addEventListener("click", () => {
  toggleSettings(true);
});

document
  .getElementById("btn-settings-install")
  .addEventListener("click", () => {
    toggleSettings(true);
  });

document.getElementById("btn-close-settings").addEventListener("click", () => {
  toggleSettings(false);
});

document
  .getElementById("btn-browse-launcher")
  .addEventListener("click", async () => {
    const selected = await window.dalton.selectFolder();
    if (!selected) return;

    const result = await window.dalton.resolveInstallPath(selected);

    if (!result?.ok) {
      setInstallStatus(
        result?.message || "No se pudo usar esa carpeta de datos.",
        config.launcherInstallPath,
      );
      return;
    }

    await saveConfigPartial({ launcherInstallPath: result.path });
  });

document
  .getElementById("mute-music")
  .addEventListener("change", async (event) => {
    await saveConfigPartial({ muteBackgroundMusic: event.target.checked });
    updateMusicVolumeUi();
  });

musicVolumeInput.addEventListener("input", (event) => {
  const volume =
    window.daltonSounds?.clampVolumePercent?.(event.target.value, 0) ?? 0;
  musicVolumeInput.value = String(volume);
  musicVolumeValue.textContent = `${volume}%`;
  window.daltonSounds?.refresh({
    ...getAudioSettings(),
    backgroundMusicVolume: volume,
  });
});

musicVolumeInput.addEventListener("change", async (event) => {
  const volume =
    window.daltonSounds?.clampVolumePercent?.(event.target.value, 0) ?? 0;
  musicVolumeInput.value = String(volume);
  updateMusicVolumeUi(volume);
  await saveConfigPartial({ backgroundMusicVolume: volume });
});

document
  .getElementById("mute-sfx")
  .addEventListener("change", async (event) => {
    await saveConfigPartial({ muteButtonSounds: event.target.checked });
  });

btnInstallLauncher.addEventListener("click", async () => {
  if (btnInstallLauncher.disabled) {
    return;
  }

  btnInstallLauncher.disabled = true;
  setInstallStatus("CONFIGURANDO...", config.launcherInstallPath);

  const createDesktopShortcut = document.getElementById(
    "create-desktop-shortcut",
  ).checked;

  setInstallOverlayProgress("Preparando configuración...", 10);

  try {
    setInstallOverlayProgress("Guardando configuración...", 40);

    const result = await window.dalton.installLauncher({
      installPath: config.launcherInstallPath,
      createDesktopShortcut,
    });

    if (!result.ok) {
      hideInstallOverlay();
      setInstallStatus(
        result.message || "ERROR DE CONFIGURACIÓN",
        config.launcherInstallPath,
      );
      return;
    }

    setInstallOverlayProgress(
      createDesktopShortcut
        ? "Acceso directo creado. Finalizando..."
        : "Configuración completada.",
      100,
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
    syncDiscordPresence("idle");
    await transitionInstallToHome();
    await checkFiveMInstalledOnHome();
    await loadNotifications();
    startServerStatusPolling();
    startPlayStatePolling();
  } catch (error) {
    hideInstallOverlay();
    setInstallStatus(
      error.message || "ERROR DE CONFIGURACIÓN",
      config.launcherInstallPath,
    );
  } finally {
    btnInstallLauncher.disabled = false;
  }
});

btnStartDalton.addEventListener("click", async () => {
  if (btnStartDalton.disabled) {
    return;
  }

  const playStateBefore = await window.dalton.getFiveMPlayState();

  if (playStateBefore.inGame) {
    updateStartButton("running");
    return;
  }

  launchPending = true;
  fivemOpenedDuringConnect = playStateBefore.running;
  updateStartButton("connecting");

  const result = await window.dalton.startDaltonLife();

  if (!result.ok) {
    launchPending = false;
    updateStartButton("idle");
    showLaunchError(result.message);
    return;
  }

  await refreshPlayState();
});

document.addEventListener("click", (event) => {
  const socialButton = event.target.closest("[data-social-url]");

  if (!socialButton) {
    return;
  }

  const url = socialButton.getAttribute("data-social-url");

  if (url) {
    window.dalton.openExternal(url);
  }
});

serverCard.addEventListener("animationend", (event) => {
  if (event.animationName === "server-card-online-in") {
    serverCard.classList.remove("server-card--online-flash");
  }
});

document.getElementById("btn-open-fivem-site").addEventListener("click", () => {
  window.dalton.openExternal(FIVEM_DOWNLOAD_URL);
});

document
  .getElementById("btn-check-updates")
  ?.addEventListener("click", async () => {
    if (pendingUpdateVersion) {
      await window.dalton.installUpdate();
      return;
    }

    clearUpdateStatus();
    const result = await window.dalton.checkForUpdates({ manual: true });

    if (result?.skipped) {
      setUpdateStatus(
        "Las actualizaciones solo están disponibles en la versión instalada.",
        "info",
      );
    }
  });

btnUpdateRestart?.addEventListener("click", async () => {
  await window.dalton.installUpdate();
});

btnUpdateLater?.addEventListener("click", () => {
  hideUpdateOverlay();
  pendingUpdateBannerVisible = true;
  refreshPendingUpdateBadge();

  if (pendingUpdateVersion) {
    setUpdateStatus(
      `Actualización v${formatUpdateVersion(pendingUpdateVersion)} lista. Pulsa "Reiniciar para actualizar" para aplicarla.`,
      "info",
    );
  }
});

btnRetryUpdates?.addEventListener("click", async () => {
  clearUpdateStatus();
  hideUpdateToast();
  await window.dalton.checkForUpdates({ manual: true });
});

btnRelaunchLauncher?.addEventListener("click", async () => {
  await window.dalton.relaunchApp();
});

btnPendingUpdateRestart?.addEventListener("click", async () => {
  await window.dalton.installUpdate();
});

btnUpdateToastDismiss?.addEventListener("click", () => {
  hideUpdateToast();
});

btnUpdateToastRetry?.addEventListener("click", async () => {
  const handler = toastActionHandler;
  hideUpdateToast();

  if (handler === "update-retry") {
    await window.dalton.checkForUpdates({ manual: true });
    return;
  }

  if (typeof handler === "function") {
    handler();
  }
});

document
  .getElementById("btn-clear-fivem-cache")
  .addEventListener("click", async () => {
    const confirmed = await window.dalton.confirmClearFiveMCache();
    if (!confirmed) {
      return;
    }

    showBusyOverlay({
      title: "BORRANDO CACHÉ",
      message: "Eliminando carpetas de FiveM...",
      hint: "Esto puede tardar unos segundos.",
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
        message: error.message || "Error inesperado al borrar la caché.",
      });
    }
  });

bootstrap().catch(async (error) => {
  console.error("[bootstrap]", error);
  splashView.classList.remove("view--active", "splash-exit");
  installView.classList.add("view--active");

  try {
    if (window.dalton?.getConfig) {
      config = await window.dalton.getConfig();
      applyConfigToUi();
    }
  } catch {
    // ignore fallback config errors
  }
});
