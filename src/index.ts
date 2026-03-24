import mineflayer from "mineflayer";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Window } from "prismarine-windows";
import { config } from "./config.js";
import { startPrismarineViewer } from "./prismarineViewer.js";

const dataDir = join(process.cwd(), "data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const marketLogPath = join(dataDir, "market-events.ndjson");
const windowLogPath = join(dataDir, "window.log");

const bot = mineflayer.createBot({
  host: config.MC_HOST,
  port: config.MC_PORT,
  username: config.MC_USERNAME,
  version: config.MC_VERSION,
  auth: "microsoft",
});

const prefix = config.CHAT_COMMAND_PREFIX;
const initialServerCommand = "/orders blocks of emerald";
const startupDelayMs = 2000;
const commandResponseCaptureMs = 5000;
let prismarineViewer:
  | {
      close: () => void;
      url: string;
    }
  | undefined;
let isCapturingCommandResponse = false;
let commandResponseFlushTimeout: NodeJS.Timeout | undefined;
let capturedChatRows: Array<{
  line: number;
  position: string;
}> = [];
let capturedWindowRows: Array<{
  slot: number;
}> = [];

function appendWindowLog(value: unknown) {
  appendFileSync(
    windowLogPath,
    `${typeof value === "string" ? value : JSON.stringify(value)}\n`,
    "utf8",
  );
}

function flushCommandResponseCapture() {
  if (!isCapturingCommandResponse) {
    return;
  }

  isCapturingCommandResponse = false;

  if (commandResponseFlushTimeout) {
    clearTimeout(commandResponseFlushTimeout);
    commandResponseFlushTimeout = undefined;
  }

  if (capturedChatRows.length === 0 && capturedWindowRows.length === 0) {
    appendWindowLog({
      type: "capture-empty",
      command: initialServerCommand,
    });
  }

  appendWindowLog({
    type: "capture-end",
    command: initialServerCommand,
    chatRows: capturedChatRows.length,
    windowRows: capturedWindowRows.length,
  });
}

function beginCommandResponseCapture() {
  isCapturingCommandResponse = true;
  capturedChatRows = [];
  capturedWindowRows = [];

  if (commandResponseFlushTimeout) {
    clearTimeout(commandResponseFlushTimeout);
  }

  appendWindowLog({
    type: "capture-start",
    command: initialServerCommand,
    startedAt: new Date().toISOString(),
  });

  commandResponseFlushTimeout = setTimeout(
    flushCommandResponseCapture,
    commandResponseCaptureMs,
  );
}

function captureCommandResponseMessage(
  message: string,
  position: string,
  rawMessage: unknown,
) {
  if (!isCapturingCommandResponse) {
    return;
  }

  const normalizedMessage = message.trim();
  if (!normalizedMessage || normalizedMessage === initialServerCommand) {
    return;
  }

  capturedChatRows.push({
    line: capturedChatRows.length + 1,
    position,
  });

  appendWindowLog({
    type: "chat",
    command: initialServerCommand,
    line: capturedChatRows.length,
    position,
    raw: rawMessage,
  });
}

function captureCommandResponseWindow(window: Window) {
  if (!isCapturingCommandResponse) {
    return;
  }

  const occupiedSlots = window.slots
    .map((item, slot) => {
      if (!item) {
        return null;
      }

      return {
        slot,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  capturedWindowRows.push(...occupiedSlots);

  appendWindowLog({
    type: "window",
    command: initialServerCommand,
    title: window.title || "Opened Window",
    slotCount: window.slots.length,
    slots: window.slots,
  });
}

bot.once("spawn", async () => {
  console.log(`[bot] spawned on ${config.MC_HOST}:${config.MC_PORT}`);
  await new Promise((resolve) => setTimeout(resolve, startupDelayMs));

  console.log(`[bot] command prefix: ${prefix}`);
  console.log("[bot] semi-automation mode enabled");
  console.log(`[bot] running startup command: ${initialServerCommand}`);
  beginCommandResponseCapture();
  bot.chat(initialServerCommand);

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

bot.on("messagestr", (message, position, jsonMsg) => {
  captureCommandResponseMessage(message, position, jsonMsg.json);
});

bot.on("windowOpen", (window) => {
  captureCommandResponseWindow(window);
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
