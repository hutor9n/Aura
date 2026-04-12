const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');
const { isInteractionCommand, deferIfInteraction, ensureVoiceAccess, replyText } = require('./commandUtils');

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
        const isInteraction = isInteractionCommand(interactionOrMessage);
        await deferIfInteraction(interactionOrMessage, { ephemeral: false });

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
            return replyText(interactionOrMessage, 'Неверный режим. Используй on, off или toggle.');
        }

        const status = queue.isShuffling ? 'включён' : 'выключен';
        return replyText(interactionOrMessage, `Shuffle ${status}.`);
    }
};
