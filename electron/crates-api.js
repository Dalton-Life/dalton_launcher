const http = require('http');
const { getServerEnv } = require('./env');
const { DEFAULT_PORT, validateServerHost } = require('./fivem-launch');

const REQUEST_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 256 * 1024;

function getCrateSecret() {
  return String(process.env.CRATE_API_SECRET || '').trim();
}

function buildCrateUrl(pathname) {
  const { serverIp, serverPort } = getServerEnv();
  const ip = validateServerHost(serverIp);
  const port = Number(serverPort) || DEFAULT_PORT;

  return {
    hostname: ip,
    port,
    path: `/dalton_launcher_crates${pathname}`
  };
}

function getCrateImageBase() {
  try {
    const target = buildCrateUrl('/image');
    return `http://${target.hostname}:${target.port}${target.path}`;
  } catch {
    return null;
  }
}

function attachImageBase(payload) {
  const imageBase = getCrateImageBase();

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, imageBase };
  }

  return { ...payload, imageBase };
}

function requestJson({ method, pathname, deviceId, body }) {
  const secret = getCrateSecret();

  if (!secret) {
    return Promise.resolve(
      attachImageBase({
        ok: false,
        error: 'Cajas no configuradas (CRATE_API_SECRET)'
      })
    );
  }

  return new Promise((resolve) => {
    let target;

    try {
      target = buildCrateUrl(pathname);
    } catch (error) {
      resolve(
        attachImageBase({ ok: false, error: error.message || 'Servidor no configurado' })
      );
      return;
    }

    const payload = body ? JSON.stringify(body) : null;
    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.path,
        method,
        family: 4,
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Accept: 'application/json',
          'X-Dalton-Crate-Key': secret,
          'X-Dalton-Device-Id': deviceId,
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
              }
            : {})
        }
      },
      (response) => {
        let data = '';
        let bodyBytes = 0;

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          bodyBytes += Buffer.byteLength(chunk, 'utf8');
          if (bodyBytes > MAX_RESPONSE_BYTES) {
            response.destroy();
            request.destroy();
            resolve(attachImageBase({ ok: false, error: 'Respuesta inválida' }));
          } else {
            data += chunk;
          }
        });

        response.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve(attachImageBase(parsed));
          } catch {
            resolve(
              attachImageBase({
                ok: false,
                error:
                  response.statusCode === 404
                    ? 'El resource dalton_launcher_crates no está iniciado'
                    : 'Respuesta inválida del servidor'
              })
            );
          }
        });
      }
    );

    request.on('timeout', () => {
      request.destroy();
      resolve(attachImageBase({ ok: false, error: 'Tiempo de espera agotado' }));
    });

    request.on('error', (error) => {
      resolve(
        attachImageBase({
          ok: false,
          error:
            error.code === 'ECONNREFUSED' ? 'Servidor no disponible' : 'No se pudo consultar la caja'
        })
      );
    });

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

function getCrateStatus(deviceId) {
  return requestJson({
    method: 'GET',
    pathname: '/status',
    deviceId
  });
}

function openCrate(deviceId) {
  return requestJson({
    method: 'POST',
    pathname: '/open',
    deviceId,
    body: { deviceId }
  });
}

module.exports = {
  getCrateStatus,
  openCrate
};
