const targetsList = document.getElementById('targets-list');
const addTargetBtn = document.getElementById('add-target-btn');
const broadcastBtn = document.getElementById('broadcast-btn');
const statusDisplay = document.getElementById('status-display');
const template = document.getElementById('target-template');
const saveTokenCheck = document.getElementById('save-token-check');
const deleteTokenBtn = document.getElementById('delete-token-btn');
const tokenInput = document.getElementById('token-input');
const toggleTokenBtn = document.getElementById('toggle-token-btn');

// Load saved settings on startup
loadSettings();

// Event Listeners
addTargetBtn.addEventListener('click', () => addTarget());
broadcastBtn.addEventListener('click', startBroadcast);
deleteTokenBtn.addEventListener('click', deleteSavedToken);
toggleTokenBtn.addEventListener('click', toggleTokenVisibility);

function toggleTokenVisibility() {
    if (tokenInput.type === 'password') {
        tokenInput.type = 'text';
        toggleTokenBtn.textContent = '🙈';
    } else {
        tokenInput.type = 'password';
        toggleTokenBtn.textContent = '👁';
    }
}

// Listen for progress from main process
window.discordAPI.onProgress((data) => {
    if (data.type === 'log') {
        showStatus(data.message, 'info');
    } else if (data.type === 'progress') {
        showStatus(`Sending... (${data.current}/${data.total})`, 'info');
    } else if (data.type === 'success') {
        // Optional: verify individual success visually if needed
        console.log(`Success: ${data.channel_id}`);
    } else if (data.type === 'error') {
        console.error(`Error: ${data.message}`);
        // Maybe append error to a log list
    } else if (data.type === 'done') {
        showStatus(data.summary, 'success');
        broadcastBtn.disabled = false;
    }
});

function loadSettings() {
    // Load Token
    const savedToken = localStorage.getItem('discord_broadcaster_token');
    if (savedToken) {
        tokenInput.value = savedToken;
        saveTokenCheck.checked = true;
        deleteTokenBtn.classList.remove('hidden');
    } else {
        saveTokenCheck.checked = false;
        deleteTokenBtn.classList.add('hidden');
    }

    // Load Targets
    try {
        const savedTargets = JSON.parse(localStorage.getItem('discord_broadcaster_targets'));
        if (savedTargets && Array.isArray(savedTargets) && savedTargets.length > 0) {
            savedTargets.forEach(t => addTarget(t));
        } else {
            addTarget(); // Add default empty target
        }
    } catch (e) {
        console.error("Failed to load targets", e);
        addTarget(); // Add default empty target on error
    }
}

function deleteSavedToken() {
    localStorage.removeItem('discord_broadcaster_token');
    tokenInput.value = '';
    saveTokenCheck.checked = false;
    deleteTokenBtn.classList.add('hidden');
    showStatus('Saved token deleted.', 'info');
}

function addTarget(data = null) {
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.target-card');
    const deleteBtn = card.querySelector('.delete-btn');

    // Fill data if provided
    if (data) {
        card.querySelector('.channel-id').value = data.channel_id || '';
        card.querySelector('.role-id').value = data.role_id || '';
        card.querySelector('.message-text').value = data.message || '';
    }

    // Setup delete handler
    deleteBtn.addEventListener('click', () => {
        card.remove();
        updateTargetNumbers();
        saveTargets(); // Auto-save on delete
    });

    // Auto-save on input change
    card.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('input', saveTargets);
    });

    targetsList.appendChild(card);
    updateTargetNumbers();
}

function saveTargets() {
    const currentTargets = [];
    const cards = targetsList.querySelectorAll('.target-card');
    cards.forEach(card => {
        currentTargets.push({
            channel_id: card.querySelector('.channel-id').value.trim(),
            role_id: card.querySelector('.role-id').value.trim(),
            message: card.querySelector('.message-text').value.trim()
        });
    });
    localStorage.setItem('discord_broadcaster_targets', JSON.stringify(currentTargets));
}

function updateTargetNumbers() {
    const cards = targetsList.querySelectorAll('.target-card');
    cards.forEach((card, index) => {
        card.querySelector('.target-number').textContent = `Target #${index + 1}`;
    });
}

function showStatus(message, type = 'info') {
    statusDisplay.textContent = message;
    statusDisplay.className = `status-display ${type}`;
    statusDisplay.classList.remove('hidden');
}

async function startBroadcast() {
    const token = document.getElementById('token-input').value.trim();
    if (!token) {
        showStatus('Please enter your Discord User Token.', 'error');
        return;
    }

    const cards = targetsList.querySelectorAll('.target-card');
    if (cards.length === 0) {
        showStatus('Please add at least one target.', 'error');
        return;
    }

    const targets = [];
    let validationError = false;

    cards.forEach((card, index) => {
        const channelId = card.querySelector('.channel-id').value.trim();
        const roleId = card.querySelector('.role-id').value.trim();
        const message = card.querySelector('.message-text').value.trim();

        if (!channelId) {
            showStatus(`Target #${index + 1} is missing a Channel ID.`, 'error');
            validationError = true;
            return;
        }
        if (!message) {
            showStatus(`Target #${index + 1} has empty message content.`, 'error');
            validationError = true;
            return;
        }

        targets.push({ channel_id: channelId, role_id: roleId, message: message });
    });

    if (validationError) return;

    // Persistence: Save Token if checked
    if (saveTokenCheck.checked) {
        localStorage.setItem('discord_broadcaster_token', token);
        deleteTokenBtn.classList.remove('hidden');
    } else {
        // If unchecked, ensure we don't store it (or remove it if previously stored?)
        // The user might have just unchecked it.
        if (localStorage.getItem('discord_broadcaster_token')) {
            // Optional: Decide behavior. For safely, let's strictly respect the check.
            // If unchecked but exists, do we remove it? 
            // Requirement says "option to delete it". 
            // Let's assume unchecked means "don't update/save", but explicit delete is via button.
            // However, for best UX, if I uncheck "Save", I probably don't want it saved.
        }
    }

    // Persistence: Save Targets (already covered by input listeners, but force update for safety)
    saveTargets();

    broadcastBtn.disabled = true;
    showStatus('Starting broadcast process...', 'info');

    try {
        await window.discordAPI.startBroadcast({ token, targets });
    } catch (err) {
        showStatus(`Broadcast failed to start: ${err.message}`, 'error');
        broadcastBtn.disabled = false;
    }
}
