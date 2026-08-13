const packageJson = require('../package.json');
const DEFAULT_VERSION = packageJson.version || '0.0.0';

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
