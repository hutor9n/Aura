const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');
const { deferIfInteraction, ensureVoiceAccess, replyText } = require('./commandUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Остановить музыку и очистить очередь'),
    name: 'stop',
    description: 'Остановить музыку и очистить очередь',
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

        queue.delete();
        const text = '🛑 Музыка остановлена, очередь очищена!';
        return replyText(interactionOrMessage, text);
    },
};
