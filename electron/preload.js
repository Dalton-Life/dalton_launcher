const { contextBridge, ipcRenderer } = require('electron');
const { DEFAULT_SERVER_PORT } = require('./constants');
contextBridge.exposeInMainWorld('dalton', {
  defaultServerPort: DEFAULT_SERVER_PORT,
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  relaunchApp: () => ipcRenderer.invoke('app:relaunch'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (partial) => ipcRenderer.invoke('config:set', partial),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  resolveInstallPath: (targetPath) => ipcRenderer.invoke('launcher:resolve-install-path', targetPath),
  installLauncher: (options) => ipcRenderer.invoke('launcher:install', options),
  startDaltonLife: () => ipcRenderer.invoke('launcher:start-dalton-life'),
  isFiveMInstalled: () => ipcRenderer.invoke('fivem:is-installed'),
  confirmClearFiveMCache: () => ipcRenderer.invoke('fivem:confirm-clear-cache'),
  clearFiveMCache: () => ipcRenderer.invoke('fivem:clear-cache'),
  showCacheClearResult: (result) => ipcRenderer.invoke('fivem:show-cache-result', result),
  getFiveMPlayState: () => ipcRenderer.invoke('fivem:get-play-state'),
  getServerStatus: () => ipcRenderer.invoke('fivem:get-server-status'),
  getNews: () => ipcRenderer.invoke('news:get'),
  syncDiscordPresence: (state) => ipcRenderer.invoke('discord:sync', state),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  checkForUpdates: (options) => ipcRenderer.invoke('updater:check', options),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdaterEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('updater:event', listener);

    return () => {
      ipcRenderer.removeListener('updater:event', listener);
    };
  },
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close')
});
