import { desc, sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "./config.js";
import * as schema from "./db/schema.js";
import { trades } from "./db/schema.js";

let databasePool: Pool | null = null;
let database: NodePgDatabase<typeof schema> | null = null;
let hasLoggedConnectionSuccess = false;

export type NewTradeRecord = Omit<
  InferInsertModel<typeof trades>,
  "id" | "createdAt" | "updatedAt"
>;

export type TradeRecord = InferSelectModel<typeof trades>;

export async function connectDatabase(): Promise<boolean> {
  if (!config.DATABASE_ENABLED) {
    console.log("[db] disabled");
    return false;
  }

  try {
    const result = await getDatabase().execute(
      sql`select current_database() as current_database`,
    );
    const row = result.rows[0] as
      | {
          current_database?: string;
        }
      | undefined;

    if (!hasLoggedConnectionSuccess) {
      console.log(`[db] connected to ${row?.current_database ?? config.DB_NAME}`);
      hasLoggedConnectionSuccess = true;
    }

    return true;
  } catch (error) {
    console.warn("[db] unavailable, continuing without persistence", error);
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  if (!databasePool) {
    return;
  }

  const pool = databasePool;
  databasePool = null;
  database = null;
  hasLoggedConnectionSuccess = false;
  await pool.end();
}

export async function insertTrade(trade: NewTradeRecord): Promise<TradeRecord> {
  const [record] = await getDatabase()
    .insert(trades)
    .values({
      ...trade,
      metadata: trade.metadata ?? {},
      tradeSource: trade.tradeSource ?? "manual",
      tradeStatus: trade.tradeStatus ?? "completed",
      tradedAt: trade.tradedAt ?? new Date(),
    })
    .returning();

  return record;
}

export async function listRecentTrades(limit = 25): Promise<TradeRecord[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));

  return getDatabase()
    .select()
    .from(trades)
    .orderBy(desc(trades.tradedAt), desc(trades.id))
    .limit(safeLimit);
}

function getDatabase(): NodePgDatabase<typeof schema> {
  if (!config.DATABASE_ENABLED) {
    throw new Error("Database access requested while DATABASE_ENABLED=false");
  }

  if (!database) {
    database = drizzle(getDatabasePool(), { schema });
  }

  return database;
}

function getDatabasePool(): Pool {
  if (!config.DATABASE_ENABLED) {
    throw new Error("Database access requested while DATABASE_ENABLED=false");
  }

  if (!databasePool) {
    databasePool = new Pool({
      connectionString: config.DATABASE_URL,
      ssl: config.DB_SSL ? { rejectUnauthorized: false } : undefined,
    });
  }

  return databasePool;
}
