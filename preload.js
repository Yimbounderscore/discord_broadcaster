const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('discordAPI', {
    startBroadcast: (data) => ipcRenderer.invoke('start-broadcast', data),
    onProgress: (callback) => ipcRenderer.on('broadcast-progress', (event, data) => callback(data))
});
