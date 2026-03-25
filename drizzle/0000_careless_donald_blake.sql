CREATE TABLE "trades" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"external_id" text,
	"server_name" text,
	"minecraft_username" text NOT NULL,
	"direction" text NOT NULL,
	"item_id" text NOT NULL,
	"item_name" text,
	"quantity" integer NOT NULL,
	"unit_price" bigint,
	"total_price" bigint,
	"counterparty" text,
	"trade_source" text DEFAULT 'manual' NOT NULL,
	"trade_status" text DEFAULT 'completed' NOT NULL,
	"traded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trades_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "trades_quantity_positive" CHECK ("trades"."quantity" > 0),
	CONSTRAINT "trades_direction_check" CHECK ("trades"."direction" in ('buy', 'sell'))
);
--> statement-breakpoint
CREATE INDEX "trades_traded_at_idx" ON "trades" USING btree ("traded_at");--> statement-breakpoint
CREATE INDEX "trades_item_id_idx" ON "trades" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "trades_direction_idx" ON "trades" USING btree ("direction");