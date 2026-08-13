const DEFAULT_VERSION = '0.1';

function getAppVersion(app) {
  return app.getVersion() || `${DEFAULT_VERSION}.0`;
}

function formatDisplayVersion(version) {
  const raw = String(version || DEFAULT_VERSION).trim().replace(/^v/i, '');
  const match = raw.match(/^(\d+)\.(\d+)/);

  return match ? `${match[1]}.${match[2]}` : raw;
}

module.exports = {
  DEFAULT_VERSION,
  getAppVersion,
  formatDisplayVersion
};
