const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');
const { deferIfInteraction, ensureVoiceAccess, replyText } = require('./commandUtils');
const { isLavalinkEnabled, hasActivePlayback, togglePause } = require('../lavalink');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Поставить музыку на паузу или снять с паузы'),
    name: 'pause',
    description: 'Поставить музыку на паузу или снять с паузы',
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

            const paused = await togglePause(interactionOrMessage.client, interactionOrMessage.guild.id);
            if (paused == null) {
                return replyText(interactionOrMessage, 'Сейчас ничего не играет!');
            }

            return replyText(interactionOrMessage, paused
                ? '⏸️ Музыка поставлена на паузу! (Напиши `/pause` чтобы продолжить)'
                : '▶️ Музыка снята с паузы!');
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

        queue.node.setPaused(!queue.node.isPaused());
        const text = queue.node.isPaused()
            ? '⏸️ Музыка поставлена на паузу! (Напиши `/pause` чтобы продолжить)'
            : '▶️ Музыка снята с паузы!';

        return replyText(interactionOrMessage, text);
    },
};
