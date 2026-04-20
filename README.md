# Aura Music Bot 🎵

Aura is a Discord music bot built with Node.js using `discord.js`, `discord-player`, and optional Lavalink support via `shoukaku`.

## Requirements
- Node.js 16.9.0 or newer (Node 18+ recommended)
- FFMPEG is bundled through `ffmpeg-static`

## Installation

1. Clone the repository or download the files.
2. Open a terminal in the project folder and install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file and add your Discord bot token:
   ```env
   DISCORD_TOKEN="YOUR_BOT_TOKEN"
   ```
4. Start the bot:
   ```bash
   npm start
   ```

## Optional Lavalink / OptikLink Setup

If you want to use Lavalink for audio playback, add these values to your `.env`:

```env
LAVALINK_HOST="your-node.optiklink.example"
LAVALINK_PORT="2333"
LAVALINK_PASSWORD="your_password"
LAVALINK_SECURE="true"
```

Behavior:
- If Lavalink variables are not set, the bot uses `discord-player` directly.
- If Lavalink is configured, playback commands and controls use the Lavalink node.

## Smoke Test

To verify extractor loading and search functionality:

```bash
npm test
```

or

```bash
npm run test:extractor
```

## Commands

The bot supports both legacy prefix commands with `!` and slash commands.

| Command | Description | Example |
|---------|-------------|---------|
| `!play <query|url>` | Search for and play a track in your voice channel | `!play never gonna give you up` |
| `!skip` | Skip the current track | `!skip` |
| `!pause` | Pause or resume playback | `!pause` |
| `!stop` | Stop playback and clear the queue | `!stop` |
| `!queue` | Show the current queue and now playing track | `!queue` |
| `!volume <1-100>` | Change the player volume | `!volume 80` |
| `!shuffle` | Shuffle the remaining queue | `!shuffle` |
| `!repeat <mode>` | Toggle repeat mode | `!repeat track` |
| `!remove <position>` | Remove a track from the queue by index | `!remove 2` |
| `!clear` | Clear the entire queue | `!clear` |

Slash command names match the same actions, for example `/play`, `/skip`, `/pause`, `/queue`, etc.

## Project Structure
- `index.js` — bot entry point, Discord client setup, command loader, and interaction handling.
- `src/commands/` — individual command modules.
- `.env` — local environment variables (not committed to the repository).

## Common Issues
- `extractors.loadDefault() is no longer supported`: fixed by using `@discord-player/extractor` and `loadMulti(DefaultExtractors)`.
- `Used disallowed intents`: enable the required intents in the Discord Developer Portal under the Bot section, including **Message Content Intent** if needed.
- `UnhandledEventsWarning: No event listener found...`: `discord-player` requires error events to be handled, and the bot includes these event listeners.
- `InnertubeError: ... not found!`: this usually means YouTube parser updates broke compatibility; update `youtubei.js` to the latest version.
- `[YOUTUBEJS][Player]: Failed to extract signature decipher function` / `n decipher function`: the bot uses `discord-player-youtubei` with an Android client mode. If issues persist, add `YOUTUBE_COOKIE` to `.env`.
