import EventEmitter from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Bot } from "mineflayer";
import type { Window } from "prismarine-windows";

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

interface SerializableItem {
  count: number;
  displayName: string;
  durabilityUsed: number | null;
  maxDurability: number | null;
  metadata: number;
  name: string;
  slot: number;
  stackSize: number | null;
  type: number;
}

interface SerializedWindow {
  hotbarStart: number;
  id: number;
  inventoryEnd: number;
  inventoryStart: number;
  selectedItem: SerializableItem | null;
  slotCount: number;
  slots: Array<SerializableItem | null>;
  title: string;
  type: number | string;
}

interface InventoryStatePayload {
  currentWindow: SerializedWindow | null;
  heldItem: SerializableItem | null;
  inventory: SerializedWindow;
  quickBarSlot: number | null;
  username: string;
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
  const viewerPath = joinRoute(normalizedPrefix, "/viewer");
  const viewerSocketPath = `${viewerPath}/socket.io`;

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
  app.get(dashboardPath, (_request: unknown, response: any) => {
    response.type("html").send(
      renderDashboardHtml({
        socketPath: viewerSocketPath,
        viewerPath,
      }),
    );
  });

  if (normalizedPrefix) {
    app.get(normalizedPrefix, (_request: unknown, response: any) => {
      response.redirect(`${normalizedPrefix}/`);
    });
  }

  app.use(`${viewerPath}/`, express.static(publicDir));

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function renderDashboardHtml({
  socketPath,
  viewerPath,
}: {
  socketPath: string;
  viewerPath: string;
}): string {
  const escapedSocketPath = escapeHtml(socketPath);
  const escapedSocketScriptPath = escapeHtml(`${socketPath}/socket.io.js`);
  const escapedViewerPath = escapeHtml(`${viewerPath}/`);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Minecraft Bot Dashboard</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #11161a;
        --panel: #1a2228;
        --panel-border: #2d3942;
        --text: #f2f5f7;
        --muted: #99a7b3;
        --accent: #7cd992;
        --slot: #243038;
        --slot-border: #3a4954;
        --empty: #1a2127;
      }

      * {
        box-sizing: border-box;
      }

      html, body {
        margin: 0;
        min-height: 100%;
        background: radial-gradient(circle at top, #1d2830 0%, var(--bg) 55%);
        color: var(--text);
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      }

      body {
        padding: 16px;
      }

      .layout {
        display: grid;
        gap: 16px;
        grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.9fr);
        min-height: calc(100vh - 32px);
      }

      .panel {
        background: rgba(26, 34, 40, 0.94);
        border: 1px solid var(--panel-border);
        border-radius: 18px;
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
        overflow: hidden;
      }

      .viewer-panel {
        display: flex;
        flex-direction: column;
        min-height: 70vh;
      }

      .viewer-header,
      .sidebar-header {
        align-items: center;
        border-bottom: 1px solid var(--panel-border);
        display: flex;
        justify-content: space-between;
        padding: 14px 16px;
      }

      .viewer-header strong,
      .sidebar-header strong {
        font-size: 0.95rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .viewer-header span,
      .sidebar-header span,
      .muted {
        color: var(--muted);
        font-size: 0.86rem;
      }

      iframe {
        background: #000;
        border: 0;
        flex: 1;
        width: 100%;
      }

      .sidebar {
        display: flex;
        flex-direction: column;
        min-height: 70vh;
      }

      .sidebar-content {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 14px;
        overflow: auto;
        padding: 14px;
      }

      .meta {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .meta-card {
        background: rgba(17, 22, 26, 0.7);
        border: 1px solid var(--panel-border);
        border-radius: 14px;
        padding: 12px;
      }

      .meta-card strong {
        display: block;
        font-size: 0.8rem;
        letter-spacing: 0.06em;
        margin-bottom: 6px;
        text-transform: uppercase;
      }

      .window-card {
        background: rgba(17, 22, 26, 0.72);
        border: 1px solid var(--panel-border);
        border-radius: 16px;
        padding: 14px;
      }

      .window-title {
        align-items: baseline;
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 12px;
      }

      .window-title strong {
        font-size: 0.92rem;
      }

      .slot-grid {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(9, minmax(0, 1fr));
      }

      .slot {
        aspect-ratio: 1 / 1;
        background: linear-gradient(180deg, var(--slot) 0%, #1b242b 100%);
        border: 1px solid var(--slot-border);
        border-radius: 12px;
        overflow: hidden;
        padding: 6px;
        position: relative;
      }

      .slot.empty {
        background: linear-gradient(180deg, var(--empty) 0%, #161d22 100%);
      }

      .slot.hotbar {
        border-color: var(--accent);
      }

      .slot.active {
        box-shadow: inset 0 0 0 1px rgba(124, 217, 146, 0.7);
      }

      .slot-name {
        color: var(--text);
        display: -webkit-box;
        font-size: 0.68rem;
        line-height: 1.15;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
      }

      .slot-index,
      .slot-count {
        color: var(--muted);
        font-size: 0.7rem;
        position: absolute;
      }

      .slot-index {
        left: 6px;
        top: 6px;
      }

      .slot-count {
        bottom: 6px;
        right: 6px;
      }

      .slot-extra {
        bottom: 6px;
        color: var(--muted);
        font-size: 0.62rem;
        left: 6px;
        position: absolute;
      }

      .window-subsection {
        margin-top: 12px;
      }

      .window-subsection h3 {
        color: var(--muted);
        font-size: 0.76rem;
        letter-spacing: 0.08em;
        margin: 0 0 10px;
        text-transform: uppercase;
      }

      .empty-state {
        border: 1px dashed var(--panel-border);
        border-radius: 14px;
        color: var(--muted);
        padding: 18px;
        text-align: center;
      }

      @media (max-width: 1100px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .viewer-panel {
          min-height: 52vh;
        }
      }

      @media (max-width: 640px) {
        body {
          padding: 10px;
        }

        .meta {
          grid-template-columns: 1fr;
        }

        .slot-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }
      }
    </style>
  </head>
  <body>
    <div class="layout">
      <section class="panel viewer-panel">
        <div class="viewer-header">
          <strong>World View</strong>
          <span>Live prismarine viewer stream</span>
        </div>
        <iframe src="${escapedViewerPath}" title="Minecraft bot viewer"></iframe>
      </section>

      <aside class="panel sidebar">
        <div class="sidebar-header">
          <strong>Inventory</strong>
          <span id="connection-state">Connecting…</span>
        </div>
        <div class="sidebar-content">
          <section class="meta" id="meta"></section>
          <section id="windows"></section>
        </div>
      </aside>
    </div>

    <script src="${escapedSocketScriptPath}"></script>
    <script>
      const socket = io({ path: ${JSON.stringify(socketPath)} });
      const connectionState = document.getElementById("connection-state");
      const meta = document.getElementById("meta");
      const windowsRoot = document.getElementById("windows");

      socket.on("connect", () => {
        connectionState.textContent = "Connected";
      });

      socket.on("disconnect", () => {
        connectionState.textContent = "Disconnected";
      });

      socket.on("inventoryState", (payload) => {
        renderMeta(payload);
        renderWindows(payload);
      });

      function renderMeta(payload) {
        const heldItem = payload.heldItem
          ? payload.heldItem.displayName + " x" + payload.heldItem.count
          : "Empty hand";
        const windowLabel = payload.currentWindow
          ? payload.currentWindow.title || String(payload.currentWindow.type)
          : "No container open";

        meta.innerHTML = [
          renderMetaCard("Bot", escapeHtml(payload.username)),
          renderMetaCard("Held Item", escapeHtml(heldItem)),
          renderMetaCard("Selected Hotbar", payload.quickBarSlot == null ? "n/a" : String(payload.quickBarSlot)),
          renderMetaCard("Open Window", escapeHtml(windowLabel)),
        ].join("");
      }

      function renderMetaCard(label, value) {
        return '<article class="meta-card"><strong>' + label + '</strong><div>' + value + '</div></article>';
      }

      function renderWindows(payload) {
        const sections = [
          renderPlayerInventory(payload.inventory, payload.quickBarSlot),
          renderCurrentWindow(payload.currentWindow),
        ].filter(Boolean);

        windowsRoot.innerHTML = sections.join("");
      }

      function renderPlayerInventory(windowState, quickBarSlot) {
        const accessorySlots = windowState.slots.slice(0, windowState.inventoryStart);
        const mainSlots = windowState.slots.slice(windowState.inventoryStart, windowState.hotbarStart);
        const hotbarSlots = windowState.slots.slice(windowState.hotbarStart, windowState.inventoryEnd);

        return [
          '<section class="window-card">',
          '<div class="window-title"><strong>Player Inventory</strong><span class="muted">' + escapeHtml(windowState.title) + '</span></div>',
          renderSection("Equipment / Crafting", accessorySlots, 0, null),
          renderSection("Main Inventory", mainSlots, windowState.inventoryStart, null),
          renderSection("Hotbar", hotbarSlots, windowState.hotbarStart, quickBarSlot == null ? null : windowState.hotbarStart + quickBarSlot),
          renderCursor(windowState.selectedItem),
          "</section>",
        ].join("");
      }

      function renderCurrentWindow(windowState) {
        if (!windowState) {
          return '<section class="window-card"><div class="empty-state">Open a chest, trade, auction, or other container to inspect its slots here.</div></section>';
        }

        const containerSlots = windowState.slots.slice(0, windowState.inventoryStart);

        return [
          '<section class="window-card">',
          '<div class="window-title"><strong>' + escapeHtml(windowState.title || "Opened Window") + '</strong><span class="muted">' + escapeHtml(String(windowState.type)) + '</span></div>',
          renderSection("Container Slots", containerSlots, 0, null),
          renderCursor(windowState.selectedItem),
          "</section>",
        ].join("");
      }

      function renderCursor(item) {
        if (!item) {
          return "";
        }

        return '<div class="window-subsection"><h3>Cursor Item</h3><div class="slot-grid">' + renderSlot(item, item.slot, false, false) + "</div></div>";
      }

      function renderSection(title, slots, baseIndex, activeSlot) {
        if (!slots.length) {
          return "";
        }

        return [
          '<div class="window-subsection">',
          "<h3>" + escapeHtml(title) + "</h3>",
          '<div class="slot-grid">',
          slots.map((item, index) => renderSlot(item, baseIndex + index, baseIndex >= 36, activeSlot === baseIndex + index)).join(""),
          "</div>",
          "</div>",
        ].join("");
      }

      function renderSlot(item, index, isHotbar, isActive) {
        const classes = ["slot"];
        if (!item) classes.push("empty");
        if (isHotbar) classes.push("hotbar");
        if (isActive) classes.push("active");

        if (!item) {
          return '<div class="' + classes.join(" ") + '"><span class="slot-index">#' + index + "</span></div>";
        }

        const extra = item.maxDurability != null && item.durabilityUsed != null
          ? '<span class="slot-extra">' + (item.maxDurability - item.durabilityUsed) + "/" + item.maxDurability + "</span>"
          : "";

        return [
          '<div class="' + classes.join(" ") + '" title="' + escapeHtml(item.name) + '">',
          '<span class="slot-index">#' + index + "</span>",
          '<div class="slot-name">' + escapeHtml(item.displayName) + "</div>",
          '<span class="slot-count">x' + item.count + "</span>",
          extra,
          "</div>",
        ].join("");
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }
    </script>
  </body>
</html>`;
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
    title: String(window.title ?? ""),
    type: window.type,
  };
}
