const http = require('http');
const { DEFAULT_PORT, validateServerHost } = require('./fivem-launch');

const REQUEST_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function buildBaseUrl(serverIp, serverPort) {
  const ip = validateServerHost(serverIp);
  const port = Number(serverPort) || DEFAULT_PORT;

  return { ip, port, baseUrl: `http://${ip}:${port}` };
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const target = new URL(url);
    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        family: 4,
        timeout: REQUEST_TIMEOUT_MS
      },
      (response) => {
        let body = '';
        let bodyBytes = 0;

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          bodyBytes += Buffer.byteLength(chunk, 'utf8');
          if (bodyBytes > MAX_RESPONSE_BYTES) {
            response.destroy();
            request.destroy();
            reject(
              Object.assign(new Error('Respuesta del servidor demasiado grande'), {
                code: 'BODY_TOO_LARGE'
              })
            );
            return;
          }

          body += chunk;
        });

        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(Object.assign(new Error(`HTTP ${response.statusCode}`), { code: 'HTTP_ERROR' }));
            return;
          }

          try {
            const data = JSON.parse(body);
            resolve({
              data,
              ping: Math.max(0, Date.now() - startedAt)
            });
          } catch (error) {
            reject(Object.assign(error, { code: 'INVALID_JSON' }));
          }
        });
      }
    );

    request.on('timeout', () => {
      request.destroy();
      reject(Object.assign(new Error('Tiempo de espera agotado'), { name: 'AbortError' }));
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.end();
  });
}

async function fetchFirstAvailable(urls) {
  let lastError = null;

  for (const url of urls) {
    try {
      return await fetchJson(url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Servidor offline');
}

function parseServerPayload(dynamic = {}, info = {}) {
  if (Array.isArray(dynamic)) {
    return {
      hostname: String(info.hostname || 'Dalton Life').trim(),
      clients: dynamic.length,
      maxClients: Number(info.sv_maxclients) || 0
    };
  }

  const merged = { ...info, ...dynamic };
  const maxClients = Number(merged.sv_maxclients ?? merged.vars?.sv_maxclients) || 0;
  const clients = Number(merged.clients ?? merged.players ?? dynamic.clients ?? dynamic.players ?? 0);
  const hostname = String(merged.hostname || info.hostname || dynamic.hostname || 'Dalton Life').trim();

  return {
    hostname,
    clients,
    maxClients
  };
}

async function getServerStatus(serverIp, serverPort = DEFAULT_PORT) {
  let base;

  try {
    base = buildBaseUrl(serverIp, serverPort);
  } catch (error) {
    return {
      online: false,
      error: error.message
    };
  }

  try {
    const { data: dynamic, ping } = await fetchFirstAvailable([
      `${base.baseUrl}/dynamic.json`,
      `${base.baseUrl}/info.json`,
      `${base.baseUrl}/players.json`
    ]);

    let info = {};

    try {
      const infoResponse = await fetchJson(`${base.baseUrl}/info.json`);
      info = infoResponse.data || {};
    } catch {
      info = {};
    }

    const parsed = parseServerPayload(dynamic, info);

    return {
      online: true,
      hostname: parsed.hostname,
      clients: parsed.clients,
      maxClients: parsed.maxClients,
      ping
    };
  } catch (error) {
    return {
      online: false,
      ping: null,
      error:
        error.name === 'AbortError' || error.code === 'ETIMEDOUT'
          ? 'Tiempo de espera agotado'
          : error.code === 'ECONNREFUSED'
            ? 'Servidor no disponible'
            : error.code === 'BODY_TOO_LARGE'
              ? 'Respuesta del servidor inválida'
              : 'Servidor offline'
    };
  }
}

module.exports = {
  getServerStatus
};
