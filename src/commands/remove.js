const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Удалить трек из очереди по номеру')
        .addIntegerOption(option =>
            option
                .setName('position')
                .setDescription('Номер трека в очереди')
                .setRequired(true)
                .setMinValue(1)
        ),
    name: 'remove',
    description: 'Удалить трек из очереди по номеру',
    async execute(interactionOrMessage, args) {
        const isInteraction = typeof interactionOrMessage?.isChatInputCommand === 'function' && interactionOrMessage.isChatInputCommand();
        if (isInteraction) {
            await interactionOrMessage.deferReply({ ephemeral: false });
        }

        const player = useMainPlayer();
        const queue = player.nodes.get(interactionOrMessage.guild.id);

        if (!queue || queue.tracks.size === 0) {
            const text = 'Очередь пустая.';
            if (isInteraction) return interactionOrMessage.editReply({ content: text });
            return interactionOrMessage.reply(text);
        }

        const position = isInteraction
            ? interactionOrMessage.options.getInteger('position')
            : args?.[0] ? Number(args[0]) : NaN;

        if (!position || Number.isNaN(position) || position < 1) {
            const text = 'Укажи корректный номер трека в очереди.';
            if (isInteraction) return interactionOrMessage.editReply({ content: text });
            return interactionOrMessage.reply(text);
        }

        const track = queue.tracks.toArray()[position - 1];
        if (!track) {
            const text = `Трека под номером ${position} нет в очереди.`;
            if (isInteraction) return interactionOrMessage.editReply({ content: text });
            return interactionOrMessage.reply(text);
        }

        queue.removeTrack(track);
        const text = `Удалён трек **${track.title}** из очереди.`;
        if (isInteraction) return interactionOrMessage.editReply({ content: text });
        return interactionOrMessage.reply(text);
    }
};
