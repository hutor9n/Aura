const { SlashCommandBuilder } = require('discord.js');
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

function getTrackSource(track) {
    const rawSource = String(track.source || track.extractor?.identifier || '').toLowerCase();
    if (rawSource.includes('youtube')) return 'YouTube';
    if (rawSource.includes('spotify')) return 'Spotify';
    if (rawSource.includes('soundcloud')) return 'SoundCloud';
    if (rawSource.includes('youtubemusic')) return 'YouTube Music';
    if (rawSource.includes('apple')) return 'Apple Music';
    if (rawSource.includes('deezer')) return 'Deezer';
    if (rawSource.includes('tidal')) return 'Tidal';
    if (rawSource.includes('bandcamp')) return 'Bandcamp';
    if (!rawSource) return 'Неизвестно';
    return rawSource[0].toUpperCase() + rawSource.slice(1);
}

function formatTrackLink(track) {
    if (track.url) {
        return track.toHyperlink();
    }
    return `**${track.title}**`;
}

function formatQueueStatus(queue) {
    const currentTrack = queue.currentTrack;
    const tracks = queue.tracks.toArray();
    const nextTrack = tracks[0];
    const queueLines = tracks.map((track, index) => `**${index + 1}.** ${formatTrackLink(track)} (${getTrackSource(track)})`).join('\n');

    const lines = [];
    if (currentTrack) {
        lines.push(`▶️ Сейчас играет: ${formatTrackLink(currentTrack)}`);
        lines.push(`🌐 Источник: ${getTrackSource(currentTrack)}`);
    } else {
        lines.push('▶️ Сейчас ничего не играет');
    }

    if (nextTrack) {
        lines.push(`⏭️ Следующий: ${formatTrackLink(nextTrack)} (${getTrackSource(nextTrack)})`);
    } else {
        lines.push('⏭️ Следующего трека нет');
    }

    if (tracks.length) {
        lines.push(`\n📜 Очередь (${tracks.length}):`, queueLines);
    } else {
        lines.push('\n📜 Очередь пуста');
    }

    return lines.join('\n');
}

function sendQueueStatusMessage(message, queue, track, addedToQueue) {
    const header = addedToQueue
        ? `✅ Трек добавлен в очередь: ${formatTrackLink(track)} (${getTrackSource(track)})`
        : `▶️ Воспроизведение: ${formatTrackLink(track)}`;

    return message.channel.send(`${header}\n\n${formatQueueStatus(queue)}`);
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
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Включить музыку')
        .addStringOption(option =>
            option
                .setName('query')
                .setDescription('Название трека или ссылка')
                .setRequired(true)
        ),
    name: 'play',
    description: 'Включить музыку',
    async execute(interactionOrMessage, args) {
        const isInteraction = typeof interactionOrMessage?.isChatInputCommand === 'function' && interactionOrMessage.isChatInputCommand();
        const query = isInteraction
            ? interactionOrMessage.options.getString('query')
            : Array.isArray(args)
                ? args.join(' ')
                : '';

        const player = useMainPlayer();
        const youtubeiIdentifier = 'com.retrouser955.discord-player.discord-player-youtubei';
        const logPrefix = `[PLAY][${interactionOrMessage.guild?.id || 'no-guild'}]`;
        const nodeMetadata = {
            channel: interactionOrMessage.channel,
            skipStartMessage: true
        };

        if (!query) {
            const errorText = 'Братанчик, напиши название трека или ссылку! Пример: `!play Король и Шут`';
            if (isInteraction) {
                if (!interactionOrMessage.deferred) await interactionOrMessage.deferReply({ ephemeral: true });
                return interactionOrMessage.editReply({ content: errorText });
            }
            return interactionOrMessage.reply(errorText);
        }

        if (isInteraction) {
            await interactionOrMessage.deferReply({ ephemeral: true });
            await interactionOrMessage.followUp(`🔍 Ищу трек: **${query}**...`);
        } else {
            interactionOrMessage.channel.send(`🔍 Ищу трек: **${query}**...`);
        }

        const voiceChannel = interactionOrMessage.member.voice.channel;
        if (!voiceChannel) {
            const errorText = 'Братулёк, тебе нужно зайти в голосовой канал сначала!';
            if (isInteraction) {
                return interactionOrMessage.editReply({ content: errorText });
            }
            return interactionOrMessage.reply(errorText);
        }

        const permissions = voiceChannel.permissionsFor(interactionOrMessage.client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            const errorText = 'У меня нет прав на подключение и разговор в этом голосовом канале!';
            if (isInteraction) {
                return interactionOrMessage.editReply({ content: errorText });
            }
            return interactionOrMessage.reply(errorText);
        }

        try {
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

            const primaryResult = await player.play(voiceChannel, normalizedQuery, {
                searchEngine: isYoutubeQuery ? `ext:${youtubeiIdentifier}` : undefined,
                nodeOptions: {
                    leaveOnEnd: false,
                    leaveOnStop: false,
                    leaveOnEmpty: true,
                    leaveOnEmptyCooldown: 0,
                    metadata: nodeMetadata
                }
            });

            const wasQueued = primaryResult.queue.tracks.toArray().some((track) => track.id === primaryResult.track.id);
            await sendQueueStatusMessage(interactionOrMessage, primaryResult.queue, primaryResult.track, wasQueued);

            console.log(`${logPrefix} play_success=true stage=primary queued=${wasQueued}`);

            if (isInteraction) {
                return interactionOrMessage.editReply({ content: '✅ Трек добавлен в очередь и сообщение отправлено в канал.' });
            }
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
                    const normalizedResult = await player.play(voiceChannel, normalizedQuery, {
                        searchEngine: `ext:${youtubeiIdentifier}`,
                        nodeOptions: {
                            leaveOnEnd: false,
                            leaveOnStop: false,
                            leaveOnEmpty: true,
                            leaveOnEmptyCooldown: 0,
                            metadata: nodeMetadata
                        }
                    });

                    const wasQueued = normalizedResult.queue.tracks.toArray().some((track) => track.id === normalizedResult.track.id);
                    await sendQueueStatusMessage(interactionOrMessage, normalizedResult.queue, normalizedResult.track, wasQueued);

                    console.log(`${logPrefix} play_success=true stage=normalized_query queued=${wasQueued}`);

                    if (isInteraction) {
                        return interactionOrMessage.editReply({ content: '✅ Трек добавлен в очередь и сообщение отправлено в канал.' });
                    }
                    return;
                } catch (retryError) {
                    console.warn(`${logPrefix} fallback_failed stage=normalized_query code=${retryError?.code || 'unknown'} message="${retryError?.message || 'unknown'}"`);

                    if (youtubeVideoId) {
                        console.log(`${logPrefix} fallback_stage=video_id attempt=true video_id=${youtubeVideoId}`);
                        try {
                            const videoIdResult = await player.play(voiceChannel, youtubeVideoId, {
                                searchEngine: `ext:${youtubeiIdentifier}`,
                                nodeOptions: {
                                    leaveOnEnd: false,
                                    leaveOnStop: false,
                                    leaveOnEmpty: true,
                                    leaveOnEmptyCooldown: 0,
                                    metadata: nodeMetadata
                                }
                            });

                            const wasQueued = videoIdResult.queue.tracks.toArray().some((track) => track.id === videoIdResult.track.id);
                            await sendQueueStatusMessage(interactionOrMessage, videoIdResult.queue, videoIdResult.track, wasQueued);

                            console.log(`${logPrefix} play_success=true stage=video_id queued=${wasQueued}`);

                            if (isInteraction) {
                                return interactionOrMessage.editReply({ content: '✅ Трек добавлен в очередь и сообщение отправлено в канал.' });
                            }
                            return;
                        } catch {
                            try {
                                console.log(`${logPrefix} fallback_stage=yt_dlp_direct_audio attempt=true`);
                                const directAudioUrl = await resolveYoutubeDirectAudioUrl(normalizedQuery);

                                if (!directAudioUrl) {
                                    throw new Error('No direct audio stream URL from yt-dlp');
                                }

                                const directAudioResult = await player.play(voiceChannel, directAudioUrl, {
                                    nodeOptions: {
                                        leaveOnEnd: false,
                                        leaveOnStop: false,
                                        leaveOnEmpty: true,
                                        leaveOnEmptyCooldown: 0,
                                        metadata: nodeMetadata
                                    }
                                });

                                const wasQueued = directAudioResult.queue.tracks.toArray().some((track) => track.id === directAudioResult.track.id);
                                await sendQueueStatusMessage(interactionOrMessage, directAudioResult.queue, directAudioResult.track, wasQueued);

                                console.log(`${logPrefix} play_success=true stage=yt_dlp_direct_audio queued=${wasQueued}`);

                                if (isInteraction) {
                                    await interactionOrMessage.followUp('ℹ️ Основной YouTube-экстрактор не дал результат, использован резервный источник потока.');
                                    return interactionOrMessage.editReply({ content: '✅ Трек добавлен в очередь и сообщение отправлено в канал.' });
                                }
                                await interactionOrMessage.channel.send('ℹ️ Основной YouTube-экстрактор не дал результат, использован резервный источник потока.');
                                return;
                            } catch (ytDlpError) {
                                console.warn(`${logPrefix} fallback_failed stage=yt_dlp_direct_audio message="${ytDlpError?.message || 'unknown'}"`);
                                console.error(retryError);
                                console.error(ytDlpError);
                                const errorMessage = '❌ Не удалось найти или извлечь этот YouTube-трек. Видео может быть недоступно в вашем регионе, приватным или заблокированным. Попробуй другую ссылку или название трека.';
                                if (isInteraction) {
                                    return interactionOrMessage.editReply({ content: errorMessage });
                                }
                                return interactionOrMessage.channel.send(errorMessage);
                            }
                        }
                    }

                    try {
                        console.log(`${logPrefix} fallback_stage=yt_dlp_direct_audio attempt=true`);
                        const directAudioUrl = await resolveYoutubeDirectAudioUrl(normalizedQuery);

                        if (!directAudioUrl) {
                            throw new Error('No direct audio stream URL from yt-dlp');
                        }

                        const directAudioResult = await player.play(voiceChannel, directAudioUrl, {
                            nodeOptions: {
                                leaveOnEnd: false,
                                leaveOnStop: false,
                                leaveOnEmpty: true,
                                leaveOnEmptyCooldown: 0,
                                metadata: nodeMetadata
                            }
                        });

                        const wasQueued = directAudioResult.queue.tracks.toArray().some((track) => track.id === directAudioResult.track.id);
                        await sendQueueStatusMessage(interactionOrMessage, directAudioResult.queue, directAudioResult.track, wasQueued);

                        console.log(`${logPrefix} play_success=true stage=yt_dlp_direct_audio queued=${wasQueued}`);

                        if (isInteraction) {
                            await interactionOrMessage.followUp('ℹ️ Основной YouTube-экстрактор не дал результат, использован резервный источник потока.');
                            return interactionOrMessage.editReply({ content: '✅ Трек добавлен в очередь и сообщение отправлено в канал.' });
                        }
                        await interactionOrMessage.channel.send('ℹ️ Основной YouTube-экстрактор не дал результат, использован резервный источник потока.');
                        return;
                    } catch (ytDlpError) {
                        console.warn(`${logPrefix} fallback_failed stage=yt_dlp_direct_audio message="${ytDlpError?.message || 'unknown'}"`);
                        console.error(retryError);
                        console.error(ytDlpError);
                        const errorMessage = '❌ Не удалось найти или извлечь этот YouTube-трек. Видео может быть недоступно в вашем регионе, приватным или заблокированным. Попробуй другую ссылку или название трека.';
                        if (isInteraction) {
                            return interactionOrMessage.editReply({ content: errorMessage });
                        }
                        return interactionOrMessage.channel.send(errorMessage);
                    }
                }
            }

            console.error(e);
            const errorMessage = `❌ Ошибка при воспроизведении: \n${e.message}`;
            if (isInteraction) {
                return interactionOrMessage.editReply({ content: errorMessage });
            }
            return interactionOrMessage.channel.send(errorMessage);
        }
    },
};