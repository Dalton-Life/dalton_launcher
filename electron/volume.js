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

module.exports = {
  clampVolumePercent
};
