const SOUND_PATHS = {
  hover: 'assets/sounds/hoversound.mp3',
  click: 'assets/sounds/clicksound.mp3',
  background: 'assets/song/bg-music.mp3'
};

const audioCache = {
  hover: new Audio(SOUND_PATHS.hover),
  click: new Audio(SOUND_PATHS.click),
  background: new Audio(SOUND_PATHS.background)
};

audioCache.hover.volume = 0.35;
audioCache.click.volume = 0.55;
audioCache.background.volume = 0.22;
audioCache.background.loop = true;

let buttonSoundsMuted = false;
let backgroundMusicMuted = false;
let backgroundMusicVolume = 0.22;

function clampVolumePercent(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function playButtonSound(type) {
  if (buttonSoundsMuted) return;

  const audio = audioCache[type];
  if (!audio) return;

  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function syncBackgroundMusic() {
  const music = audioCache.background;
  music.volume = backgroundMusicVolume;

  if (backgroundMusicMuted) {
    music.pause();
    return;
  }

  music.play().catch(() => {});
}

function applyAudioSettings(settings = {}) {
  buttonSoundsMuted = Boolean(settings.muteButtonSounds);
  backgroundMusicMuted = Boolean(settings.muteBackgroundMusic);
  backgroundMusicVolume = clampVolumePercent(settings.backgroundMusicVolume) / 100;
  syncBackgroundMusic();
}

function attachButtonSounds(root = document) {
  root.querySelectorAll('button').forEach((button) => {
    if (button.dataset.soundsBound === 'true') return;

    let isHovering = false;

    button.addEventListener('mouseenter', () => {
      if (isHovering) return;
      isHovering = true;
      playButtonSound('hover');
    });

    button.addEventListener('mouseleave', () => {
      isHovering = false;
    });

    button.addEventListener('click', () => {
      playButtonSound('click');
    });

    button.dataset.soundsBound = 'true';
  });
}

window.daltonSounds = {
  init(settings = {}) {
    applyAudioSettings(settings);
    attachButtonSounds();
  },
  refresh(settings = {}) {
    applyAudioSettings(settings);
  },
  attachButtonSounds,
  clampVolumePercent
};
