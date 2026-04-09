const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Включить или выключить режим случайного перемешивания очереди')
        .addStringOption(option =>
            option
                .setName('mode')
                .setDescription('on/off/toggle')
                .setRequired(false)
                .addChoices(
                    { name: 'on', value: 'on' },
                    { name: 'off', value: 'off' },
                    { name: 'toggle', value: 'toggle' }
                )
        ),
    name: 'shuffle',
    description: 'Включить или выключить режим случайного перемешивания очереди',
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

        const mode = isInteraction
            ? interactionOrMessage.options.getString('mode')
            : args?.[0]?.toLowerCase();

        let enabled;
        if (!mode || mode === 'toggle') {
            enabled = queue.toggleShuffle(true);
        } else if (mode === 'on') {
            enabled = queue.enableShuffle(true);
        } else if (mode === 'off') {
            enabled = queue.disableShuffle();
        } else {
            const text = 'Неверный режим. Используй on, off или toggle.';
            if (isInteraction) return interactionOrMessage.editReply({ content: text });
            return interactionOrMessage.reply(text);
        }

        const status = queue.isShuffling ? 'включён' : 'выключен';
        const text = `Shuffle ${status}.`;
        if (isInteraction) return interactionOrMessage.editReply({ content: text });
        return interactionOrMessage.reply(text);
    }
};
