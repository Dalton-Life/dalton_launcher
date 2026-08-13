const fsp = require('fs/promises');
const path = require('path');
const { getFiveMDataPath, getFiveMPlayState } = require('./fivem-launch');
const CACHE_DIRS = ['server-cache-priv', 'server-cache', 'cache'];

async function removeDirIfExists(dirPath) {
  const name = path.basename(dirPath);

  try {
    await fsp.access(dirPath);
  } catch {
    return { name, status: 'missing' };
  }

  await fsp.rm(dirPath, { recursive: true, force: true });
  return { name, status: 'removed' };
}

function yieldToEventLoop() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function clearFiveMCache(options = {}) {
  const dataPath = getFiveMDataPath(options);

  if (!dataPath) {
    return {
      ok: false,
      message: 'No se pudo localizar la carpeta de datos de FiveM en este equipo.'
    };
  }

  try {
    await fsp.access(dataPath);
  } catch {
    return {
      ok: false,
      message: 'No se encontró la carpeta de datos de FiveM. ¿Está FiveM instalado?'
    };
  }

  const results = [];

  for (const dirName of CACHE_DIRS) {
    const playState = getFiveMPlayState();

    if (playState.running || playState.inGame) {
      return {
        ok: false,
        message: 'Cierra FiveM completamente antes de borrar la caché.'
      };
    }

    const dirPath = path.join(dataPath, dirName);

    try {
      results.push(await removeDirIfExists(dirPath));
    } catch (error) {
      results.push({
        name: dirName,
        status: 'error',
        error: error.message || 'Error desconocido'
      });
    }

    await yieldToEventLoop();
  }

  const removed = results.filter((entry) => entry.status === 'removed').map((entry) => entry.name);
  const errors = results.filter((entry) => entry.status === 'error');

  if (errors.length > 0) {
    return {
      ok: false,
      message: `No se pudieron borrar: ${errors.map((entry) => entry.name).join(', ')}.`,
      results
    };
  }

  if (removed.length === 0) {
    return {
      ok: true,
      message: 'No había caché que borrar (las carpetas ya no existían).',
      results
    };
  }

  return {
    ok: true,
    message: `Caché borrada correctamente: ${removed.join(', ')}.`,
    results
  };
}

module.exports = {
  clearFiveMCache
};
