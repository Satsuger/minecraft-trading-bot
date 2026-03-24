# Minecraft Trading Bot

A Mineflayer-based trading assistant organized as an Nx monorepo.

## Workspace layout

```text
apps/
  backend/   Mineflayer bot, viewer server, trading logic
  frontend/  React dashboard for inventory and viewer embedding
libs/
  shared/    Shared dashboard contracts between backend and frontend
```

## Important

Many servers prohibit bots, macros, or automation. Check the server rules before connecting or issuing commands.

## Stack

- Nx
- TypeScript
- Mineflayer
- React
- Vite
- dotenv
- zod

## Setup

```bash
npm install
cp .env.example .env
```

## Development

Run both apps:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:backend
npm run dev:frontend
```

Default local URLs:

- Frontend dev server: `http://localhost:4200/`
- Backend viewer server: `http://localhost:3000/`
- Raw Prismarine viewer: `http://localhost:3000/viewer/`

In production-style builds, the backend serves the built frontend from `dist/apps/frontend`.

## Build and checks

```bash
npm run check
npm run build
```

## Environment

```env
MC_HOST=example.server.net
MC_PORT=25565
MC_USERNAME=your_email_or_username
MC_PASSWORD=
MC_VERSION=
PRICE_KEYWORDS=price,sell,buy,shop,auction,market
CHAT_COMMAND_PREFIX=!
PRISMARINE_VIEWER_ENABLED=true
PRISMARINE_VIEWER_PORT=3000
PRISMARINE_VIEWER_FIRST_PERSON=false
PRISMARINE_VIEWER_VIEW_DISTANCE=6
PRISMARINE_VIEWER_PREFIX=
```

Useful viewer options:

- `PRISMARINE_VIEWER_ENABLED=false` disables the local viewer server
- `PRISMARINE_VIEWER_FIRST_PERSON=true` enables first-person camera mode
- `PRISMARINE_VIEWER_VIEW_DISTANCE=8` renders more chunks around the bot
- `PRISMARINE_VIEWER_PREFIX=/bot` serves the dashboard and viewer under a route prefix

## Logged data

Market events are written to `data/market-events.ndjson`.

## Notes

This project is set up as a starter, not a stealth bot. That keeps it useful for legitimate experimentation, private servers, or market analysis workflows.
