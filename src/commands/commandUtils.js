const { MessageFlags } = require('discord.js');

function isInteractionCommand(ctx) {
    return typeof ctx?.isChatInputCommand === 'function' && ctx.isChatInputCommand();
}

async function deferIfInteraction(ctx, options) {
    if (!isInteractionCommand(ctx)) {
        return false;
    }

    if (ctx.deferred || ctx.replied) {
        return true;
    }

    if (isInteractionCommand(ctx) && !ctx.deferred && !ctx.replied) {
        const deferOptions = { ...(options || {}) };
        if ('ephemeral' in deferOptions) {
            if (deferOptions.ephemeral) {
                deferOptions.flags = MessageFlags.Ephemeral;
            }
            delete deferOptions.ephemeral;
        }

        try {
            if (Object.keys(deferOptions).length === 0) {
                await ctx.deferReply();
            } else {
                await ctx.deferReply(deferOptions);
            }
            return true;
        } catch (error) {
            if (error?.code === 10062 || error?.code === 40060) {
                // Interaction истёк или уже подтвержден в другом процессе.
                return false;
            }
            throw error;
        }
    }

    return false;
}

function getBotVoiceChannel(ctx) {
    return ctx.guild?.members?.me?.voice?.channel || null;
}

function getMemberVoiceChannel(ctx) {
    return ctx.member?.voice?.channel || null;
}

async function replyText(ctx, text) {
    if (isInteractionCommand(ctx)) {
        try {
            if (ctx.deferred || ctx.replied) {
                return await ctx.editReply({ content: text });
            }
            return await ctx.reply({ content: text });
        } catch (error) {
            if ((error?.code === 10062 || error?.code === 40060) && ctx.channel) {
                return ctx.channel.send(text);
            }
            throw error;
        }
    }

    return ctx.reply(text);
}

async function ensureVoiceAccess(ctx, queue, options = {}) {
    const {
        requireQueue = true,
        requirePlaying = false,
        requireSameChannel = true,
        checkBotPermissions = false
    } = options;

    if (requireQueue && !queue) {
        await replyText(ctx, 'Сейчас ничего не играет.');
        return false;
    }

    if (requirePlaying && (!queue || !queue.isPlaying())) {
        await replyText(ctx, 'Сейчас ничего не играет!');
        return false;
    }

    const memberVoiceChannel = getMemberVoiceChannel(ctx);
    if (!memberVoiceChannel) {
        await replyText(ctx, 'Зайди в голосовой канал, чтобы управлять воспроизведением.');
        return false;
    }

    const botVoiceChannel = getBotVoiceChannel(ctx);
    if (requireSameChannel && botVoiceChannel && memberVoiceChannel.id !== botVoiceChannel.id) {
        await replyText(ctx, 'Ты должен быть в том же голосовом канале, что и бот.');
        return false;
    }

    if (checkBotPermissions) {
        const permissions = memberVoiceChannel.permissionsFor(ctx.client.user);
        if (!permissions?.has('Connect') || !permissions?.has('Speak')) {
            await replyText(ctx, 'У меня нет прав на подключение и разговор в этом голосовом канале!');
            return false;
        }
    }

    return true;
}

module.exports = {
    isInteractionCommand,
    deferIfInteraction,
    getMemberVoiceChannel,
    replyText,
    ensureVoiceAccess
};
