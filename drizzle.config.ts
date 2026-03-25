import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const dbUser = process.env.DB_USER ?? "minecraft";
const dbPassword = process.env.DB_PASSWORD ?? "minecraft";
const dbHost = process.env.DB_HOST ?? "127.0.0.1";
const dbPort = process.env.DB_PORT ?? "5432";
const dbName = process.env.DB_NAME ?? "minecraft_trading_bot";

export default defineConfig({
  dialect: "postgresql",
  schema: "./apps/backend/src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL?.trim() ||
      `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`,
  },
});
