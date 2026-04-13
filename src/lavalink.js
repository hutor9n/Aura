const { Shoukaku, Connectors } = require('shoukaku');
const { QueueRepeatMode } = require('discord-player');

const guildState = new Map();

function isConfigured() {
    return Boolean(process.env.LAVALINK_HOST && process.env.LAVALINK_PORT && process.env.LAVALINK_PASSWORD);
}

function createDefaultState() {
    return {
        currentTrack: null,
        queue: [],
        paused: false,
        volume: 100,
        repeatMode: QueueRepeatMode.OFF,
        shuffling: false
    };
}

function getState(guildId) {
    if (!guildState.has(guildId)) {
        guildState.set(guildId, createDefaultState());
    }

    return guildState.get(guildId);
}

function resetState(guildId) {
    guildState.set(guildId, createDefaultState());
}

function normalizeSearchQuery(query) {
    const value = String(query || '').trim();
    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    return `ytsearch:${value}`;
}

function extractTracks(result) {
    if (!result) return [];
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.data?.tracks)) return result.data.tracks;
    if (Array.isArray(result?.tracks)) return result.tracks;
    if (result?.data?.encoded) return [result.data];
    return [];
}

function firstNode(client) {
    const nodes = Array.from(client.lavalink.nodes.values());
    return nodes.find((n) => n.state === 'CONNECTED' || n.state === 2) || nodes[0] || null;
}

async function getOrCreatePlayer(client, guildId, voiceChannelId, shardId) {
    const existing = client.lavalink.players.get(guildId);
    if (existing) {
        return existing;
    }

    return client.lavalink.joinVoiceChannel({
        guildId,
        channelId: voiceChannelId,
        shardId,
        deaf: true
    });
}

async function startTrack(player, track) {
    const encoded = track.encoded || track.track;
    if (!encoded) {
        throw new Error('Track has no encoded payload');
    }

    await player.playTrack({ track: encoded });
}

async function playNext(client, guildId) {
    const state = getState(guildId);
    const player = client.lavalink.players.get(guildId);

    if (!player) {
        resetState(guildId);
        return;
    }

    if (state.repeatMode === QueueRepeatMode.TRACK && state.currentTrack) {
        await startTrack(player, state.currentTrack);
        state.paused = false;
        return;
    }

    if (state.repeatMode === QueueRepeatMode.QUEUE && state.currentTrack) {
        state.queue.push(state.currentTrack);
    }

    const nextTrack = state.queue.shift();
    if (!nextTrack) {
        state.currentTrack = null;
        state.paused = false;
        return;
    }

    await startTrack(player, nextTrack);
    state.currentTrack = nextTrack;
    state.paused = false;
}

function attachPlayerEvents(client, player, guildId) {
    if (player.__auraAttached) {
        return;
    }

    const onEnd = async (payload = {}) => {
        const reason = payload?.reason || payload?.data?.reason;
        if (reason === 'REPLACED' || reason === 'STOPPED') {
            return;
        }

        try {
            await playNext(client, guildId);
        } catch (error) {
            console.error('[Lavalink] Ошибка воспроизведения следующего трека:', error);
        }
    };

    player.on('end', onEnd);
    player.on('trackEnd', onEnd);
    player.on('closed', () => resetState(guildId));
    player.on('destroyed', () => resetState(guildId));

    player.__auraAttached = true;
}

function initLavalink(client) {
    if (!isConfigured()) {
        client.lavalinkEnabled = false;
        return;
    }

    client.lavalink = new Shoukaku(
        new Connectors.DiscordJS(client),
        [
            {
                name: 'optiklink',
                url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
                auth: process.env.LAVALINK_PASSWORD,
                secure: String(process.env.LAVALINK_SECURE || 'true') === 'true'
            }
        ],
        {
            resumable: true,
            resumableTimeout: 60,
            moveOnDisconnect: false
        }
    );

    client.lavalinkEnabled = true;

    client.lavalink.on('ready', (name) => {
        console.log(`[Lavalink] Нода ${name} готова.`);
    });

    client.lavalink.on('error', (name, error) => {
        console.error(`[Lavalink] Ошибка ноды ${name}:`, error);
    });
}

function isLavalinkEnabled(client) {
    return Boolean(client?.lavalinkEnabled && client?.lavalink);
}

async function lavalinkPlay(client, { guildId, voiceChannelId, shardId, query }) {
    const node = firstNode(client);
    if (!node) {
        throw new Error('Нет доступной Lavalink ноды');
    }

    const result = await node.rest.resolve(normalizeSearchQuery(query));
    const tracks = extractTracks(result);

    if (!tracks.length) {
        return { track: null, queued: false };
    }

    const player = await getOrCreatePlayer(client, guildId, voiceChannelId, shardId);
    attachPlayerEvents(client, player, guildId);

    const state = getState(guildId);
    const chosen = tracks[0];

    if (state.currentTrack) {
        state.queue.push(chosen);
        return { track: chosen, queued: true };
    }

    await startTrack(player, chosen);
    state.currentTrack = chosen;
    state.paused = false;

    return { track: chosen, queued: false };
}

function hasActivePlayback(client, guildId) {
    return Boolean(getState(guildId).currentTrack);
}

function getLavalinkControlState(client, guildId) {
    const state = getState(guildId);
    return {
        node: {
            isPaused: () => state.paused
        },
        isShuffling: state.shuffling,
        repeatMode: state.repeatMode
    };
}

function getQueueSize(client, guildId) {
    return getState(guildId).queue.length;
}

function getVolume(client, guildId) {
    return getState(guildId).volume;
}

async function togglePause(client, guildId) {
    const player = client.lavalink.players.get(guildId);
    const state = getState(guildId);

    if (!player || !state.currentTrack) {
        return null;
    }

    const paused = !state.paused;
    await player.setPaused(paused);
    state.paused = paused;
    return paused;
}

async function skipTrack(client, guildId) {
    const player = client.lavalink.players.get(guildId);
    const state = getState(guildId);

    if (!player || !state.currentTrack) {
        return false;
    }

    if (!state.queue.length) {
        state.currentTrack = null;
        state.paused = false;
        await player.stopTrack();
        return true;
    }

    await playNext(client, guildId);
    return true;
}

async function stopPlayback(client, guildId) {
    const player = client.lavalink.players.get(guildId);
    resetState(guildId);

    if (!player) {
        return false;
    }

    await player.stopTrack();
    await player.disconnect();
    return true;
}

async function setVolume(client, guildId, level) {
    const player = client.lavalink.players.get(guildId);
    const state = getState(guildId);

    if (!player) {
        return false;
    }

    await player.setGlobalVolume(level);
    state.volume = level;
    return true;
}

function toggleShuffle(client, guildId) {
    const state = getState(guildId);
    state.shuffling = !state.shuffling;

    if (state.shuffling && state.queue.length > 1) {
        for (let i = state.queue.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
        }
    }

    return state.shuffling;
}

function cycleRepeatMode(client, guildId) {
    const state = getState(guildId);

    if (state.repeatMode === QueueRepeatMode.OFF) {
        state.repeatMode = QueueRepeatMode.TRACK;
    } else if (state.repeatMode === QueueRepeatMode.TRACK) {
        state.repeatMode = QueueRepeatMode.QUEUE;
    } else {
        state.repeatMode = QueueRepeatMode.OFF;
    }

    return state.repeatMode;
}

module.exports = {
    initLavalink,
    isLavalinkEnabled,
    lavalinkPlay,
    getLavalinkControlState,
    hasActivePlayback,
    getQueueSize,
    getVolume,
    togglePause,
    skipTrack,
    stopPlayback,
    setVolume,
    toggleShuffle,
    cycleRepeatMode
};
