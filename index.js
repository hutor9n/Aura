require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, Events } = require('discord.js');
const { Player } = require('discord-player');
const fs = require('fs');
const path = require('path');

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

client.commands = new Collection();

// Автоматическая подгрузка команд из папки src/commands
const commandsPath = path.join(__dirname, 'src/commands');

if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
}

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
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
        console.log('[INFO] Очищаю старые guild slash-команды во всех серверах...');
        for (const guild of client.guilds.cache.values()) {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: [] });
            console.log(`[INFO] Очищены guild slash-команды в гильдии ${guild.id}`);
        }

        console.log('[INFO] Регистрирую глобальные slash-команды...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('[INFO] Глобальные slash-команды зарегистрированы.');
    } catch (error) {
        console.error('[ERROR] Не удалось зарегистрировать slash-команды:', error);
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '❌ Произошла ошибка при выполнении команды.', ephemeral: true });
        } else {
            await interaction.reply({ content: '❌ Произошла ошибка при выполнении команды.', ephemeral: true });
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
    channel.send(queueMessage).catch(console.error);
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
        await loadExtractors();
        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        console.error('[ERROR] Не удалось инициализировать бота:', error);
        process.exit(1);
    }
}

// Запускаем
bootstrap();
