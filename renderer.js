const targetsList = document.getElementById('targets-list');
const addTargetBtn = document.getElementById('add-target-btn');
const broadcastBtn = document.getElementById('broadcast-btn');
const previewBtn = document.getElementById('preview-btn');
const statusDisplay = document.getElementById('status-display');
const template = document.getElementById('target-template');
const saveTokenCheck = document.getElementById('save-token-check');
const deleteTokenBtn = document.getElementById('delete-token-btn');
const tokenInput = document.getElementById('token-input');
const toggleTokenBtn = document.getElementById('toggle-token-btn');
const profileSelect = document.getElementById('profile-select');
const saveProfileBtn = document.getElementById('save-profile-btn');
const deleteProfileBtn = document.getElementById('delete-profile-btn');
const profileModal = document.getElementById('profile-modal');
const profileNameInput = document.getElementById('profile-name-input');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');
const envWarning = document.getElementById('env-warning');
const envWarningText = document.getElementById('env-warning-text');
const envWarningInstall = document.getElementById('env-warning-install');
const copyCommandBtn = document.getElementById('copy-command-btn');
const globalImageRow = document.getElementById('global-image-row');
const globalImagePathInput = document.getElementById('global-image-path');
const globalImageFileInput = document.getElementById('global-image-file-input');
const globalImageClearBtn = document.getElementById('global-image-clear-btn');

// Check Python environment on startup
checkPythonEnvironment();

// Load saved settings on startup
loadSettings();
loadProfiles();
setupGlobalImageHandlers();

async function checkPythonEnvironment() {
    try {
        const result = await window.discordAPI.checkPythonEnv();

        if (!result.python_ok || !result.requests_ok) {
            envWarningText.textContent = result.errors.join(' ');
            envWarning.classList.remove('hidden');

            // Show install instructions if requests is missing
            if (!result.requests_ok) {
                envWarningInstall.classList.remove('hidden');
            }
        }
    } catch (err) {
        envWarningText.textContent = `Could not check Python environment. Error: ${err.message}`;
        console.error(err);
        envWarning.classList.remove('hidden');
        envWarningInstall.classList.remove('hidden');
    }
}

// Copy command button handler
copyCommandBtn.addEventListener('click', () => {
    const command = document.getElementById('install-command').textContent;
    navigator.clipboard.writeText(command).then(() => {
        copyCommandBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyCommandBtn.textContent = 'Copy';
        }, 2000);
    });
});

// Event Listeners
addTargetBtn.addEventListener('click', () => addTarget());
broadcastBtn.addEventListener('click', () => startBroadcast(false));
previewBtn.addEventListener('click', () => startBroadcast(true));
deleteTokenBtn.addEventListener('click', deleteSavedToken);
toggleTokenBtn.addEventListener('click', toggleTokenVisibility);
profileSelect.addEventListener('change', switchProfile);
saveProfileBtn.addEventListener('click', showProfileModal);
deleteProfileBtn.addEventListener('click', deleteCurrentProfile);
modalCancelBtn.addEventListener('click', hideProfileModal);
modalSaveBtn.addEventListener('click', confirmSaveProfile);

function setupGlobalImageHandlers() {
    globalImageFileInput.addEventListener('change', () => {
        const file = globalImageFileInput.files[0];
        if (file) {
            const path = window.discordAPI.getFilePath(file);
            globalImagePathInput.value = path;
            saveProfilesData(getProfilesData()); // Save to current profile
        } else {
            globalImagePathInput.value = '';
        }
    });

    globalImageClearBtn.addEventListener('click', () => {
        globalImageFileInput.value = '';
        globalImagePathInput.value = '';
        saveProfilesData(getProfilesData());
    });

    // Drag and Drop for Global Image
    globalImageRow.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        globalImageRow.classList.add('drag-over');
    });

    globalImageRow.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        globalImageRow.classList.remove('drag-over');
    });

    globalImageRow.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        globalImageRow.classList.remove('drag-over');

        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                const path = window.discordAPI.getFilePath(file);
                globalImagePathInput.value = path;
                saveProfilesData(getProfilesData());
            } else {
                showStatus('Only image files are allowed.', 'error');
            }
        }
    });
}

function toggleTokenVisibility() {
    if (tokenInput.type === 'password') {
        tokenInput.type = 'text';
        toggleTokenBtn.textContent = 'Hide';
    } else {
        tokenInput.type = 'password';
        toggleTokenBtn.textContent = 'Show';
    }
}

// Listen for progress from main process
window.discordAPI.onProgress((data) => {
    if (data.type === 'log') {
        showStatus(data.message, 'info');
    } else if (data.type === 'progress') {
        const targetLabel = data.name || `Channel ${data.channel_id}`;
        showStatus(`Sending to ${targetLabel}... (${data.current}/${data.total})`, 'info');
    } else if (data.type === 'success') {
        // Optional: verify individual success visually if needed
        console.log(`Success: ${data.channel_id}`);
    } else if (data.type === 'error') {
        console.error(`Error: ${data.message}`);
        const targetLabel = data.name || `Channel ${data.channel_id}`;
        showStatus(`Error for ${targetLabel}: ${data.message}`, 'error');
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

    // Load Targets from active profile (handled by loadProfiles)
}

// ========== PROFILE MANAGEMENT ==========

function getProfilesData() {
    try {
        const data = JSON.parse(localStorage.getItem('discord_broadcaster_profiles'));
        if (data && data.profiles) {
            return data;
        }
    } catch (e) { }
    return { profiles: { 'Default': [] }, activeProfile: 'Default' };
}

function saveProfilesData(data) {
    const activeProfile = data.activeProfile;
    const globalImage = globalImagePathInput.value.trim();

    // If profile data is old array format, convert to object
    if (Array.isArray(data.profiles[activeProfile])) {
        data.profiles[activeProfile] = {
            targets: data.profiles[activeProfile],
            global_image: globalImage
        };
    } else if (data.profiles[activeProfile]) {
        // Update existing object
        data.profiles[activeProfile].global_image = globalImage;
    }

    localStorage.setItem('discord_broadcaster_profiles', JSON.stringify(data));
}

function loadProfiles() {
    const data = getProfilesData();

    // Populate dropdown
    profileSelect.innerHTML = '';
    Object.keys(data.profiles).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        profileSelect.appendChild(option);
    });

    // Set active profile
    profileSelect.value = data.activeProfile;

    // Load targets for active profile
    loadTargetsFromProfile(data.activeProfile);
}

function loadTargetsFromProfile(profileName) {
    const data = getProfilesData();
    let profileData = data.profiles[profileName];
    let targets = [];
    let globalImage = '';

    // Handle backward compatibility (array vs object)
    if (Array.isArray(profileData)) {
        targets = profileData;
    } else if (profileData) {
        targets = profileData.targets || [];
        globalImage = profileData.global_image || '';
    }

    // Set global image input
    globalImagePathInput.value = globalImage;

    // Clear existing targets
    targetsList.innerHTML = '';

    if (targets.length > 0) {
        targets.forEach(t => addTarget(t));
    } else {
        addTarget(); // Add default empty target
    }
}

function switchProfile() {
    const selectedProfile = profileSelect.value;
    const data = getProfilesData();
    data.activeProfile = selectedProfile;
    saveProfilesData(data);
    loadTargetsFromProfile(selectedProfile);
    showStatus(`Switched to profile: ${selectedProfile}`, 'info');
}

function showProfileModal() {
    profileNameInput.value = profileSelect.value;
    profileModal.classList.remove('hidden');
    profileNameInput.focus();
}

function hideProfileModal() {
    profileModal.classList.add('hidden');
}

function confirmSaveProfile() {
    const newName = profileNameInput.value.trim();

    if (!newName) {
        return;
    }

    const data = getProfilesData();
    const currentTargets = getCurrentTargetsData();
    const globalImage = globalImagePathInput.value.trim();

    data.profiles[newName] = {
        targets: currentTargets,
        global_image: globalImage
    };
    data.activeProfile = newName;
    saveProfilesData(data);

    loadProfiles();
    hideProfileModal();
    showStatus(`Profile "${newName}" saved!`, 'success');
}

function deleteCurrentProfile() {
    const currentProfile = profileSelect.value;

    if (currentProfile === 'Default') {
        showStatus('Cannot delete the Default profile.', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete profile "${currentProfile}"?`)) {
        return;
    }

    const data = getProfilesData();
    delete data.profiles[currentProfile];
    data.activeProfile = 'Default';

    // Ensure Default exists
    if (!data.profiles['Default']) {
        data.profiles['Default'] = [];
    }

    saveProfilesData(data);
    loadProfiles();
    showStatus(`Profile "${currentProfile}" deleted.`, 'info');
}

function getCurrentTargetsData() {
    const targets = [];
    const cards = targetsList.querySelectorAll('.target-card');
    cards.forEach(card => {
        targets.push({
            channel_id: card.querySelector('.channel-id').value.trim(),
            role_id: card.querySelector('.role-id').value.trim(),
            message: card.querySelector('.message-text').value.trim(),
            name: card.querySelector('.target-name').value.trim(),
            image_path: card.querySelector('.image-path').value.trim()
        });
    });
    return targets;
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
    const imagePathInput = card.querySelector('.image-path');
    const imageFileInput = card.querySelector('.image-file-input');
    const imageClearBtn = card.querySelector('.image-clear-btn');

    // Fill data if provided
    if (data) {
        card.querySelector('.channel-id').value = data.channel_id || '';
        card.querySelector('.role-id').value = data.role_id || '';
        card.querySelector('.message-text').value = data.message || '';
        card.querySelector('.target-name').value = data.name || '';
        const savedImagePath = (data.image_path || '').trim();
        imagePathInput.value = (savedImagePath && savedImagePath !== 'undefined' && savedImagePath !== 'null')
            ? savedImagePath
            : '';
    }

    // Setup delete handler
    deleteBtn.addEventListener('click', () => {
        card.remove();
        updateTargetNumbers();
        saveTargets(); // Auto-save on delete
    });

    imageFileInput.addEventListener('change', () => {
        const file = imageFileInput.files[0];
        if (file) {
            const path = window.discordAPI.getFilePath(file);
            imagePathInput.value = path;
        } else {
            imagePathInput.value = '';
        }
        saveTargets();
    });

    imageClearBtn.addEventListener('click', () => {
        imageFileInput.value = '';
        imagePathInput.value = '';
        saveTargets();
    });

    const fileInputRow = card.querySelector('.file-input-row');

    // Drag and Drop Logic
    fileInputRow.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInputRow.classList.add('drag-over');
    });

    fileInputRow.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInputRow.classList.remove('drag-over');
    });

    fileInputRow.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInputRow.classList.remove('drag-over');

        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            // Validate it's an image
            if (file.type.startsWith('image/')) {
                const path = window.discordAPI.getFilePath(file);
                imagePathInput.value = path;
                saveTargets();
            } else {
                showStatus('Only image files are allowed.', 'error');
            }
        }
    });

    // Auto-save on input change
    card.querySelectorAll('input, textarea').forEach(input => {
        if (!input.classList.contains('image-file-input')) {
            input.addEventListener('input', saveTargets);
        }
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
            message: card.querySelector('.message-text').value.trim(),
            image_path: card.querySelector('.image-path').value.trim()
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

async function startBroadcast(isPreview = false) {
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
    const globalImage = globalImagePathInput.value.trim();

    cards.forEach((card, index) => {
        const channelId = card.querySelector('.channel-id').value.trim();
        const roleId = card.querySelector('.role-id').value.trim();
        const message = card.querySelector('.message-text').value.trim();
        const name = card.querySelector('.target-name').value.trim();
        let imagePath = card.querySelector('.image-path').value.trim();

        // Apply global image if target image is empty
        if (!imagePath && globalImage) {
            imagePath = globalImage;
        }

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

        targets.push({
            channel_id: channelId,
            role_id: roleId,
            message: message,
            name: name,
            image_path: imagePath
        });
    });

    if (validationError) return;

    // Persistence: Save Token if checked
    if (saveTokenCheck.checked) {
        localStorage.setItem('discord_broadcaster_token', token);
        deleteTokenBtn.classList.remove('hidden');
    }

    // Persistence: Save Targets
    saveTargets();
    saveProfilesData(getProfilesData()); // Save global image setting too

    broadcastBtn.disabled = true;
    previewBtn.disabled = true;

    if (isPreview) {
        showStatus('Running preview (no messages will be sent)...', 'info');
    } else {
        showStatus('Starting broadcast process...', 'info');
    }

    try {
        await window.discordAPI.startBroadcast({ token, targets, preview: isPreview });
    } catch (err) {
        showStatus(`Broadcast failed to start: ${err.message}`, 'error');
    }

    broadcastBtn.disabled = false;
    previewBtn.disabled = false;
}
