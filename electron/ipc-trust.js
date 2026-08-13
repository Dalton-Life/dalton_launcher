function createIpcTrust(getMainWindow) {
  function isTrustedIpcSender(event) {
    const mainWindow = getMainWindow();

    return Boolean(
      mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents
    );
  }

  function trustedHandle(ipcMain, channel, handler) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrustedIpcSender(event)) {
        throw new Error(`IPC no autorizado: ${channel}`);
      }

      return handler(event, ...args);
    });
  }

  function trustedOn(ipcMain, channel, handler) {
    ipcMain.on(channel, (event, ...args) => {
      if (!isTrustedIpcSender(event)) {
        return;
      }

      handler(event, ...args);
    });
  }

  return { trustedHandle, trustedOn };
}

module.exports = {
  createIpcTrust
};
