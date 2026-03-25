import EventEmitter from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Bot } from "mineflayer";
import type { Window } from "prismarine-windows";
import type {
  InventoryStatePayload,
  SerializableItem,
  SerializedWindow,
} from "@torgash/types";
import { formatMinecraftText } from "./minecraft-text.js";

const require = createRequire(import.meta.url);

const compression = require("compression") as any;
const express = require("express") as any;
const socketIo = require("socket.io") as any;
const { WorldView } = require("prismarine-viewer/viewer/lib/worldView.js") as {
  WorldView: new (
    world: Bot["world"],
    viewDistance: number,
    position: Bot["entity"]["position"],
    emitter: any,
  ) => {
    init(position: Bot["entity"]["position"]): Promise<void>;
    listenToBot(bot: Bot): void;
    removeListenersFromBot(bot: Bot): void;
    updatePosition(position: Bot["entity"]["position"], force?: boolean): Promise<void>;
    on(event: "blockClicked", listener: (...args: unknown[]) => void): void;
  };
};

interface ViewerSettings {
  firstPerson?: boolean;
  port?: number;
  prefix?: string;
  viewDistance?: number;
}

interface ViewerApi extends EventEmitter {
  close?: () => void;
  drawBoxGrid: (id: string, start: unknown, end: unknown, color?: string) => void;
  drawLine: (id: string, points: unknown[], color?: number) => void;
  drawPoints: (id: string, points: unknown[], color?: number, size?: number) => void;
  erase: (id: string) => void;
}

type BotWithViewer = Bot & { viewer?: ViewerApi };

export interface PrismarineViewerController {
  close: () => void;
  url: string;
}

export async function startPrismarineViewer(
  bot: Bot,
  settings: ViewerSettings = {},
): Promise<PrismarineViewerController> {
  const normalizedPrefix = normalizePrefix(settings.prefix);
  const port = settings.port ?? 3000;
  const firstPerson = settings.firstPerson ?? false;
  const viewDistance = settings.viewDistance ?? 6;
  const dashboardPath = normalizedPrefix || "/";
  const dashboardStaticPath = normalizedPrefix ? `${normalizedPrefix}/` : "/";
  const viewerPath = joinRoute(normalizedPrefix, "/viewer");
  const viewerSocketPath = `${viewerPath}/socket.io`;
  const frontendDistDir = join(process.cwd(), "dist", "apps", "frontend");
  const frontendIndexPath = join(frontendDistDir, "index.html");

  const app = express();
  const httpServer = createServer(app);
  const io = socketIo(httpServer, {
    path: viewerSocketPath,
  });
  const sockets: any[] = [];
  const primitives: Record<string, unknown> = {};
  const viewer = new EventEmitter() as ViewerApi;
  const publicDir = join(
    dirname(require.resolve("prismarine-viewer/package.json")),
    "public",
  );

  let activeWindow: Window | null = bot.currentWindow;
  let activeWindowListener: (() => void) | undefined;
  const botRuntimeEvents = bot as unknown as EventEmitter;

  app.use(compression());

  if (normalizedPrefix) {
    app.get(normalizedPrefix, (_request: unknown, response: any) => {
      response.redirect(`${normalizedPrefix}/`);
    });
  }

  app.use(`${viewerPath}/`, express.static(publicDir));

  if (existsSync(frontendIndexPath)) {
    app.get(dashboardPath, (_request: unknown, response: any) => {
      response.sendFile(frontendIndexPath);
    });
    app.use(dashboardStaticPath, express.static(frontendDistDir));
  } else {
    app.get(dashboardPath, (_request: unknown, response: any) => {
      response
        .status(503)
        .type("html")
        .send(renderDashboardUnavailableHtml(buildViewerUrl(port, normalizedPrefix)));
    });
  }

  viewer.erase = (id) => {
    delete primitives[id];
    sockets.forEach((socket) => socket.emit("primitive", { id }));
  };

  viewer.drawBoxGrid = (id, start, end, color = "aqua") => {
    primitives[id] = { type: "boxgrid", id, start, end, color };
    sockets.forEach((socket) => socket.emit("primitive", primitives[id]));
  };

  viewer.drawLine = (id, points, color = 0xff0000) => {
    primitives[id] = { type: "line", id, points, color };
    sockets.forEach((socket) => socket.emit("primitive", primitives[id]));
  };

  viewer.drawPoints = (id, points, color = 0xff0000, size = 5) => {
    primitives[id] = { type: "points", id, points, color, size };
    sockets.forEach((socket) => socket.emit("primitive", primitives[id]));
  };

  const broadcastInventoryState = () => {
    const payload = createInventoryState(bot);
    sockets.forEach((socket) => socket.emit("inventoryState", payload));
  };

  const syncActiveWindowListener = () => {
    if (activeWindowListener && activeWindow) {
      (activeWindow as unknown as EventEmitter).off("updateSlot", activeWindowListener);
      activeWindowListener = undefined;
    }

    activeWindow = bot.currentWindow;

    if (!activeWindow) {
      return;
    }

    activeWindowListener = () => {
      broadcastInventoryState();
    };

    (activeWindow as unknown as EventEmitter).on("updateSlot", activeWindowListener);
  };

  const onWindowOpen = () => {
    syncActiveWindowListener();
    broadcastInventoryState();
  };

  const onWindowClose = () => {
    syncActiveWindowListener();
    broadcastInventoryState();
  };

  syncActiveWindowListener();
  (bot.inventory as unknown as EventEmitter).on("updateSlot", broadcastInventoryState);
  botRuntimeEvents.on("heldItemChanged", broadcastInventoryState);
  bot.on("windowOpen", onWindowOpen);
  bot.on("windowClose", onWindowClose);

  io.on("connection", (socket: any) => {
    socket.emit("version", bot.version);
    socket.emit("inventoryState", createInventoryState(bot));
    sockets.push(socket);

    const worldView = new WorldView(bot.world, viewDistance, bot.entity.position, socket);
    void worldView.init(bot.entity.position);

    worldView.on("blockClicked", (...args) => {
      viewer.emit("blockClicked", ...args);
    });

    Object.values(primitives).forEach((primitive) => {
      socket.emit("primitive", primitive);
    });

    const botPosition = () => {
      const packet: {
        addMesh: boolean;
        pitch?: number;
        pos: Bot["entity"]["position"];
        yaw: number;
      } = {
        addMesh: true,
        pos: bot.entity.position,
        yaw: bot.entity.yaw,
      };

      if (firstPerson) {
        packet.pitch = bot.entity.pitch;
      }

      socket.emit("position", packet);
      void worldView.updatePosition(bot.entity.position);
    };

    botPosition();
    bot.on("move", botPosition);
    worldView.listenToBot(bot);

    socket.on("disconnect", () => {
      bot.removeListener("move", botPosition);
      worldView.removeListenersFromBot(bot);
      const socketIndex = sockets.indexOf(socket);

      if (socketIndex >= 0) {
        sockets.splice(socketIndex, 1);
      }
    });
  });

  (bot as BotWithViewer).viewer = viewer;

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      httpServer.off("listening", onListening);
      reject(error);
    };

    const onListening = () => {
      httpServer.off("error", onError);
      resolve();
    };

    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
    httpServer.listen(port);
  });

  viewer.close = () => {
    if (activeWindowListener && activeWindow) {
      (activeWindow as unknown as EventEmitter).off("updateSlot", activeWindowListener);
    }

    (bot.inventory as unknown as EventEmitter).off("updateSlot", broadcastInventoryState);
    botRuntimeEvents.off("heldItemChanged", broadcastInventoryState);
    bot.off("windowOpen", onWindowOpen);
    bot.off("windowClose", onWindowClose);
    io.close();
    httpServer.close();
    sockets.splice(0).forEach((socket) => socket.disconnect(true));
  };

  return {
    close: () => viewer.close?.(),
    url: buildViewerUrl(port, normalizedPrefix),
  };
}

function buildViewerUrl(port: number, prefix: string): string {
  const path = prefix ? `${prefix}/` : "/";
  return `http://localhost:${port}${path}`;
}

function createInventoryState(bot: Bot): InventoryStatePayload {
  return {
    currentWindow: serializeWindow(bot.currentWindow),
    heldItem: serializeItem(bot.heldItem),
    inventory: serializeWindow(bot.inventory)!,
    quickBarSlot: bot.quickBarSlot,
    username: bot.username,
  };
}

function joinRoute(prefix: string, suffix: string): string {
  return prefix ? `${prefix}${suffix}` : suffix;
}

function normalizePrefix(prefix?: string): string {
  if (!prefix) {
    return "";
  }

  return prefix.startsWith("/") ? prefix : `/${prefix}`;
}

function renderDashboardUnavailableHtml(viewerUrl: string): string {
  const escapedViewerUrl = escapeHtml(viewerUrl);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Minecraft Bot Dashboard</title>
    <style>
      body {
        background: #0f171b;
        color: #eef5ef;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }

      main {
        background: rgba(17, 27, 32, 0.94);
        border: 1px solid rgba(92, 126, 119, 0.26);
        border-radius: 24px;
        max-width: 720px;
        padding: 24px;
      }

      code {
        color: #d7ff7b;
      }

      a {
        color: #9bd66f;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Frontend assets are not built yet.</h1>
      <p>Run <code>npm run build</code> or keep <code>npm run dev:frontend</code> running during development.</p>
      <p>The raw Prismarine viewer is still available at <a href="${escapedViewerUrl}">${escapedViewerUrl}</a>.</p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function serializeItem(item: Bot["heldItem"]): SerializableItem | null {
  if (!item) {
    return null;
  }

  return {
    count: item.count,
    displayName: item.displayName ?? item.name,
    durabilityUsed: item.durabilityUsed ?? null,
    maxDurability: item.maxDurability ?? null,
    metadata: item.metadata,
    name: item.name,
    slot: typeof item.slot === "number" ? item.slot : -1,
    stackSize: item.stackSize ?? null,
    type: item.type,
  };
}

function serializeWindow(window: Window | null): SerializedWindow | null {
  if (!window) {
    return null;
  }

  return {
    hotbarStart: window.hotbarStart,
    id: window.id,
    inventoryEnd: window.inventoryEnd,
    inventoryStart: window.inventoryStart,
    selectedItem: serializeItem(window.selectedItem),
    slotCount: window.slots.length,
    slots: window.slots.map((item) => serializeItem(item)),
    title: formatMinecraftText(window.title),
    type: window.type,
  };
}
