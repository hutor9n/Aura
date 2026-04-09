const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer, QueueRepeatMode } = require('discord-player');

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
        const isInteraction = typeof interactionOrMessage?.isChatInputCommand === 'function' && interactionOrMessage.isChatInputCommand();
        if (isInteraction) {
            await interactionOrMessage.deferReply({ ephemeral: false });
        }

        const player = useMainPlayer();
        const queue = player.nodes.get(interactionOrMessage.guild.id);

        if (!queue) {
            const text = 'Сейчас ничего не играет.';
            if (isInteraction) return interactionOrMessage.editReply({ content: text });
            return interactionOrMessage.reply(text);
        }

        const mode = isInteraction
            ? interactionOrMessage.options.getString('mode')
            : args?.[0]?.toLowerCase();

        if (!mode) {
            const text = `Текущий режим повторения: **${formatRepeatMode(queue.repeatMode)}**`;
            if (isInteraction) return interactionOrMessage.editReply({ content: text });
            return interactionOrMessage.reply(text);
        }

        if (!repeatModeNames[mode]) {
            const text = 'Неверный режим. Используй off, track или queue.';
            if (isInteraction) return interactionOrMessage.editReply({ content: text });
            return interactionOrMessage.reply(text);
        }

        queue.setRepeatMode(QueueRepeatMode[repeatModeNames[mode]]);
        const text = `Режим повторения установлен: **${formatRepeatMode(queue.repeatMode)}**`;
        if (isInteraction) return interactionOrMessage.editReply({ content: text });
        return interactionOrMessage.reply(text);
    }
};
