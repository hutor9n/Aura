const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');

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

        const count = isInteraction
            ? interactionOrMessage.options.getInteger('count') ?? 1
            : args?.[0] ? Math.max(1, Number(args[0])) : 1;

        if (!Number.isInteger(count) || count < 1) {
            const text = 'Укажи правильное количество треков для пропуска.';
            if (isInteraction) return interactionOrMessage.editReply({ content: text });
            return interactionOrMessage.reply(text);
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

        if (isInteraction) return interactionOrMessage.editReply({ content: text });
        return interactionOrMessage.reply(text);
    },
};
