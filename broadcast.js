const fs = require('fs');
const path = require('path');
const { Blob } = require('buffer');

const RATE_LIMIT_MS = 1000;

function emitProgress(win, data) {
    win.webContents.send('broadcast-progress', data);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendMessage(token, channelId, content, imagePath, imageCache) {
    const url = `https://discord.com/api/v9/channels/${channelId}/messages`;
    const headers = { Authorization: token };

    try {
        let response;

        if (imagePath) {
            let fileBuffer = imageCache.get(imagePath);
            if (!fileBuffer) {
                fileBuffer = await fs.promises.readFile(imagePath);
                imageCache.set(imagePath, fileBuffer);
            }

            const payload = {};
            if (content) {
                payload.content = content;
            }

            const form = new FormData();
            form.append('payload_json', JSON.stringify(payload));
            form.append('files[0]', new Blob([fileBuffer]), path.basename(imagePath));

            response = await fetch(url, {
                method: 'POST',
                headers,
                body: form
            });
        } else {
            const body = content ? { content } : {};
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
        }

        if (!response.ok) {
            let errorMsg = `HTTP ${response.status}`;
            const text = await response.text();
            if (text) {
                try {
                    errorMsg += `: ${JSON.parse(text).message || text}`;
                } catch {
                    errorMsg += `: ${text}`;
                }
            }
            return { success: false, error: errorMsg };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function buildMessageContent(roleId, baseText) {
    const parts = [];
    if (roleId) {
        parts.push(`<@&${roleId}>`);
    }
    if (baseText) {
        parts.push(baseText);
    }
    return parts.join(' ');
}

function formatSummary(modeLabel, successCount, errorCount) {
    const label = modeLabel === 'PREVIEW' ? 'Preview' : 'Broadcast';
    return `${label} complete: ${successCount} successful, ${errorCount} failed`;
}

async function runBroadcast(win, data) {
    const token = data.token;
    const targets = data.targets || [];
    const isPreview = data.preview || false;
    const imageCache = new Map();

    if (!token) {
        emitProgress(win, { type: 'error', message: 'Token is missing' });
        return;
    }

    const modeLabel = isPreview ? 'PREVIEW' : 'broadcast';
    emitProgress(win, {
        type: 'log',
        message: `Starting ${modeLabel} to ${targets.length} targets...`
    });

    const total = targets.length;
    let successCount = 0;
    let errorCount = 0;

    for (let index = 0; index < targets.length; index++) {
        const target = targets[index];
        const channelId = target.channel_id;
        const roleId = target.role_id;
        const baseText = target.message || '';
        const imagePath = (target.image_path || '').trim();
        const targetName = target.name || `Target #${index + 1}`;

        if (!channelId) {
            emitProgress(win, {
                type: 'error',
                channel_id: 'unknown',
                name: targetName,
                message: 'Missing channel_id'
            });
            errorCount++;
            continue;
        }

        emitProgress(win, {
            type: 'progress',
            current: index + 1,
            total,
            channel_id: channelId,
            name: targetName
        });

        const messageContent = buildMessageContent(roleId, baseText);

        if (isPreview) {
            let previewContent = messageContent ? messageContent.slice(0, 50) : 'image only';
            let previewNote = `[PREVIEW] Would send: ${previewContent}`;
            if (messageContent.length > 50) {
                previewNote += '...';
            }
            if (imagePath) {
                previewNote += ' with image';
            }
            emitProgress(win, {
                type: 'success',
                channel_id: channelId,
                name: targetName,
                message: previewNote
            });
            successCount++;
            continue;
        }

        const result = await sendMessage(
            token,
            channelId,
            messageContent,
            imagePath || null,
            imageCache
        );

        if (result.success) {
            emitProgress(win, {
                type: 'success',
                channel_id: channelId,
                name: targetName,
                message: 'Sent successfully'
            });
            successCount++;
        } else {
            emitProgress(win, {
                type: 'error',
                channel_id: channelId,
                name: targetName,
                message: result.error
            });
            errorCount++;
        }

        await sleep(RATE_LIMIT_MS);
    }

    emitProgress(win, {
        type: 'done',
        summary: formatSummary(modeLabel, successCount, errorCount)
    });
}

module.exports = { runBroadcast };
