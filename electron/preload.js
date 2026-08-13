const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dalton', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (partial) => ipcRenderer.invoke('config:set', partial),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  resolveInstallPath: (targetPath) => ipcRenderer.invoke('launcher:resolve-install-path', targetPath),
  installLauncher: (options) => ipcRenderer.invoke('launcher:install', options),
  uninstallLauncher: () => ipcRenderer.invoke('launcher:uninstall'),
  startDaltonLife: () => ipcRenderer.invoke('launcher:start-dalton-life'),
  isFiveMInstalled: () => ipcRenderer.invoke('fivem:is-installed'),
  confirmClearFiveMCache: () => ipcRenderer.invoke('fivem:confirm-clear-cache'),
  clearFiveMCache: () => ipcRenderer.invoke('fivem:clear-cache'),
  showCacheClearResult: (result) => ipcRenderer.invoke('fivem:show-cache-result', result),
  getFiveMPlayState: () => ipcRenderer.invoke('fivem:get-play-state'),
  getServerStatus: () => ipcRenderer.invoke('fivem:get-server-status'),
  getNews: () => ipcRenderer.invoke('news:get'),
  setDiscordPresence: (state) => ipcRenderer.invoke('discord:set-presence', state),
  syncDiscordPresence: (state) => ipcRenderer.invoke('discord:sync', state),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close')
});
