# Minecraft Trading Bot

A minimal TypeScript starter for a **Mineflayer-based trading assistant**.

This starter is intentionally conservative:
- logs market-related chat/messages
- extracts rough price hints from messages
- supports a few simple chat commands
- keeps the actual trading logic as a next step

## Important
Many servers prohibit bots, macros, or automation. Check the server rules before connecting or issuing commands.

## Stack
- TypeScript
- Mineflayer
- dotenv
- zod

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Or with Bun:

```bash
cp .env.example .env
bun install
bun run dev
```

## Environment

```env
MC_HOST=example.server.net
MC_PORT=25565
MC_USERNAME=your_email_or_username
MC_PASSWORD=
MC_VERSION=
# donutsmp.net server version is 1.21.1
PRICE_KEYWORDS=price,sell,buy,shop,auction,market
CHAT_COMMAND_PREFIX=!
PRISMARINE_VIEWER_ENABLED=true
PRISMARINE_VIEWER_PORT=3000
PRISMARINE_VIEWER_FIRST_PERSON=false
PRISMARINE_VIEWER_VIEW_DISTANCE=6
PRISMARINE_VIEWER_PREFIX=
```

## Prismarine Viewer
When the bot spawns, it now starts a local dashboard so you can inspect the world and the bot inventory in real time.

Open:

`http://localhost:3000/`

Raw 3D viewer only:

`http://localhost:3000/viewer/`

You can change the port and route prefix with:
- `PRISMARINE_VIEWER_PORT`
- `PRISMARINE_VIEWER_PREFIX`

Useful options:
- `PRISMARINE_VIEWER_ENABLED=false` to disable it
- `PRISMARINE_VIEWER_FIRST_PERSON=true` for first-person camera mode
- `PRISMARINE_VIEWER_VIEW_DISTANCE=8` to render more chunks around the bot

## Commands
In chat:
- `!ping` → bot replies with `pong`
- `!say hello` → bot says `hello`
- `!market diamond` → logs a manual market check event

## Logged data
Market events are saved to:

`data/market-events.ndjson`

Example event:
```json
{"kind":"market_message","at":"2026-03-23T00:00:00.000Z","message":"Selling 32 diamonds for 25k","priceHint":25000}
```

## Next useful steps
- add inventory parsing
- add auction house parser
- store history in SQLite/Postgres
- implement spread/arbitrage detection
- add Discord or web dashboard notifications

## Suggested structure for next iteration
- `src/features/market-parser.ts`
- `src/features/orderbook.ts`
- `src/features/opportunity-detector.ts`
- `src/integrations/discord.ts`

## Notes
This project is set up as a starter, not a stealth bot. That keeps it useful for legitimate experimentation, private servers, or market analysis workflows.
# minecraft-trading-bot
