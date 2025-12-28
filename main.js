const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 700,
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

ipcMain.handle('start-broadcast', (event, data) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    return new Promise((resolve, reject) => {
        const fs = require('fs');
        let pythonPath = 'python3';
        const venvPath = path.join(__dirname, 'venv', 'bin', 'python');

        if (fs.existsSync(venvPath)) {
            pythonPath = venvPath;
        }

        const pythonProcess = spawn(pythonPath, ['main.py']);

        let errorOutput = '';

        // Handle stdout (JSON lines from Python)
        pythonProcess.stdout.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    win.webContents.send('broadcast-progress', json);
                } catch (e) {
                    console.error('Failed to parse Python output:', line);
                }
            }
        });

        // Handle stderr
        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python Error: ${data}`);
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true });
            } else {
                reject(new Error(`Python process exited with code ${code}: ${errorOutput}`));
            }
        });

        // Send input data to Python
        pythonProcess.stdin.write(JSON.stringify(data));
        pythonProcess.stdin.end();
    });
});
