const { useMainPlayer } = require('discord-player');

module.exports = {
    name: 'pause',
    description: 'Поставить музыку на паузу или снять с паузы',
    async execute(message) {
        const player = useMainPlayer();
        const queue = player.nodes.get(message.guild.id);
        const memberVoiceChannel = message.member.voice.channel;
        const botVoiceChannel = message.guild.members.me?.voice?.channel;

        if (!queue || !queue.isPlaying()) {
            return message.reply('Сейчас ничего не играет!');
        }

        if (!memberVoiceChannel) {
            return message.reply('Зайди в голосовой канал, чтобы управлять воспроизведением.');
        }

        if (botVoiceChannel && memberVoiceChannel.id !== botVoiceChannel.id) {
            return message.reply('Ты должен быть в том же голосовом канале, что и бот.');
        }

        queue.node.setPaused(!queue.node.isPaused());
        
        return message.reply(
            queue.node.isPaused() 
                ? '⏸️ Музыка поставлена на паузу! (Напиши `!pause` чтобы продолжить)' 
                : '▶️ Музыка снята с паузы!'
        );
    },
};
