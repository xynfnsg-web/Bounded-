const express = require('express');
const path = require('path');

function formatUptime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (sec > 0 || parts.length === 0) parts.push(`${sec}s`);
    return parts.join(' ');
}

function startWebServer(client) {
    const app = express();
    const PORT = process.env.PORT || 3000;
    const HOST = '0.0.0.0';

    // Serve static frontend
    const publicDir = path.join(__dirname, 'public');
    app.use(express.static(publicDir));

    // Health check endpoint (for Render, UptimeRobot, BetterStack)
    app.get('/health', (req, res) => {
        const isReady = client && typeof client.isReady === 'function' ? client.isReady() : false;
        res.status(200).json({
            status: 'healthy',
            service: 'bounded-discord-bot',
            botOnline: isReady,
            botTag: client?.user?.tag || null,
            botId: client?.user?.id || null,
            guilds: client?.guilds?.cache?.size || 0,
            uptimeSeconds: Math.floor(process.uptime()),
            uptimeFormatted: formatUptime(process.uptime()),
            timestamp: Date.now()
        });
    });

    // Quick ping endpoint
    app.get('/ping', (req, res) => {
        res.status(200).send('pong');
    });

    // Live statistics API for the website dashboard
    app.get('/api/stats', (req, res) => {
        let totalMembers = 0;
        let guildsCount = 0;
        let ping = 0;

        if (client && client.guilds && client.guilds.cache) {
            guildsCount = client.guilds.cache.size;
            totalMembers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
            ping = Math.round(client.ws?.ping || 0);
        }

        res.json({
            online: true,
            guilds: guildsCount,
            members: totalMembers,
            ping: ping,
            uptime: process.uptime(),
            uptimeFormatted: formatUptime(process.uptime()),
            bot: client?.user ? {
                id: client.user.id,
                tag: client.user.tag,
                username: client.user.username,
                avatarUrl: client.user.displayAvatarURL ? client.user.displayAvatarURL() : null
            } : null
        });
    });

    // Fallback middleware serves index.html for any unmatched route
    app.use((req, res) => {
        res.sendFile(path.join(publicDir, 'index.html'));
    });

    const server = app.listen(PORT, HOST, () => {
        console.log(`\x1b[32m[WEB SERVER] Website & Health API listening on http://${HOST}:${PORT}\x1b[0m`);
        console.log(`[WEB SERVER] Render Keep-Alive endpoint available at /health`);
    });

    return server;
}

module.exports = { startWebServer };
