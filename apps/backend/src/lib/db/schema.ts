import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const trades = pgTable(
  "trades",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    externalId: text("external_id").unique(),
    serverName: text("server_name"),
    minecraftUsername: text("minecraft_username").notNull(),
    direction: text("direction", { enum: ["buy", "sell"] }).notNull(),
    itemId: text("item_id").notNull(),
    itemName: text("item_name"),
    quantity: integer("quantity").notNull(),
    unitPrice: bigint("unit_price", { mode: "number" }),
    totalPrice: bigint("total_price", { mode: "number" }),
    counterparty: text("counterparty"),
    tradeSource: text("trade_source").notNull().default("manual"),
    tradeStatus: text("trade_status").notNull().default("completed"),
    tradedAt: timestamp("traded_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    notes: text("notes"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("trades_traded_at_idx").on(table.tradedAt),
    index("trades_item_id_idx").on(table.itemId),
    index("trades_direction_idx").on(table.direction),
    check("trades_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "trades_direction_check",
      sql`${table.direction} in ('buy', 'sell')`,
    ),
  ],
);
