const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { runBroadcast } = require('./broadcast');

const supportedImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

function normalizeImagePath(imagePath) {
    const trimmed = (imagePath || '').trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
        return '';
    }
    return trimmed;
}

function validateBroadcastPayload(payload) {
    if (!payload || !Array.isArray(payload.targets)) {
        return 'Invalid broadcast payload.';
    }

    for (const target of payload.targets) {
        if (!target || typeof target !== 'object') {
            return 'Invalid target payload.';
        }

        const imagePath = normalizeImagePath(target.image_path);
        if (!imagePath) {
            continue;
        }

        try {
            const stats = fs.statSync(imagePath);
            if (!stats.isFile()) {
                return `Image path is not a file: ${imagePath}`;
            }
        } catch {
            return `Image file not found: ${imagePath}`;
        }

        const extension = path.extname(imagePath).toLowerCase();
        if (!supportedImageExtensions.has(extension)) {
            return `Unsupported image type: ${extension}`;
        }
    }

    return null;
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.handle('start-broadcast', async (event, data) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    const validationError = validateBroadcastPayload(data);
    if (validationError) {
        throw new Error(validationError);
    }

    if (data.targets && Array.isArray(data.targets)) {
        data.targets = data.targets.map((target) => ({
            ...target,
            image_path: normalizeImagePath(target.image_path)
        }));
    }

    await runBroadcast(win, data);
    return { success: true };
});
