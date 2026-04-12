const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');

function formatTrack(track) {
    if (!track) return '—';
    if (track.url) {
        return `[${track.title}](${track.url})`;
    }
    return track.title;
}

function formatQueueDescription(queue) {
    const currentTrack = queue.currentTrack;
    const upcomingTracks = queue.tracks.toArray();

    const lines = [];

    if (currentTrack) {
        lines.push(`▶️ **Сейчас играет:** ${formatTrack(currentTrack)}`);
    } else {
        lines.push('▶️ Сейчас ничего не играет.');
    }

    if (upcomingTracks.length > 0) {
        lines.push('\n⏭️ **Следующие треки:**');
        const maxItems = 8;
        upcomingTracks.slice(0, maxItems).forEach((track, index) => {
            lines.push(`**${index + 1}.** ${formatTrack(track)} (${track.duration || '??:??'})`);
        });
        if (upcomingTracks.length > maxItems) {
            lines.push(`
и ещё **${upcomingTracks.length - maxItems}** треков...`);
        }
    } else {
        lines.push('\n⏭️ Следующих треков нет.');
    }

    const totalDuration = queue.durationFormatted || '0:00';
    lines.push(`\n📜 **Очередь:** ${upcomingTracks.length} ${upcomingTracks.length === 1 ? 'трек' : 'треков'} | Общая длина: **${totalDuration}**`);

    return lines.join('\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Показать текущую очередь треков'),
    name: 'queue',
    description: 'Показать текущую очередь треков',
    async execute(interactionOrMessage) {
        const isInteraction = typeof interactionOrMessage?.isChatInputCommand === 'function' && interactionOrMessage.isChatInputCommand();
        if (isInteraction) {
            await interactionOrMessage.deferReply();
        }

        const player = useMainPlayer();
        const queue = player.nodes.get(interactionOrMessage.guild.id);

        if (!queue || (!queue.isPlaying() && queue.tracks.size === 0)) {
            const text = 'Сейчас ничего не играет и очередь пуста.';
            if (isInteraction) {
                return interactionOrMessage.editReply({ content: text });
            }
            return interactionOrMessage.reply(text);
        }

        const description = formatQueueDescription(queue);
        const embed = new EmbedBuilder()
            .setTitle('Текущая очередь')
            .setDescription(description)
            .setColor(0x1db954)
            .setTimestamp();

        if (queue.currentTrack?.thumbnail) {
            embed.setThumbnail(queue.currentTrack.thumbnail);
        }

        if (isInteraction) {
            return interactionOrMessage.editReply({ embeds: [embed] });
        }

        return interactionOrMessage.reply({ embeds: [embed] });
    }
};
