const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');

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

        const level = isInteraction
            ? interactionOrMessage.options.getInteger('level')
            : args?.[0] ? Number(args[0]) : undefined;

        if (level == null || Number.isNaN(level)) {
            const text = `Текущая громкость: **${queue.node.volume}**`;
            if (isInteraction) return interactionOrMessage.editReply({ content: text });
            return interactionOrMessage.reply(text);
        }

        queue.node.setVolume(level);
        const text = `Громкость установлена на **${level}**.`;
        if (isInteraction) return interactionOrMessage.editReply({ content: text });
        return interactionOrMessage.reply(text);
    }
};
