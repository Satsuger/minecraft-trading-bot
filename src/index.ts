import mineflayer from "mineflayer";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";
import { startPrismarineViewer } from "./prismarineViewer.js";

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
let prismarineViewer:
  | {
      close: () => void;
      url: string;
    }
  | undefined;

bot.once("spawn", async () => {
  console.log(`[bot] spawned on ${config.MC_HOST}:${config.MC_PORT}`);
  console.log(`[bot] command prefix: ${prefix}`);
  console.log("[bot] semi-automation mode enabled");

  if (!config.PRISMARINE_VIEWER_ENABLED) {
    console.log("[viewer] prismarine viewer disabled");
    return;
  }

  try {
    prismarineViewer = await startPrismarineViewer(bot, {
      port: config.PRISMARINE_VIEWER_PORT,
      prefix: config.PRISMARINE_VIEWER_PREFIX,
      firstPerson: config.PRISMARINE_VIEWER_FIRST_PERSON,
      viewDistance: config.PRISMARINE_VIEWER_VIEW_DISTANCE,
    });

    console.log(`[viewer] available at ${prismarineViewer.url}`);
  } catch (error) {
    console.error("[viewer] failed to start:", error);
  }
});

bot.on("kicked", (reason) => {
  console.error("[bot] kicked:", reason);
});

bot.on("error", (error) => {
  console.error("[bot] error:", error);
});

bot.on("end", (why) => {
  prismarineViewer?.close();
  console.log("[bot] disconnected", why);
});
