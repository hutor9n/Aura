const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Пропустить текущий трек'),
    name: 'skip',
    description: 'Пропустить текущий трек',
    async execute(interactionOrMessage) {
        const isInteraction = typeof interactionOrMessage?.isChatInputCommand === 'function' && interactionOrMessage.isChatInputCommand();
        if (isInteraction) {
            await interactionOrMessage.deferReply({ ephemeral: true });
        }

        const player = useMainPlayer();
        const queue = player.nodes.get(interactionOrMessage.guild.id);
        const memberVoiceChannel = interactionOrMessage.member.voice.channel;
        const botVoiceChannel = interactionOrMessage.guild.members.me?.voice?.channel;

        if (!queue || !queue.isPlaying()) {
            const text = 'Сейчас ничего не играет!';
            if (isInteraction) return interactionOrMessage.editReply({ content: text });
            return interactionOrMessage.reply(text);
        }

        if (!memberVoiceChannel) {
            const text = 'Зайди в голосовой канал, чтобы управлять воспроизведением.';
            if (isInteraction) return interactionOrMessage.editReply({ content: text });
            return interactionOrMessage.reply(text);
        }

        if (botVoiceChannel && memberVoiceChannel.id !== botVoiceChannel.id) {
            const text = 'Ты должен быть в том же голосовом канале, что и бот.';
            if (isInteraction) return interactionOrMessage.editReply({ content: text });
            return interactionOrMessage.reply(text);
        }

        queue.node.skip();
        const text = '⏭️ Трек пропущен!';
        if (isInteraction) return interactionOrMessage.editReply({ content: text });
        return interactionOrMessage.reply(text);
    },
};
