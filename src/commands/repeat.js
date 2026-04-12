const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer, QueueRepeatMode } = require('discord-player');
const { isInteractionCommand, deferIfInteraction, ensureVoiceAccess, replyText } = require('./commandUtils');

const repeatModeNames = {
    off: 'OFF',
    track: 'TRACK',
    queue: 'QUEUE'
};

function formatRepeatMode(mode) {
    switch (mode) {
        case QueueRepeatMode.TRACK:
            return 'повтор трека';
        case QueueRepeatMode.QUEUE:
            return 'повтор очереди';
        default:
            return 'выключено';
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('repeat')
        .setDescription('Установить режим повторения очереди')
        .addStringOption(option =>
            option
                .setName('mode')
                .setDescription('off/track/queue')
                .setRequired(false)
                .addChoices(
                    { name: 'off', value: 'off' },
                    { name: 'track', value: 'track' },
                    { name: 'queue', value: 'queue' }
                )
        ),
    name: 'repeat',
    description: 'Установить режим повторения очереди',
    async execute(interactionOrMessage, args) {
        const isInteraction = isInteractionCommand(interactionOrMessage);
        await deferIfInteraction(interactionOrMessage, { ephemeral: false });

        const player = useMainPlayer();
        const queue = player.nodes.get(interactionOrMessage.guild.id);

        const hasAccess = await ensureVoiceAccess(interactionOrMessage, queue, {
            requireQueue: true,
            requirePlaying: false,
            requireSameChannel: true
        });

        if (!hasAccess) {
            return;
        }

        const mode = isInteraction
            ? interactionOrMessage.options.getString('mode')
            : args?.[0]?.toLowerCase();

        if (!mode) {
            return replyText(interactionOrMessage, `Текущий режим повторения: **${formatRepeatMode(queue.repeatMode)}**`);
        }

        if (!repeatModeNames[mode]) {
            return replyText(interactionOrMessage, 'Неверный режим. Используй off, track или queue.');
        }

        queue.setRepeatMode(QueueRepeatMode[repeatModeNames[mode]]);
        return replyText(interactionOrMessage, `Режим повторения установлен: **${formatRepeatMode(queue.repeatMode)}**`);
    }
};
