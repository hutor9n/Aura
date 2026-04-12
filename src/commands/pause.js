const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');
const { deferIfInteraction, ensureVoiceAccess, replyText } = require('./commandUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Поставить музыку на паузу или снять с паузы'),
    name: 'pause',
    description: 'Поставить музыку на паузу или снять с паузы',
    async execute(interactionOrMessage) {
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

        queue.node.setPaused(!queue.node.isPaused());
        const text = queue.node.isPaused()
            ? '⏸️ Музыка поставлена на паузу! (Напиши `/pause` чтобы продолжить)'
            : '▶️ Музыка снята с паузы!';

        return replyText(interactionOrMessage, text);
    },
};
