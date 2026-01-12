const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Helper to get path to Python scripts (different in dev vs packaged)
function getResourcePath(filename) {
    if (app.isPackaged) {
        // In packaged app, resources are in the resources folder
        return path.join(process.resourcesPath, filename);
    } else {
        // In development, resources are in the project directory
        return path.join(__dirname, filename);
    }
}

// Helper to get Python executable path
function getPythonPath() {
    const isWindows = process.platform === 'win32';
    const defaultPython = isWindows ? 'python' : 'python3';

    if (app.isPackaged) {
        // In packaged app, always use system python
        // (We don't bundle python/venv to keep size down and avoid complexity)
        return defaultPython;
    } else {
        // In development, prefer venv if it exists
        const venvPath = isWindows
            ? path.join(__dirname, 'venv', 'Scripts', 'python.exe')
            : path.join(__dirname, 'venv', 'bin', 'python');
        if (fs.existsSync(venvPath)) {
            return venvPath;
        }
        return defaultPython;
    }
}

const supportedImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

function validateBroadcastPayload(payload) {
    if (!payload || !Array.isArray(payload.targets)) {
        return 'Invalid broadcast payload.';
    }

    for (const target of payload.targets) {
        if (!target || typeof target !== 'object') {
            return 'Invalid target payload.';
        }

        if (target.image_path) {
            const imagePath = target.image_path.trim();
            if (!imagePath || imagePath === 'undefined' || imagePath === 'null') {
                continue;
            }

            if (!fs.existsSync(imagePath)) {
                return `Image file not found: ${imagePath}`;
            }

            const stats = fs.statSync(imagePath);
            if (!stats.isFile()) {
                return `Image path is not a file: ${imagePath}`;
            }

            const extension = path.extname(imagePath).toLowerCase();
            if (!supportedImageExtensions.has(extension)) {
                return `Unsupported image type: ${extension}`;
            }
        }
    }

    return null;
}

// Handler for showing prompt dialog
ipcMain.handle('show-prompt', async (event, { title, defaultValue }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showMessageBox(win, {
        type: 'question',
        title: 'Save Profile',
        message: title,
        buttons: ['Cancel', 'Save'],
        defaultId: 1,
        cancelId: 0
    });

    if (result.response === 1) {
        // User clicked Save - since dialog.showMessageBox doesn't support input,
        // we'll use a workaround: return a signal that triggers a custom modal in renderer
        // For now, let's use the default value approach
        return defaultValue || 'New Profile';
    }
    return null;
});

// Handler for checking Python environment
ipcMain.handle('check-python-env', async () => {
    try {
        const pythonPath = getPythonPath();
        const checkEnvScript = getResourcePath('check_env.py');

        // Check if script exists
        if (!fs.existsSync(checkEnvScript)) {
            return {
                python_ok: false,
                requests_ok: false,
                errors: [`Script not found at: ${checkEnvScript}`]
            };
        }

        return new Promise((resolve) => {
            const checkProcess = spawn(pythonPath, [checkEnvScript]);

            let output = '';
            let errorOutput = '';

            checkProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            checkProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            checkProcess.on('close', (code) => {
                if (code === 0 && output) {
                    try {
                        resolve(JSON.parse(output.trim()));
                    } catch (e) {
                        resolve({ python_ok: false, requests_ok: false, errors: ['Failed to parse check result'] });
                    }
                } else {
                    resolve({
                        python_ok: false,
                        requests_ok: false,
                        errors: [`Python check failed (code ${code}). ${errorOutput || 'Make sure Python 3.6+ is installed.'}`]
                    });
                }
            });

            checkProcess.on('error', (err) => {
                resolve({
                    python_ok: false,
                    requests_ok: false,
                    errors: [`Python not found: ${err.message}. Please install Python 3.6 or higher.`]
                });
            });
        });
    } catch (err) {
        return {
            python_ok: false,
            requests_ok: false,
            errors: [`Internal Error: ${err.message}\nStack: ${err.stack}`]
        };
    }
});

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

ipcMain.handle('start-broadcast', (event, data) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    return new Promise((resolve, reject) => {
        const validationError = validateBroadcastPayload(data);
        if (validationError) {
            reject(new Error(validationError));
            return;
        }

        // Sanitize payload: ensure image_path is null/empty if it's "undefined" string
        if (data.targets && Array.isArray(data.targets)) {
            data.targets = data.targets.map(t => {
                if (t.image_path && (t.image_path === 'undefined' || t.image_path === 'null')) {
                    t.image_path = '';
                }
                return t;
            });
        }

        const pythonPath = getPythonPath();
        const mainPyScript = getResourcePath('main.py');
        const pythonProcess = spawn(pythonPath, [mainPyScript]);

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
