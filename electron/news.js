const fs = require('fs');
const path = require('path');

const REMOTE_NEWS_URL = 'https://store.daltonxlife.org/launcher-news.json';
const CACHE_MS = 5 * 60 * 1000;

let cache = {
  at: 0,
  data: null
};

function getLocalNewsPath(appPath) {
  return path.join(appPath, 'src', 'assets', 'news.json');
}

function readLocalNews(appPath) {
  const localPath = getLocalNewsPath(appPath);
  const raw = fs.readFileSync(localPath, 'utf8');
  return JSON.parse(raw);
}

async function fetchRemoteNews() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(REMOTE_NEWS_URL, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data?.items) || data.items.length === 0) {
      throw new Error('Invalid news payload');
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function getNews(appPath) {
  if (cache.data && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }

  try {
    const remote = await fetchRemoteNews();
    cache = { at: Date.now(), data: remote };
    return remote;
  } catch {
    const local = readLocalNews(appPath);
    cache = { at: Date.now(), data: local };
    return local;
  }
}

module.exports = {
  getNews
};
