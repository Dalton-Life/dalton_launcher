function formatCountdown(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = String(Math.floor(safe / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const TILE_WIDTH = 128;
const TILE_GAP = 8;
const TILE_STEP = TILE_WIDTH + TILE_GAP;
const REEL_PADDING = 8;

const crateCard = document.getElementById("crate-card");
const crateState = document.getElementById("crate-state");
const crateTitle = document.getElementById("crate-title");
const crateHint = document.getElementById("crate-hint");
const btnOpenCrate = document.getElementById("btn-open-crate");
const crateOverlay = document.getElementById("crate-overlay");
const crateReel = document.getElementById("crate-reel");
const crateReelTrack = document.getElementById("crate-reel-track");
const cratePrize = document.getElementById("crate-prize");
const cratePrizeImg = document.getElementById("crate-prize-img");
const cratePrizeRarity = document.getElementById("crate-prize-rarity");
const cratePrizeLabel = document.getElementById("crate-prize-label");
const cratePrizeCode = document.getElementById("crate-prize-code");
const cratePrizeCodeRow = document.getElementById("crate-prize-code-row");
const btnCopyCrateCode = document.getElementById("btn-copy-crate-code");
const crateOverlayHint = document.getElementById("crate-overlay-hint");
const crateOverlayCard = document.getElementById("crate-overlay-card");
const btnCloseCrateOverlay = document.getElementById("btn-close-crate-overlay");

let crateStatus = null;
let crateCountdownTimer = null;
let crateOpening = false;
let reelAnimation = null;
let reelTickRaf = 0;
let overlayAnimTimer = null;
let copyCodeResetTimer = null;
const OVERLAY_ANIM_MS = 280;
const COPY_LABEL = "Copiar";

function setCrateOverlayOpen(open) {
  if (!crateOverlay) {
    return;
  }

  window.clearTimeout(overlayAnimTimer);

  if (open) {
    crateOverlay.classList.remove("hidden", "is-closing");
    crateOverlay.setAttribute("aria-hidden", "false");

    if (prefersReducedMotion()) {
      crateOverlay.classList.add("is-open");
      return;
    }

    crateOverlay.offsetWidth;
    crateOverlay.classList.add("is-open");
    return;
  }

  crateOverlay.setAttribute("aria-hidden", "true");
  crateOverlay.classList.remove("is-open");
  crateOverlay.classList.add("is-closing");

  const finishClose = () => {
    crateOverlay.classList.add("hidden");
    crateOverlay.classList.remove("is-closing", "is-open");
  };

  if (prefersReducedMotion()) {
    finishClose();
    return;
  }

  overlayAnimTimer = window.setTimeout(finishClose, OVERLAY_ANIM_MS);
}

function crateImageBase() {
  return String(crateStatus?.imageBase || "").replace(/\/$/, "");
}

function itemImageUrl(item) {
  const origin = crateImageBase();
  const raw = String(item?.image || item?.item || "").trim();
  const name = raw.replace(/\.(png|webp|jpe?g)$/i, "");

  if (!origin || !name || !/^[A-Za-z0-9_-]+$/.test(name)) {
    return "";
  }

  return `${origin}/${encodeURIComponent(name)}`;
}

function bindImageFallback(img) {
  img.addEventListener("error", () => {
    img.classList.add("hidden");
  });
}

function redeemCommand(code) {
  return code ? `/reclamarcaja ${code}` : "";
}

function resetCopyButtonLabel() {
  window.clearTimeout(copyCodeResetTimer);
  if (btnCopyCrateCode) {
    btnCopyCrateCode.textContent = COPY_LABEL;
  }
}

async function copyText(value) {
  if (!value) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.append(input);
    input.select();
    const ok = document.execCommand("copy");
    input.remove();
    return ok;
  }
}

async function copyCrateCode() {
  const command = cratePrizeCode?.textContent?.trim() || "";
  if (!command || btnCopyCrateCode?.disabled) {
    return;
  }

  const copied = await copyText(command);
  if (!btnCopyCrateCode) {
    return;
  }

  btnCopyCrateCode.textContent = copied ? "Copiado" : "Error";
  window.clearTimeout(copyCodeResetTimer);
  copyCodeResetTimer = window.setTimeout(() => {
    btnCopyCrateCode.textContent = COPY_LABEL;
  }, 1800);
}

function applyPrizeToOverlay(prize, redeemCode) {
  const rarity = String(prize?.rarity || "common");
  const command = redeemCommand(redeemCode);
  cratePrizeRarity.textContent = prize?.rarityLabel || rarity;
  cratePrizeLabel.textContent = prize?.label || "Premio";
  cratePrizeCode.textContent = command;
  cratePrizeCodeRow?.classList.toggle("hidden", !command);
  resetCopyButtonLabel();
  crateOverlayCard.dataset.rarity = rarity;
  cratePrize.style.setProperty("--crate-rarity", prize?.color || "#b0c3d9");

  const imageUrl = itemImageUrl(prize);
  if (cratePrizeImg && imageUrl) {
    cratePrizeImg.classList.remove("hidden");
    cratePrizeImg.alt = prize?.label || "";
    cratePrizeImg.src = imageUrl;
  } else if (cratePrizeImg) {
    cratePrizeImg.removeAttribute("src");
    cratePrizeImg.alt = "";
    cratePrizeImg.classList.add("hidden");
  }
}

function renderCrateCard() {
  if (!crateStatus?.ok) {
    crateState.textContent = "OFFLINE";
    crateHint.textContent =
      crateStatus?.error || "El server tiene que estar online para abrir la caja.";
    btnOpenCrate.disabled = true;
    btnOpenCrate.textContent = "ABRIR CAJA";
    crateCard?.classList.remove("crate-card--ready");
    return;
  }

  if (crateStatus.crate?.label) {
    crateTitle.textContent = crateStatus.crate.label;
  }

  if (crateStatus.canOpen) {
    crateState.textContent = "DISPONIBLE";
    crateHint.textContent = "Canjea usando el codigo al entrar a Dalton Life.";
    btnOpenCrate.disabled = crateOpening;
    btnOpenCrate.textContent = "ABRIR CAJA";
    crateCard?.classList.add("crate-card--ready");
    return;
  }

  crateCard?.classList.remove("crate-card--ready");
  btnOpenCrate.disabled = true;

  if (crateStatus.prize?.label) {
    crateState.textContent = crateStatus.claimed ? "ENTREGADA" : "PENDIENTE";
    crateHint.textContent = crateStatus.claimed
      ? `Hoy te tocó ${crateStatus.prize.label}. Volvé mañana.`
      : `Hoy te tocó ${crateStatus.prize.label}. Entrá al city para recibirlo.`;
  } else {
    crateState.textContent = "ABIERTA";
    crateHint.textContent = "Ya abriste la caja de hoy. Volvé mañana.";
  }

  const remaining = Number(crateStatus.nextOpenIn) || 0;
  btnOpenCrate.textContent =
    remaining > 0 ? `PRÓXIMA ${formatCountdown(remaining)}` : "ABRIR CAJA";
}

function startCrateCountdown() {
  if (crateCountdownTimer) {
    clearInterval(crateCountdownTimer);
    crateCountdownTimer = null;
  }

  if (!crateStatus?.ok || crateStatus.canOpen) {
    return;
  }

  crateCountdownTimer = setInterval(() => {
    if (!crateStatus || crateStatus.canOpen) {
      return;
    }

    crateStatus.nextOpenIn = Math.max(0, (Number(crateStatus.nextOpenIn) || 0) - 1);
    renderCrateCard();

    if (crateStatus.nextOpenIn <= 0) {
      refreshCrateStatus();
    }
  }, 1000);
}

async function refreshCrateStatus() {
  if (!window.dalton?.getCrateStatus) {
    crateStatus = { ok: false, error: "Cajas no disponibles" };
    renderCrateCard();
    return;
  }

  crateStatus = await window.dalton.getCrateStatus();
  renderCrateCard();
  startCrateCountdown();
}

function shuffle(list) {
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function crateItemPool(winner) {
  const pool = Array.isArray(crateStatus?.items) ? crateStatus.items.filter(Boolean) : [];

  if (pool.length > 0) {
    return pool;
  }

  return winner ? [winner] : [{ label: "???", rarity: "common", color: "#b0c3d9" }];
}

function createReelTile(item, isWinner = false) {
  const tile = document.createElement("div");
  tile.className = `crate-reel__item${isWinner ? " is-winner" : ""}`;
  tile.style.setProperty("--crate-rarity", item?.color || "#b0c3d9");

  const rarity = document.createElement("span");
  rarity.className = "crate-reel__rarity";
  rarity.textContent = item?.rarityLabel || item?.rarity || "";

  const imageUrl = itemImageUrl(item);
  if (imageUrl) {
    const img = document.createElement("img");
    img.className = "crate-reel__img";
    img.alt = "";
    img.decoding = "async";
    img.src = imageUrl;
    bindImageFallback(img);
    tile.append(rarity, img);
  } else {
    tile.append(rarity);
  }

  const name = document.createElement("span");
  name.className = "crate-reel__name";
  name.textContent = item?.label || "Premio";

  tile.append(name);
  return tile;
}

function buildReel(winner) {
  const pool = crateItemPool(winner);
  const tiles = [];

  for (let loop = 0; loop < 18; loop += 1) {
    tiles.push(...shuffle(pool));
  }

  const winIndex = Math.min(tiles.length - 8, 72 + Math.floor(Math.random() * 12));
  tiles[winIndex] = winner;

  crateReelTrack.replaceChildren();
  tiles.forEach((item, index) => {
    crateReelTrack.append(createReelTile(item, index === winIndex));
  });
  crateReelTrack.style.transform = "translateX(0px)";

  return winIndex;
}

function reelTargetX(winIndex) {
  const windowWidth = crateReel?.querySelector(".crate-reel__window")?.clientWidth || 720;
  const center = windowWidth / 2;
  const tileCenter = REEL_PADDING + winIndex * TILE_STEP + TILE_WIDTH / 2;
  const jitter = (Math.random() - 0.5) * 18;
  return center - tileCenter + jitter;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

const OPENING_DELAY_MS = 2000;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, Math.max(0, ms));
  });
}

function setCrateOpeningUi(opening) {
  crateOverlayCard?.classList.toggle("is-opening", opening);
}

function setCrateCloseEnabled(enabled) {
  if (!btnCloseCrateOverlay) {
    return;
  }

  btnCloseCrateOverlay.disabled = !enabled;
}

function waitForReelImages(timeoutMs) {
  const images = [...(crateReelTrack?.querySelectorAll("img.crate-reel__img") || [])];
  if (images.length === 0 || timeoutMs <= 0) {
    return Promise.resolve();
  }

  const pending = images.map((img) => {
    if (img.complete) {
      return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    }

    return new Promise((resolve) => {
      const finish = () => resolve();
      img.addEventListener("load", finish, { once: true });
      img.addEventListener("error", finish, { once: true });
    });
  });

  return Promise.race([Promise.all(pending), wait(timeoutMs)]);
}

function playReelTick() {
  window.daltonSounds?.play?.("hover");
}

function stopReelTickWatch() {
  if (reelTickRaf) {
    cancelAnimationFrame(reelTickRaf);
    reelTickRaf = 0;
  }
}

function currentReelX(endX) {
  if (!reelAnimation?.effect) {
    return 0;
  }

  const progress = reelAnimation.effect.getComputedTiming().progress;
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return endX * progress;
}

function tileIndexUnderMarker(endX) {
  const windowWidth = crateReel?.querySelector(".crate-reel__window")?.clientWidth || 720;
  const markerX = windowWidth / 2;
  return Math.floor((markerX - REEL_PADDING - currentReelX(endX)) / TILE_STEP);
}

function startReelTickWatch(endX) {
  stopReelTickWatch();

  let lastIndex = tileIndexUnderMarker(endX);

  const watchTiles = () => {
    if (!reelAnimation || reelAnimation.playState === "finished" || reelAnimation.playState === "idle") {
      reelTickRaf = 0;
      return;
    }

    const index = tileIndexUnderMarker(endX);
    if (Number.isInteger(index) && index >= 0 && index !== lastIndex) {
      lastIndex = index;
      playReelTick();
    }

    reelTickRaf = requestAnimationFrame(watchTiles);
  };

  reelTickRaf = requestAnimationFrame(watchTiles);
}

function spinReelTo(winIndex) {
  const endX = reelTargetX(winIndex);

  if (prefersReducedMotion()) {
    crateReelTrack.style.transform = `translateX(${endX}px)`;
    return Promise.resolve();
  }

  stopReelTickWatch();
  reelAnimation?.cancel();
  reelAnimation = crateReelTrack.animate(
    [
      { transform: "translateX(0px)" },
      { transform: `translateX(${endX}px)` }
    ],
    {
      duration: 16000,
      easing: "cubic-bezier(0.05, 0.88, 0.0, 1)",
      fill: "forwards"
    }
  );

  startReelTickWatch(endX);

  return reelAnimation.finished.catch(() => {}).finally(() => {
    stopReelTickWatch();
  });
}

function showOpenedPrize(result) {
  applyPrizeToOverlay(result.prize, result.redeemCode);
  cratePrize.classList.remove("hidden");
  crateOverlayHint.textContent = result.claimed
    ? "Premio entregado in-game."
    : "Entrá a Dalton Life y usá el comando para reclamarlo.";
}

async function openDailyCrate() {
  if (crateOpening || !crateStatus?.canOpen || !window.dalton?.openCrate) {
    return;
  }

  crateOpening = true;
  renderCrateCard();
  setCrateOverlayOpen(true);
  setCrateOpeningUi(true);
  setCrateCloseEnabled(false);
  cratePrize.classList.add("hidden");
  crateOverlayCard.dataset.rarity = "";
  crateOverlayHint.textContent = "Abriendo caja...";
  crateReelTrack.replaceChildren();
  crateReelTrack.style.transform = "translateX(0px)";

  try {
    const result = await window.dalton.openCrate();

    if (!result?.ok || !result.prize) {
      setCrateOpeningUi(false);
      crateOverlayHint.textContent = result?.error || "No se pudo abrir la caja.";
      crateStatus = result?.ok ? result : crateStatus;
      renderCrateCard();
      return;
    }

    if (Array.isArray(result.items)) {
      crateStatus = {
        ...crateStatus,
        items: result.items,
        imageBase: result.imageBase || crateStatus.imageBase
      };
    }

    const winIndex = buildReel(result.prize);
    await Promise.all([wait(OPENING_DELAY_MS), waitForReelImages(OPENING_DELAY_MS)]);

    setCrateOpeningUi(false);
    crateOverlayHint.textContent = "Girando...";
    await nextFrame();
    await nextFrame();
    await spinReelTo(winIndex);

    crateStatus = result;
    showOpenedPrize(result);
    renderCrateCard();
    startCrateCountdown();
  } catch (error) {
    setCrateOpeningUi(false);
    crateOverlayHint.textContent = error?.message || "No se pudo abrir la caja.";
  } finally {
    crateOpening = false;
    setCrateCloseEnabled(true);
    renderCrateCard();
  }
}

let crateBound = false;

function bindCrateUi() {
  if (crateBound) {
    return;
  }

  crateBound = true;

  if (cratePrizeImg) {
    bindImageFallback(cratePrizeImg);
  }

  btnCopyCrateCode?.addEventListener("click", () => {
    copyCrateCode();
  });

  window.daltonSounds?.attachButtonSounds?.(cratePrizeCodeRow || document);

  btnOpenCrate?.addEventListener("click", () => {
    openDailyCrate();
  });

  btnCloseCrateOverlay?.addEventListener("click", () => {
    if (crateOpening || btnCloseCrateOverlay.disabled) {
      return;
    }

    setCrateOverlayOpen(false);
  });
}

window.daltonCrates = {
  init() {
    bindCrateUi();
    return refreshCrateStatus();
  },
  refresh: refreshCrateStatus,
  isOpen() {
    return Boolean(crateOverlay && !crateOverlay.classList.contains("hidden"));
  }
};
