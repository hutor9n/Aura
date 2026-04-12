const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');
const { isInteractionCommand, deferIfInteraction, ensureVoiceAccess, replyText } = require('./commandUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Пропустить один или несколько треков')
        .addIntegerOption(option =>
            option
                .setName('count')
                .setDescription('Сколько треков пропустить (по умолчанию 1)')
                .setMinValue(1)
                .setRequired(false)
        ),
    name: 'skip',
    description: 'Пропустить один или несколько треков',
    async execute(interactionOrMessage, args) {
        const isInteraction = isInteractionCommand(interactionOrMessage);
        await deferIfInteraction(interactionOrMessage, { ephemeral: true });

        const player = useMainPlayer();
        const queue = player.nodes.get(interactionOrMessage.guild.id);
        const hasAccess = await ensureVoiceAccess(interactionOrMessage, queue, {
            requireQueue: true,
            requirePlaying: true,
            requireSameChannel: true
        });

        if (!hasAccess) {
            return;
        }

        const count = isInteraction
            ? interactionOrMessage.options.getInteger('count') ?? 1
            : args?.[0] ? Math.max(1, Number(args[0])) : 1;

        if (!Number.isInteger(count) || count < 1) {
            const text = 'Укажи правильное количество треков для пропуска.';
            return replyText(interactionOrMessage, text);
        }

        let skipped = 0;
        for (let i = 0; i < count; i++) {
            const result = queue.node.skip();
            if (!result) break;
            skipped += 1;
            if (!queue.isPlaying()) break;
        }

        const text = skipped === 0
            ? 'Не удалось пропустить треки.'
            : skipped === 1
                ? '⏭️ Трек пропущен!'
                : `⏭️ Пропущено ${skipped} трек${skipped === 2 ? 'а' : skipped > 4 ? 'ов' : 'а'}!`;

        return replyText(interactionOrMessage, text);
    },
};
