const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const DB_PATH = path.join(__dirname, 'levels.json');
let data = { guilds: {} };
let saveTimeout = null;

// Role IDs for leveling milestones
const LEVEL_ROLES = {
    5: '1569136411821477948',   // Level 5 (GIF Permissions)
    15: '1569136413465645137',  // Level 15
    25: '1569136416221302865',  // Level 25
    50: '1569136417681051689',  // Level 50
    100: '1569136418859655168', // Level 100
    200: '1569136421644537887'  // Level 200
};

// Cooldown between XP gains per user (60 seconds)
const XP_COOLDOWN_MS = 60 * 1000;
const MIN_XP = 15;
const MAX_XP = 25;

function loadData() {
    try {
        if (fs.existsSync(DB_PATH)) {
            data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
            if (!data.guilds) data.guilds = {};
        }
    } catch (err) {
        console.error('[LEVELS] Failed to load levels.json:', err);
        data = { guilds: {} };
    }
}

function saveDataNow() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error('[LEVELS] Failed to save levels.json:', err);
    }
}

function scheduleSave() {
    if (saveTimeout) return;
    saveTimeout = setTimeout(() => {
        saveTimeout = null;
        fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8', (err) => {
            if (err) console.error('[LEVELS] Async save failed:', err);
        });
    }, 2000);
}

loadData();

function ensureUser(guildId, userId) {
    if (!data.guilds[guildId]) {
        data.guilds[guildId] = { users: {} };
    }
    if (!data.guilds[guildId].users[userId]) {
        data.guilds[guildId].users[userId] = {
            xp: 0,
            level: 0,
            totalXp: 0,
            messages: 0,
            lastXp: 0
        };
    }
    return data.guilds[guildId].users[userId];
}

/**
 * XP needed to advance from level to level + 1
 * Standard Discord curve: 5 * (lvl ^ 2) + 50 * lvl + 100
 */
function xpForNextLevel(level) {
    return 5 * (level * level) + 50 * level + 100;
}

/**
 * Total XP required from level 0 to reach a target level
 */
function totalXpForLevel(targetLevel) {
    let total = 0;
    for (let i = 0; i < targetLevel; i++) {
        total += xpForNextLevel(i);
    }
    return total;
}

/**
 * Get user level data
 */
function getUserData(guildId, userId) {
    const user = ensureUser(guildId, userId);
    const needed = xpForNextLevel(user.level);
    return {
        level: user.level,
        xp: user.xp,
        neededXp: needed,
        totalXp: user.totalXp,
        messages: user.messages,
        lastXp: user.lastXp
    };
}

/**
 * Record message activity and calculate XP gain
 */
function addMessageXp(guildId, userId) {
    const user = ensureUser(guildId, userId);
    const now = Date.now();

    // Check 60-second XP cooldown
    if (user.lastXp && (now - user.lastXp) < XP_COOLDOWN_MS) {
        user.messages = (user.messages || 0) + 1;
        scheduleSave();
        return { earned: false, reason: 'cooldown' };
    }

    // Generate random XP between MIN_XP and MAX_XP
    const earnedXp = Math.floor(Math.random() * (MAX_XP - MIN_XP + 1)) + MIN_XP;
    user.xp = (user.xp || 0) + earnedXp;
    user.totalXp = (user.totalXp || 0) + earnedXp;
    user.messages = (user.messages || 0) + 1;
    user.lastXp = now;

    const oldLevel = user.level || 0;
    let leveledUp = false;

    // Check for level ups
    while (user.xp >= xpForNextLevel(user.level)) {
        user.xp -= xpForNextLevel(user.level);
        user.level += 1;
        leveledUp = true;
    }

    const newLevel = user.level;
    const unlockedRoles = [];

    if (leveledUp) {
        for (const [lvlStr, roleId] of Object.entries(LEVEL_ROLES)) {
            const reqLvl = parseInt(lvlStr, 10);
            if (oldLevel < reqLvl && newLevel >= reqLvl) {
                unlockedRoles.push({ level: reqLvl, roleId });
            }
        }
    }

    scheduleSave();

    return {
        earned: true,
        xpEarned: earnedXp,
        oldLevel,
        newLevel,
        leveledUp,
        unlockedRoles,
        currentXp: user.xp,
        neededXp: xpForNextLevel(user.level),
        totalXp: user.totalXp
    };
}

/**
 * Admin: Add XP directly to a user
 */
function addAdminXp(guildId, userId, amount) {
    if (isNaN(amount) || amount <= 0) return null;
    const user = ensureUser(guildId, userId);
    const oldLevel = user.level || 0;

    user.xp = (user.xp || 0) + amount;
    user.totalXp = (user.totalXp || 0) + amount;

    let leveledUp = false;
    while (user.xp >= xpForNextLevel(user.level)) {
        user.xp -= xpForNextLevel(user.level);
        user.level += 1;
        leveledUp = true;
    }

    const newLevel = user.level;
    const unlockedRoles = [];
    if (leveledUp) {
        for (const [lvlStr, roleId] of Object.entries(LEVEL_ROLES)) {
            const reqLvl = parseInt(lvlStr, 10);
            if (oldLevel < reqLvl && newLevel >= reqLvl) {
                unlockedRoles.push({ level: reqLvl, roleId });
            }
        }
    }

    scheduleSave();
    return { oldLevel, newLevel, leveledUp, unlockedRoles, user };
}

/**
 * Admin: Set exact level for a user
 */
function setAdminLevel(guildId, userId, targetLevel) {
    if (isNaN(targetLevel) || targetLevel < 0) return null;
    const user = ensureUser(guildId, userId);
    const oldLevel = user.level || 0;

    user.level = targetLevel;
    user.xp = 0;
    user.totalXp = totalXpForLevel(targetLevel);

    const unlockedRoles = [];
    for (const [lvlStr, roleId] of Object.entries(LEVEL_ROLES)) {
        const reqLvl = parseInt(lvlStr, 10);
        if (oldLevel < reqLvl && targetLevel >= reqLvl) {
            unlockedRoles.push({ level: reqLvl, roleId });
        }
    }

    scheduleSave();
    return { oldLevel, newLevel: targetLevel, unlockedRoles, user };
}

/**
 * Admin: Reset user progress
 */
function resetUserData(guildId, userId) {
    const user = ensureUser(guildId, userId);
    user.xp = 0;
    user.level = 0;
    user.totalXp = 0;
    user.messages = 0;
    user.lastXp = 0;
    scheduleSave();
    return true;
}

/**
 * Synchronize all deserved level roles for a member
 */
async function syncMemberRoles(member, level) {
    if (!member || !member.roles || !member.guild) return [];
    const addedRoles = [];

    for (const [lvlStr, roleId] of Object.entries(LEVEL_ROLES)) {
        const reqLvl = parseInt(lvlStr, 10);
        if (level >= reqLvl) {
            if (!member.roles.cache.has(roleId)) {
                try {
                    await member.roles.add(roleId);
                    addedRoles.push({ level: reqLvl, roleId });
                } catch (err) {
                    console.warn(`[LEVELS] Could not assign role ${roleId} to ${member.user?.tag || member.id}:`, err.message);
                }
            }
        }
    }

    return addedRoles;
}

/**
 * Get sorted leaderboard for a guild
 */
function getLeaderboard(guildId, limit = 10) {
    const guildData = data.guilds[guildId];
    if (!guildData || !guildData.users) return [];

    const entries = Object.entries(guildData.users).map(([userId, u]) => ({
        userId,
        level: u.level || 0,
        xp: u.xp || 0,
        totalXp: u.totalXp || 0,
        messages: u.messages || 0
    }));

    // Sort by totalXp descending
    entries.sort((a, b) => b.totalXp - a.totalXp);

    return entries.slice(0, limit).map((entry, index) => ({
        rank: index + 1,
        ...entry
    }));
}

/**
 * Find a specific user's leaderboard rank
 */
function getUserRank(guildId, userId) {
    const guildData = data.guilds[guildId];
    if (!guildData || !guildData.users) return { rank: 1, total: 1 };

    const entries = Object.entries(guildData.users).map(([id, u]) => ({
        userId: id,
        totalXp: u.totalXp || 0
    }));

    entries.sort((a, b) => b.totalXp - a.totalXp);
    const idx = entries.findIndex(e => e.userId === userId);
    return {
        rank: idx >= 0 ? idx + 1 : entries.length + 1,
        total: Math.max(1, entries.length)
    };
}

/**
 * Progress bar visual generator
 */
function generateProgressBar(current, max, size = 12) {
    const percentage = Math.min(1, Math.max(0, current / (max || 1)));
    const filled = Math.round(size * percentage);
    const empty = size - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Build rich rank embed card
 */
function buildRankEmbed(targetUser, member, rankInfo, serverName, color = 0x18191C) {
    const { level, xp, neededXp, totalXp, messages } = rankInfo.userData;
    const { rank, total } = rankInfo.rankData;
    const progressPercent = Math.min(100, Math.floor((xp / neededXp) * 100));
    const progressBar = generateProgressBar(xp, neededXp, 12);

    // Determine role rewards status
    const roleLines = Object.entries(LEVEL_ROLES).map(([lvlStr, roleId]) => {
        const reqLvl = parseInt(lvlStr, 10);
        const unlocked = level >= reqLvl;
        const icon = unlocked ? '✅' : '🔒';
        const perkNote = reqLvl === 5 ? ' **(GIF Permissions 🖼️)**' : '';
        return `${icon} **Lvl ${reqLvl}** — <@&${roleId}>${perkNote}`;
    }).join('\n');

    // Find next milestone
    let nextMilestone = null;
    for (const [lvlStr, roleId] of Object.entries(LEVEL_ROLES)) {
        const reqLvl = parseInt(lvlStr, 10);
        if (level < reqLvl) {
            const xpLeft = totalXpForLevel(reqLvl) - totalXp;
            nextMilestone = `**Level ${reqLvl}** (<@&${roleId}>) • \`${Math.max(0, xpLeft).toLocaleString()} XP\` remaining`;
            break;
        }
    }
    if (!nextMilestone) {
        nextMilestone = '👑 **Max Milestone Reached!** (Level 200+)';
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: `${targetUser.username} • Activity & Level Card`,
            iconURL: targetUser.displayAvatarURL({ dynamic: true })
        })
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .setDescription(
            `### 🎖️ Level **${level}**\n` +
            `\`${progressBar}\` **${progressPercent}%**\n` +
            `**${xp.toLocaleString()}** / **${neededXp.toLocaleString()} XP** *(Total: \`${totalXp.toLocaleString()} XP\`)*`
        )
        .addFields(
            { name: '🏆 Server Rank', value: `\`#${rank}\` of ${total} active chatters`, inline: true },
            { name: '💬 Messages Sent', value: `\`${(messages || 0).toLocaleString()}\` messages`, inline: true },
            { name: '🎯 Next Perk Milestone', value: nextMilestone, inline: false },
            { name: '🎁 Milestone Role Perks', value: roleLines, inline: false }
        )
        .setFooter({ text: `${serverName || 'Server'} Activity • Chat more to climb levels!` })
        .setTimestamp();

    return embed;
}

/**
 * Build rich leaderboard embed
 */
function buildLeaderboardEmbed(guild, leaderboard, authorRank, authorLevel, color = 0x362F1E) {
    const medals = ['🥇', '🥈', '🥉'];
    let desc = '';

    if (leaderboard.length === 0) {
        desc = 'No chat activity recorded yet! Start chatting in channels to earn XP.';
    } else {
        desc = leaderboard.map(entry => {
            const badge = medals[entry.rank - 1] || `**#${entry.rank}**`;
            return `${badge} <@${entry.userId}> — **Level ${entry.level}** • \`${entry.totalXp.toLocaleString()} XP\` *(💬 ${entry.messages} msgs)*`;
        }).join('\n\n');
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: `${guild.name} • Activity & Levels Leaderboard`,
            iconURL: guild.iconURL({ dynamic: true }) || undefined
        })
        .setTitle('🏆 Top Server Chatters')
        .setDescription(desc)
        .addFields({
            name: '📍 Your Position',
            value: `Rank: **#${authorRank}** • Level: **${authorLevel}**`,
            inline: false
        })
        .setFooter({ text: 'Earn 15-25 XP per minute by chatting in text channels!' })
        .setTimestamp();

    return embed;
}

/**
 * Build level roles summary embed
 */
function buildRoleRewardsEmbed(guild, color = 0x18191C) {
    const roleLines = Object.entries(LEVEL_ROLES).map(([lvlStr, roleId]) => {
        const reqLvl = parseInt(lvlStr, 10);
        const perkNote = reqLvl === 5 ? ' — **GIF Permissions 🖼️** *(Send GIFs & Embed media)*' : '';
        return `• **Level ${reqLvl}**: <@&${roleId}>${perkNote}`;
    }).join('\n');

    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: `${guild.name} • Level Perks & Role Rewards`,
            iconURL: guild.iconURL({ dynamic: true }) || undefined
        })
        .setTitle('🎁 Milestone Roles & Unlocks')
        .setDescription(
            `The more you chat, the higher your level! Unlock exclusive roles and permissions automatically as you reach activity milestones:\n\n` +
            roleLines + '\n\n' +
            `*💡 Tip: When you reach **Level 5**, you automatically get role <@&${LEVEL_ROLES[5]}> with GIF permissions!*`
        )
        .setFooter({ text: 'Check your current rank anytime with .levels or .rank' })
        .setTimestamp();
}

module.exports = {
    LEVEL_ROLES,
    getUserData,
    addMessageXp,
    addAdminXp,
    setAdminLevel,
    resetUserData,
    syncMemberRoles,
    getLeaderboard,
    getUserRank,
    xpForNextLevel,
    totalXpForLevel,
    generateProgressBar,
    buildRankEmbed,
    buildLeaderboardEmbed,
    buildRoleRewardsEmbed
};
