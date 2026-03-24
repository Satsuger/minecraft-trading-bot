import mineflayer from "mineflayer";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";

const dataDir = join(process.cwd(), "data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const marketLogPath = join(dataDir, "market-events.ndjson");

const bot = mineflayer.createBot({
  host: config.MC_HOST,
  port: config.MC_PORT,
  username: config.MC_USERNAME,
  version: config.MC_VERSION,
  auth: "microsoft",
});

const prefix = config.CHAT_COMMAND_PREFIX;

bot.once("spawn", () => {
  console.log(`[bot] spawned on ${config.MC_HOST}:${config.MC_PORT}`);
  console.log(`[bot] command prefix: ${prefix}`);
  console.log("[bot] semi-automation mode enabled");
});

bot.on("kicked", (reason) => {
  console.error("[bot] kicked:", reason);
});

bot.on("error", (error) => {
  console.error("[bot] error:", error);
});

bot.on("end", (why) => {
  console.log("[bot] disconnected", why);
});
