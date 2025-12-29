const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('discordAPI', {
    startBroadcast: (data) => ipcRenderer.invoke('start-broadcast', data),
    onProgress: (callback) => ipcRenderer.on('broadcast-progress', (event, data) => callback(data)),
    showPrompt: (title, defaultValue) => ipcRenderer.invoke('show-prompt', { title, defaultValue }),
    checkPythonEnv: () => ipcRenderer.invoke('check-python-env')
});
