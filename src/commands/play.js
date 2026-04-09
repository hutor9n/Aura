const { useMainPlayer } = require('discord-player');
const youtubedl = require('youtube-dl-exec');

function extractYoutubeVideoId(input) {
    try {
        const url = new URL(input);
        const host = url.hostname.toLowerCase();

        if (host === 'youtu.be') {
            const shortId = url.pathname.replace(/^\//, '').split('/')[0];
            return shortId || null;
        }

        if (host.endsWith('youtube.com')) {
            if (url.pathname === '/watch') {
                return url.searchParams.get('v');
            }

            if (url.pathname.startsWith('/shorts/')) {
                const shortsId = url.pathname.replace('/shorts/', '').split('/')[0];
                return shortsId || null;
            }
        }

        return null;
    } catch {
        return null;
    }
}

function normalizeYoutubeQuery(input) {
    const videoId = extractYoutubeVideoId(input);

    if (!videoId) {
        return input;
    }

    return `https://www.youtube.com/watch?v=${videoId}`;
}

async function resolveYoutubeDirectAudioUrl(input) {
    const result = await youtubedl(input, {
        dumpSingleJson: true,
        noWarnings: true,
        skipDownload: true,
        format: 'bestaudio/best'
    });

    if (!result || !Array.isArray(result.formats)) {
        return null;
    }

    const audioFormats = result.formats.filter(f => {
        const hasUrl = typeof f.url === 'string' && f.url.length > 0;
        const hasAudio = (f.acodec && f.acodec !== 'none') || f.vcodec === 'none';
        return hasUrl && hasAudio;
    });

    const bestAudio = audioFormats
        .sort((a, b) => (Number(b.abr) || 0) - (Number(a.abr) || 0))[0];

    return bestAudio?.url || null;
}

module.exports = {
    name: 'play',
    description: 'Включить музыку',
    async execute(message, args) {
        const player = useMainPlayer();
        const query = args.join(' ');
        const youtubeiIdentifier = 'com.retrouser955.discord-player.discord-player-youtubei';
        const logPrefix = `[PLAY][${message.guild?.id || 'no-guild'}]`;
        
        if (!query) {
            return message.reply('Братанчик, напиши название трека или ссылку! Пример: `!play Король и Шут`');
        }

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('Братулёк, тебе нужно зайти в голосовой канал сначала!');
        }

        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return message.reply('У меня нет прав на подключение и разговор в этом голосовом канале!');
        }

        try {
            message.channel.send(`🔍 Ищу трек: **${query}**...`);

            const isYoutubeQuery = /(?:youtu\.be|youtube\.com)/i.test(query);
            const isSpotifyQuery = /(?:open\.spotify\.com|spotify:)/i.test(query);
            const normalizedQuery = isYoutubeQuery ? normalizeYoutubeQuery(query) : query;

            console.log(`${logPrefix} query="${query}"`);
            console.log(`${logPrefix} source=${isYoutubeQuery ? 'youtube' : isSpotifyQuery ? 'spotify' : 'generic'} extractor=${isYoutubeQuery ? youtubeiIdentifier : 'auto'}`);

            if (isYoutubeQuery && normalizedQuery !== query) {
                console.log(`${logPrefix} normalized_youtube_query="${normalizedQuery}"`);
            }

            if (isSpotifyQuery) {
                console.log(`${logPrefix} spotify_link_detected=true; playback_source_will_be_bridged_by_extractor (often youtube)`);
            }
            
            // Проигрываем трек и сохраняем текстовый канал (metadata) для уведомлений 'playerStart'
            await player.play(voiceChannel, normalizedQuery, {
                searchEngine: isYoutubeQuery ? `ext:${youtubeiIdentifier}` : undefined,
                nodeOptions: {
                    leaveOnEnd: false,
                    leaveOnStop: false,
                    leaveOnEmpty: true,
                    leaveOnEmptyCooldown: 0,
                    metadata: {
                        channel: message.channel
                    }
                }
            });

            console.log(`${logPrefix} play_success=true stage=primary`);

            return;
            
        } catch (e) {
            const isNoResultError = e?.code === 'ERR_NO_RESULT';
            const isYoutubeQuery = /(?:youtu\.be|youtube\.com)/i.test(query);
            const normalizedQuery = isYoutubeQuery ? normalizeYoutubeQuery(query) : query;
            const youtubeVideoId = isYoutubeQuery ? extractYoutubeVideoId(query) : null;

            console.warn(`${logPrefix} play_error code=${e?.code || 'unknown'} message="${e?.message || 'unknown'}"`);

            if (isYoutubeQuery && isNoResultError) {
                console.log(`${logPrefix} fallback_stage=normalized_query attempt=true query="${normalizedQuery}"`);
                try {
                    await player.play(voiceChannel, normalizedQuery, {
                        searchEngine: `ext:${youtubeiIdentifier}`,
                        nodeOptions: {
                            leaveOnEnd: false,
                            leaveOnStop: false,
                            leaveOnEmpty: true,
                            leaveOnEmptyCooldown: 0,
                            metadata: {
                                channel: message.channel
                            }
                        }
                    });

                    console.log(`${logPrefix} play_success=true stage=normalized_query`);

                    return;
                } catch (retryError) {
                    console.warn(`${logPrefix} fallback_failed stage=normalized_query code=${retryError?.code || 'unknown'} message="${retryError?.message || 'unknown'}"`);

                    if (youtubeVideoId) {
                        console.log(`${logPrefix} fallback_stage=video_id attempt=true video_id=${youtubeVideoId}`);
                        try {
                            await player.play(voiceChannel, youtubeVideoId, {
                                searchEngine: `ext:${youtubeiIdentifier}`,
                                nodeOptions: {
                                    leaveOnEnd: false,
                                    leaveOnStop: false,
                                    leaveOnEmpty: true,
                                    leaveOnEmptyCooldown: 0,
                                    metadata: {
                                        channel: message.channel
                                    }
                                }
                            });

                            console.log(`${logPrefix} play_success=true stage=video_id`);

                            return;
                        } catch {
                            try {
                                console.log(`${logPrefix} fallback_stage=yt_dlp_direct_audio attempt=true`);
                                const directAudioUrl = await resolveYoutubeDirectAudioUrl(normalizedQuery);

                                if (!directAudioUrl) {
                                    throw new Error('No direct audio stream URL from yt-dlp');
                                }

                                await player.play(voiceChannel, directAudioUrl, {
                                    nodeOptions: {
                                        leaveOnEnd: false,
                                        leaveOnStop: false,
                                        leaveOnEmpty: true,
                                        leaveOnEmptyCooldown: 0,
                                        metadata: {
                                            channel: message.channel
                                        }
                                    }
                                });

                                console.log(`${logPrefix} play_success=true stage=yt_dlp_direct_audio`);

                                await message.channel.send('ℹ️ Основной YouTube-экстрактор не дал результат, использован резервный источник потока.');
                                return;
                            } catch (ytDlpError) {
                                console.warn(`${logPrefix} fallback_failed stage=yt_dlp_direct_audio message="${ytDlpError?.message || 'unknown'}"`);
                                console.error(retryError);
                                console.error(ytDlpError);
                                return message.channel.send('❌ Не удалось найти или извлечь этот YouTube-трек. Видео может быть недоступно в вашем регионе, приватным или заблокированным. Попробуй другую ссылку или название трека.');
                            }
                        }
                    }

                    try {
                        console.log(`${logPrefix} fallback_stage=yt_dlp_direct_audio attempt=true`);
                        const directAudioUrl = await resolveYoutubeDirectAudioUrl(normalizedQuery);

                        if (!directAudioUrl) {
                            throw new Error('No direct audio stream URL from yt-dlp');
                        }

                        await player.play(voiceChannel, directAudioUrl, {
                            nodeOptions: {
                                leaveOnEnd: false,
                                leaveOnStop: false,
                                leaveOnEmpty: true,
                                leaveOnEmptyCooldown: 0,
                                metadata: {
                                    channel: message.channel
                                }
                            }
                        });

                        console.log(`${logPrefix} play_success=true stage=yt_dlp_direct_audio`);

                        await message.channel.send('ℹ️ Основной YouTube-экстрактор не дал результат, использован резервный источник потока.');
                        return;
                    } catch (ytDlpError) {
                        console.warn(`${logPrefix} fallback_failed stage=yt_dlp_direct_audio message="${ytDlpError?.message || 'unknown'}"`);
                        console.error(retryError);
                        console.error(ytDlpError);
                        return message.channel.send('❌ Не удалось найти или извлечь этот YouTube-трек. Видео может быть недоступно в вашем регионе, приватным или заблокированным. Попробуй другую ссылку или название трека.');
                    }
                }
            }

            console.error(e);
            return message.channel.send(`❌ Ошибка при воспроизведении: \n${e.message}`);
        }
    },
};
