const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');
const { isInteractionCommand, deferIfInteraction, ensureVoiceAccess, replyText } = require('./commandUtils');
const { isLavalinkEnabled, hasActivePlayback, setVolume, getVolume } = require('../lavalink');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Установить громкость плеера или посмотреть текущую')
        .addIntegerOption(option =>
            option
                .setName('level')
                .setDescription('Громкость от 0 до 100')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(100)
        ),
    name: 'volume',
    description: 'Установить громкость плеера или посмотреть текущую',
    async execute(interactionOrMessage, args) {
        const isInteraction = isInteractionCommand(interactionOrMessage);
        await deferIfInteraction(interactionOrMessage, { ephemeral: false });

        if (isLavalinkEnabled(interactionOrMessage.client)) {
            const memberVoiceChannel = interactionOrMessage.member?.voice?.channel;
            const botVoiceChannel = interactionOrMessage.guild?.members?.me?.voice?.channel;

            if (!hasActivePlayback(interactionOrMessage.client, interactionOrMessage.guild.id)) {
                return replyText(interactionOrMessage, 'Сейчас ничего не играет.');
            }

            if (!memberVoiceChannel) {
                return replyText(interactionOrMessage, 'Зайди в голосовой канал, чтобы управлять воспроизведением.');
            }

            if (botVoiceChannel && memberVoiceChannel.id !== botVoiceChannel.id) {
                return replyText(interactionOrMessage, 'Ты должен быть в том же голосовом канале, что и бот.');
            }

            const level = isInteraction
                ? interactionOrMessage.options.getInteger('level')
                : args?.[0] ? Number(args[0]) : undefined;

            if (level == null || Number.isNaN(level)) {
                return replyText(interactionOrMessage, `Текущая громкость: **${getVolume(interactionOrMessage.client, interactionOrMessage.guild.id)}**`);
            }

            await setVolume(interactionOrMessage.client, interactionOrMessage.guild.id, level);
            return replyText(interactionOrMessage, `Громкость установлена на **${level}**.`);
        }

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

        const level = isInteraction
            ? interactionOrMessage.options.getInteger('level')
            : args?.[0] ? Number(args[0]) : undefined;

        if (level == null || Number.isNaN(level)) {
            return replyText(interactionOrMessage, `Текущая громкость: **${queue.node.volume}**`);
        }

        queue.node.setVolume(level);
        return replyText(interactionOrMessage, `Громкость установлена на **${level}**.`);
    }
};
