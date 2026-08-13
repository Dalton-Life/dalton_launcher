const DEFAULT_VERSION = '0.1.10';

function getAppVersion(app) {
  return app.getVersion() || DEFAULT_VERSION;
}

function formatDisplayVersion(version) {
  const raw = String(version || DEFAULT_VERSION).trim().replace(/^v/i, '');
  return raw || DEFAULT_VERSION;
}

module.exports = {
  DEFAULT_VERSION,
  getAppVersion,
  formatDisplayVersion
};
