require('dotenv').config();
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const player = new Player(client);

(async () => {
    console.log("Loading extractors...");
    try {
        await player.extractors.loadMulti(DefaultExtractors);
        const { YoutubeiExtractor } = require('discord-player-youtubei');
        await player.extractors.register(YoutubeiExtractor, {
            disablePlayer: true,
            ignoreSignInErrors: true,
            overrideBridgeMode: 'yt',
            streamOptions: {
                useClient: 'ANDROID'
            },
            cookie: process.env.YOUTUBE_COOKIE || undefined
        });
        console.log("Extractors loaded:", player.extractors.store.map(e => e.identifier));

        // Attempting search without voice
        const queries = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "never gonna give you up"
        ];

        let foundTracks = 0;
        for (const q of queries) {
            const res = await player.search(q, {
                searchEngine: `ext:${YoutubeiExtractor.identifier}`
            });

            const count = Array.isArray(res?.tracks) ? res.tracks.length : 0;
            console.log(`Search result for \"${q}\":`, count);

            if (count > foundTracks) {
                foundTracks = count;
            }
        }

        if (foundTracks === 0) {
            throw new Error('Search completed, but no tracks were returned for any test query');
        }

        console.log("Best search result:", foundTracks);
        console.log('Extractor smoke test passed');
        process.exit(0);
    } catch (e) {
        console.error("Extractor smoke test failed:", e);
        process.exit(1);
    }
})();
