const packageJson = require('../package.json');
const DEFAULT_VERSION = packageJson.version || '0.0.0';

function getAppVersion(app) {
  return app.getVersion() || DEFAULT_VERSION;
}

module.exports = {
  getAppVersion
};
