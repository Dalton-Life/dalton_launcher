const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function parseAllowedExternalUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  let parsed;

  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return null;
  }

  if (!parsed.hostname) {
    return null;
  }

  if (parsed.username || parsed.password) {
    return null;
  }

  return parsed.href;
}

module.exports = {
  parseAllowedExternalUrl,
};
