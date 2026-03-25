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
- PostgreSQL
- Drizzle ORM
- Docker Compose
- dotenv
- zod

## Setup

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:migrate
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

Database helpers:

```bash
npm run db:up
npm run db:generate
npm run db:migrate
npm run db:studio
npm run db:status
npm run db:logs
npm run db:down
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
DATABASE_ENABLED=true
DATABASE_URL=
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=minecraft_trading_bot
DB_USER=minecraft
DB_PASSWORD=minecraft
DB_SSL=false
```

Useful viewer options:

- `PRISMARINE_VIEWER_ENABLED=false` disables the local viewer server
- `PRISMARINE_VIEWER_FIRST_PERSON=true` enables first-person camera mode
- `PRISMARINE_VIEWER_VIEW_DISTANCE=8` renders more chunks around the bot
- `PRISMARINE_VIEWER_PREFIX=/bot` serves the dashboard and viewer under a route prefix

## Logged data

Market events are written to `data/market-events.ndjson`.

## Database

PostgreSQL is a good fit here. You will likely want transactional writes, flexible querying across item, time, server, and counterparty, and a schema that can grow from simple trade logs into analytics later.

The repo now uses Drizzle as the source of truth for the database layer:

- Drizzle config: [drizzle.config.ts](/Users/viktorkoda/Documents/Projects/Minecraft/minecraft-trading-bot/drizzle.config.ts)
- Schema: [schema.ts](/Users/viktorkoda/Documents/Projects/Minecraft/minecraft-trading-bot/apps/backend/src/lib/db/schema.ts)
- Generated migration: [0000_careless_donald_blake.sql](/Users/viktorkoda/Documents/Projects/Minecraft/minecraft-trading-bot/drizzle/0000_careless_donald_blake.sql)
- Runtime repository/client: [database.ts](/Users/viktorkoda/Documents/Projects/Minecraft/minecraft-trading-bot/apps/backend/src/lib/database.ts)

The Docker Compose file only starts Postgres now. Schema creation is handled by `npm run db:migrate`, not by container startup scripts.

If you already started an older version of this repo that used Docker init SQL, recreate the Postgres volume before switching to Drizzle-managed migrations:

```bash
docker compose down -v
npm run db:up
npm run db:migrate
```

## Notes

This project is set up as a starter, not a stealth bot. That keeps it useful for legitimate experimentation, private servers, or market analysis workflows.
