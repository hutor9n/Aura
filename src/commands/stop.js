const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');
const { deferIfInteraction, ensureVoiceAccess, replyText } = require('./commandUtils');
const { isLavalinkEnabled, hasActivePlayback, stopPlayback } = require('../lavalink');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Остановить музыку и очистить очередь'),
    name: 'stop',
    description: 'Остановить музыку и очистить очередь',
    async execute(interactionOrMessage) {
        await deferIfInteraction(interactionOrMessage, { ephemeral: true });

        if (isLavalinkEnabled(interactionOrMessage.client)) {
            const memberVoiceChannel = interactionOrMessage.member?.voice?.channel;
            const botVoiceChannel = interactionOrMessage.guild?.members?.me?.voice?.channel;

            if (!hasActivePlayback(interactionOrMessage.client, interactionOrMessage.guild.id)) {
                return replyText(interactionOrMessage, 'Сейчас ничего не играет!');
            }

            if (!memberVoiceChannel) {
                return replyText(interactionOrMessage, 'Зайди в голосовой канал, чтобы управлять воспроизведением.');
            }

            if (botVoiceChannel && memberVoiceChannel.id !== botVoiceChannel.id) {
                return replyText(interactionOrMessage, 'Ты должен быть в том же голосовом канале, что и бот.');
            }

            await stopPlayback(interactionOrMessage.client, interactionOrMessage.guild.id);
            return replyText(interactionOrMessage, '🛑 Музыка остановлена, очередь очищена!');
        }

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
