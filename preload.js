const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('discordAPI', {
    startBroadcast: (data) => ipcRenderer.invoke('start-broadcast', data),
    onProgress: (callback) => ipcRenderer.on('broadcast-progress', (event, data) => callback(data)),
    getFilePath: (file) => webUtils.getPathForFile(file)
});
