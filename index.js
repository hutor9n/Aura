require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, Events, MessageFlags } = require('discord.js');
const { Player, QueueRepeatMode } = require('discord-player');
const fs = require('fs');
const path = require('path');
const { CONTROL_PREFIX, createPlayerControlComponents, getNextRepeatMode } = require('./src/playerControls');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Инициализация Discord Player
const player = new Player(client);

const { DefaultExtractors } = require('@discord-player/extractor');
const { YoutubeiExtractor } = require('discord-player-youtubei');

client.extractorsReady = false;
let extractorLoadPromise = null;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }

    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function normalizeCommandForCompare(command) {
    return {
        name: command.name,
        description: command.description,
        options: command.options || [],
        dm_permission: command.dm_permission,
        default_member_permissions: command.default_member_permissions,
        type: command.type,
        nsfw: command.nsfw
    };
}

function areSlashCommandsEqual(current, next) {
    const currentNormalized = current.map(normalizeCommandForCompare).sort((a, b) => a.name.localeCompare(b.name));
    const nextNormalized = next.map(normalizeCommandForCompare).sort((a, b) => a.name.localeCompare(b.name));
    return stableStringify(currentNormalized) === stableStringify(nextNormalized);
}

// Загружаем стандартные экстракторы (YouTube, Spotify, SoundCloud и т.д.)
async function loadExtractors() {
    await player.extractors.loadMulti(DefaultExtractors);
    // Регистрируем современный независимый YouTube-экстрактор
    await player.extractors.register(YoutubeiExtractor, {
        // Часто помогает обойти ошибки вида "Failed to extract signature/n decipher function"
        disablePlayer: true,
        ignoreSignInErrors: true,
        overrideBridgeMode: 'yt',
        useYoutubeDL: true,
        useServerAbrStream: true,
        streamOptions: {
            useClient: 'ANDROID'
        },
        cookie: process.env.YOUTUBE_COOKIE || undefined
    });
}

async function ensureExtractorsReady(maxAttempts = 4) {
    if (client.extractorsReady) {
        return true;
    }

    if (extractorLoadPromise) {
        return extractorLoadPromise;
    }

    extractorLoadPromise = (async () => {
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                await loadExtractors();
                client.extractorsReady = true;
                console.log(`[INFO] Экстракторы загружены (attempt ${attempt}/${maxAttempts}).`);
                return true;
            } catch (error) {
                console.error(`[WARN] Не удалось загрузить экстракторы (attempt ${attempt}/${maxAttempts}):`, error?.message || error);
                if (attempt < maxAttempts) {
                    await sleep(1500 * attempt);
                }
            }
        }

        return false;
    })();

    try {
        return await extractorLoadPromise;
    } finally {
        extractorLoadPromise = null;
    }
}

client.ensureExtractorsReady = ensureExtractorsReady;

client.commands = new Collection();

// Автоматическая подгрузка команд из папки src/commands
const commandsPath = path.join(__dirname, 'src/commands');

if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
}

const commandFiles = fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'))
    .filter(file => file !== 'commandUtils.js');
const slashCommands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('name' in command && 'execute' in command) {
        client.commands.set(command.name, command);
        if ('data' in command) {
            slashCommands.push(command.data.toJSON());
        }
    } else {
        console.log(`[WARNING] В файле команды ${filePath} отсутствует "name" или "execute".`);
    }
}

client.on('ready', async () => {
    console.log(`[INFO] Залогинен как ${client.user.tag}!`);
    console.log(`[INFO] Бот успешно запущен и готов играть музло.`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        const currentCommands = await rest.get(Routes.applicationCommands(client.user.id));
        if (areSlashCommandsEqual(currentCommands, slashCommands)) {
            console.log('[INFO] Slash-команды не изменились, пропускаю перерегистрацию.');
        } else {
            console.log('[INFO] Обновляю глобальные slash-команды...');
            await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
            console.log('[INFO] Глобальные slash-команды обновлены.');
        }
    } catch (error) {
        console.error('[ERROR] Не удалось зарегистрировать slash-команды:', error);
    }

    ensureExtractorsReady().catch((error) => {
        console.error('[WARN] Фоновый прогрев экстракторов завершился ошибкой:', error);
    });
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith(`${CONTROL_PREFIX}:`)) {
        const queue = player.nodes.get(interaction.guildId);

        if (!queue) {
            await interaction.reply({
                content: 'Сейчас ничего не играет.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const memberVoiceChannel = interaction.member?.voice?.channel;
        const botVoiceChannel = interaction.guild?.members?.me?.voice?.channel;

        if (!memberVoiceChannel) {
            await interaction.reply({
                content: 'Зайди в голосовой канал, чтобы управлять воспроизведением.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (botVoiceChannel && memberVoiceChannel.id !== botVoiceChannel.id) {
            await interaction.reply({
                content: 'Ты должен быть в том же голосовом канале, что и бот.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const action = interaction.customId.split(':')[1];
        let resultText = 'Готово.';

        if (action === 'pause') {
            const newPausedState = !queue.node.isPaused();
            queue.node.setPaused(newPausedState);
            resultText = newPausedState ? '⏸️ Пауза включена.' : '▶️ Воспроизведение продолжено.';
        } else if (action === 'skip') {
            const skipped = queue.node.skip();
            resultText = skipped ? '⏭️ Трек пропущен.' : 'Не удалось пропустить трек.';
        } else if (action === 'stop') {
            queue.delete();
            await interaction.update({ components: [] });
            await interaction.followUp({ content: '🛑 Воспроизведение остановлено и очередь очищена.', flags: MessageFlags.Ephemeral });
            return;
        } else if (action === 'shuffle') {
            queue.toggleShuffle(true);
            resultText = queue.isShuffling ? '🔀 Shuffle включен.' : '🔀 Shuffle выключен.';
        } else if (action === 'repeat') {
            const nextMode = getNextRepeatMode(queue.repeatMode);
            queue.setRepeatMode(nextMode);
            if (nextMode === QueueRepeatMode.TRACK) resultText = '🔁 Repeat: Трек';
            else if (nextMode === QueueRepeatMode.QUEUE) resultText = '🔁 Repeat: Очередь';
            else resultText = '🔁 Repeat: Off';
        }

        await interaction.update({
            components: createPlayerControlComponents(queue)
        });

        await interaction.followUp({
            content: resultText,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '❌ Произошла ошибка при выполнении команды.', flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: '❌ Произошла ошибка при выполнении команды.', flags: MessageFlags.Ephemeral });
        }
    }
});

function formatQueueMessage(queue, currentTrack) {
    const tracks = queue.tracks.toArray();
    const upcoming = tracks.map((track, index) => `**${index + 1}.** ${track.title}`).join('\n') || 'Пусто';
    const nextTrack = tracks[0] ? `**Следующий:** ${tracks[0].title}` : 'В очереди нет следующего трека';

    return [
        `🎵 **Сейчас играет:** ${currentTrack.title}`,
        nextTrack,
        `
📜 **Очередь (${tracks.length}):**`,
        upcoming
    ].join('\n');
}

client.on('messageCreate', async message => {
    // Игнорируем других ботов и сообщения без префикса
    const prefix = '!';
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);

    if (!command) return;

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('❌ Произошла ошибка при выполнении этой команды!');
    }
});

// События плеера для отправки сообщений при старте трека
player.events.on('playerStart', (queue, track) => {
    if (queue.metadata?.skipStartMessage) {
        queue.metadata.skipStartMessage = false;
        return;
    }

    const channel = queue.metadata?.channel;
    if (!channel) return;

    const queueMessage = formatQueueMessage(queue, track);
    channel.send({
        content: queueMessage,
        components: createPlayerControlComponents(queue)
    }).catch(console.error);
});

player.events.on('emptyQueue', (queue) => {
    const channel = queue.metadata?.channel;
    if (!channel) return;

    channel.send('✅ Очередь закончилась, больше треков нет.').catch(console.error);
});

// Обработчики ошибок плеера (обязательны в новых версиях)
player.events.on('error', (queue, error) => {
    console.error(`[Player Error] Общая ошибка: ${error.message}`);
});

player.events.on('playerError', (queue, error) => {
    console.error(`[Player Error] Ошибка аудио-плеера: ${error.message}`);
});

// Если не нашли токен
if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === "ТВОЙ_ТОКЕН_СЮДА") {
    console.error("[ERROR] Вы не указали токен бота в файле .env!");
    process.exit(1);
}

async function bootstrap() {
    try {
        await client.login(process.env.DISCORD_TOKEN);
        const warmedUp = await ensureExtractorsReady();
        if (!warmedUp) {
            console.warn('[WARN] Бот запущен, но экстракторы пока не готовы. Первая команда /play может потребовать повторной попытки.');
        }
    } catch (error) {
        console.error('[ERROR] Не удалось инициализировать бота:', error);
        process.exit(1);
    }
}

process.on('unhandledRejection', (reason) => {
    console.error('[ERROR] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('[ERROR] Uncaught Exception:', error);
});

// Запускаем
bootstrap();
