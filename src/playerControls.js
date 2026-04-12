const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { QueueRepeatMode } = require('discord-player');

const CONTROL_PREFIX = 'playerctl';

function getRepeatLabel(mode) {
    if (mode === QueueRepeatMode.TRACK) return 'Repeat: Трек';
    if (mode === QueueRepeatMode.QUEUE) return 'Repeat: Очередь';
    return 'Repeat: Off';
}

function getNextRepeatMode(mode) {
    if (mode === QueueRepeatMode.OFF) return QueueRepeatMode.TRACK;
    if (mode === QueueRepeatMode.TRACK) return QueueRepeatMode.QUEUE;
    return QueueRepeatMode.OFF;
}

function createPlayerControlComponents(queue) {
    const isPaused = Boolean(queue?.node?.isPaused?.());

    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${CONTROL_PREFIX}:pause`)
                .setLabel(isPaused ? 'Продолжить' : 'Пауза')
                .setEmoji(isPaused ? '▶️' : '⏸️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`${CONTROL_PREFIX}:skip`)
                .setLabel('Скип')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`${CONTROL_PREFIX}:stop`)
                .setLabel('Стоп')
                .setEmoji('⏹️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`${CONTROL_PREFIX}:shuffle`)
                .setLabel(queue?.isShuffling ? 'Shuffle: On' : 'Shuffle: Off')
                .setEmoji('🔀')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`${CONTROL_PREFIX}:repeat`)
                .setLabel(getRepeatLabel(queue?.repeatMode))
                .setEmoji('🔁')
                .setStyle(ButtonStyle.Secondary)
        )
    ];
}

module.exports = {
    CONTROL_PREFIX,
    createPlayerControlComponents,
    getNextRepeatMode
};
