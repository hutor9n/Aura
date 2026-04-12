const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');
const { deferIfInteraction, ensureVoiceAccess, replyText } = require('./commandUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Очистить очередь треков'),
    name: 'clear',
    description: 'Очистить очередь треков',
    async execute(interactionOrMessage) {
        await deferIfInteraction(interactionOrMessage, { ephemeral: false });

        const player = useMainPlayer();
        const queue = player.nodes.get(interactionOrMessage.guild.id);

        if (!queue || queue.tracks.size === 0) {
            return replyText(interactionOrMessage, 'Очередь уже пуста.');
        }

        const hasAccess = await ensureVoiceAccess(interactionOrMessage, queue, {
            requireQueue: false,
            requirePlaying: false,
            requireSameChannel: true
        });

        if (!hasAccess) {
            return;
        }

        queue.clear();
        return replyText(interactionOrMessage, 'Очередь очищена.');
    }
};
