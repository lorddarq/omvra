const { createDefaultUpdateState } = require('./update-service.cjs');

function registerUpdateIpcHandlers({
  ipcMain,
  app,
  getUpdateController,
  setStoredUpdateChannel,
}) {
  function getFallbackState() {
    return createDefaultUpdateState({
      supported: false,
      packaged: Boolean(app?.isPackaged),
      channel: 'stable',
    });
  }

  ipcMain.handle('updates/get-state', () => {
    const updateController = getUpdateController();
    return updateController ? updateController.getState() : getFallbackState();
  });

  ipcMain.handle('updates/check', async () => {
    const updateController = getUpdateController();
    return updateController ? updateController.checkForUpdates() : getFallbackState();
  });

  ipcMain.handle('updates/download', async () => {
    const updateController = getUpdateController();
    return updateController ? updateController.downloadUpdate() : getFallbackState();
  });

  ipcMain.handle('updates/install', () => {
    const updateController = getUpdateController();
    return {
      success: Boolean(updateController?.quitAndInstall()),
    };
  });

  ipcMain.handle('updates/dismiss', () => {
    const updateController = getUpdateController();
    return updateController ? updateController.dismiss() : getFallbackState();
  });

  ipcMain.handle('updates/set-channel', (_, channel) => {
    const normalized = setStoredUpdateChannel(channel);
    const updateController = getUpdateController();
    return updateController ? updateController.setChannel(normalized) : { channel: normalized };
  });
}

module.exports = {
  registerUpdateIpcHandlers,
};
