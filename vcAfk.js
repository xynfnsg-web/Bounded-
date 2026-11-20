const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'vcAfk.json');

// Map: guildId -> { guildId, channelId, channelName, enabled, setBy, setAt }
let vcAfkData = {};

function loadVcAfk() {
    try {
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            vcAfkData = JSON.parse(raw);
        } else {
            vcAfkData = {};
        }
    } catch (err) {
        console.error('[VC_AFK] Error loading vcAfk.json:', err);
        vcAfkData = {};
    }
}

function saveVcAfk() {
    try {
        fs.writeFileSync(DATA_PATH, JSON.stringify(vcAfkData, null, 2), 'utf-8');
    } catch (e) {
        console.error('[VC_AFK] Save error:', e);
    }
}

loadVcAfk();

function isVcAfkEnabled(guildId) {
    if (!guildId) return false;
    return !!(vcAfkData[guildId] && vcAfkData[guildId].enabled);
}

function getVcAfk(guildId) {
    if (!guildId) return null;
    return vcAfkData[guildId] || null;
}

function setVcAfk(guildId, channelId, channelName, userId) {
    if (!guildId || !channelId) return null;
    vcAfkData[guildId] = {
        guildId,
        channelId,
        channelName: channelName || 'Voice Channel',
        enabled: true,
        setBy: userId || 'Unknown',
        setAt: Date.now()
    };
    saveVcAfk();
    return vcAfkData[guildId];
}

function updateVcAfkChannel(guildId, channelId, channelName) {
    if (!guildId || !vcAfkData[guildId]) return null;
    vcAfkData[guildId].channelId = channelId;
    if (channelName) {
        vcAfkData[guildId].channelName = channelName;
    }
    saveVcAfk();
    return vcAfkData[guildId];
}

function disableVcAfk(guildId) {
    if (!guildId || !vcAfkData[guildId]) return null;
    const old = { ...vcAfkData[guildId] };
    delete vcAfkData[guildId];
    saveVcAfk();
    return old;
}

function getAllActiveVcAfk() {
    const active = {};
    for (const [gId, info] of Object.entries(vcAfkData)) {
        if (info && info.enabled && info.channelId) {
            active[gId] = info;
        }
    }
    return active;
}

function formatDuration(ms) {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
}

module.exports = {
    isVcAfkEnabled,
    getVcAfk,
    setVcAfk,
    updateVcAfkChannel,
    disableVcAfk,
    getAllActiveVcAfk,
    formatDuration
};
