# Discord Broadcaster

Broadcast messages to multiple Discord channels easily.

## Features

- Send messages to multiple Discord channels at once
- Optional role mentions in messages
- Save and manage multiple broadcast profiles
- Preview mode to test before sending
- Local token storage (optional)

## Requirements

- **Node.js** 16+ and npm
- **Python 3.6+** with the `requests` library
- **Electron** (installed via npm)

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd discord_broadcaster
```

### 2. Install Node.js dependencies

```bash
npm install
```

### 3. Install Python dependencies

```bash
pip install requests
```

## Running the App

### Development mode

```bash
npm start
```

### Build for Linux

```bash
npm run build
```

This will generate:
- **AppImage** - Universal Linux format
- **DEB** - For Debian/Ubuntu
- **RPM** - For Fedora/RHEL/CentOS

Built packages will be in the `dist/` folder.

## Usage

### Getting Your Discord User Token

To use this application, you need your Discord user token. Follow this guide to obtain it:

**[How to Get Your Discord User Token](https://gist.github.com/MarvNC/e601f3603df22f36ebd3102c501116c6)**

> **Warning:** Your Discord token is like a password. Never share it with anyone. This application stores your token locally on your machine only if you choose to save it.

### Getting Channel and Role IDs

1. Enable **Developer Mode** in Discord:
   - Go to User Settings > App Settings > Advanced
   - Toggle on "Developer Mode"

2. **Channel ID**: Right-click on a channel and select "Copy Channel ID"

3. **Role ID**: Go to Server Settings > Roles, right-click a role, and select "Copy Role ID"

### Sending Messages

1. Paste your Discord token
2. Add broadcast targets (channel ID, optional role ID, and message)
3. Click "Preview" to test without sending
4. Click "Start Broadcast" to send messages

## Profiles

You can save your broadcast configurations as profiles:
- Click "Save As..." to create a new profile
- Select a profile from the dropdown to load it
- Click "Delete" to remove the current profile

## Building for Fedora

The RPM package is specifically designed for Fedora and other RPM-based distributions:

```bash
npm run build
```

Install the generated RPM:

```bash
sudo dnf install ./dist/discord-broadcaster-*.rpm
```

## License

MIT
