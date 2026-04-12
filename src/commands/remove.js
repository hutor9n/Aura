const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');
const { isInteractionCommand, deferIfInteraction, ensureVoiceAccess, replyText } = require('./commandUtils');

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
        const isInteraction = isInteractionCommand(interactionOrMessage);
        await deferIfInteraction(interactionOrMessage, { ephemeral: false });

        const player = useMainPlayer();
        const queue = player.nodes.get(interactionOrMessage.guild.id);

        if (!queue || queue.tracks.size === 0) {
            return replyText(interactionOrMessage, 'Очередь пустая.');
        }

        const hasAccess = await ensureVoiceAccess(interactionOrMessage, queue, {
            requireQueue: false,
            requirePlaying: false,
            requireSameChannel: true
        });

        if (!hasAccess) {
            return;
        }

        const position = isInteraction
            ? interactionOrMessage.options.getInteger('position')
            : args?.[0] ? Number(args[0]) : NaN;

        if (!position || Number.isNaN(position) || position < 1) {
            return replyText(interactionOrMessage, 'Укажи корректный номер трека в очереди.');
        }

        const track = queue.tracks.toArray()[position - 1];
        if (!track) {
            return replyText(interactionOrMessage, `Трека под номером ${position} нет в очереди.`);
        }

        queue.removeTrack(track);
        return replyText(interactionOrMessage, `Удалён трек **${track.title}** из очереди.`);
    }
};
