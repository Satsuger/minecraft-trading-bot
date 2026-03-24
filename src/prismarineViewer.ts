import EventEmitter from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Bot } from "mineflayer";

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

  const app = express();
  const httpServer = createServer(app);
  const io = socketIo(httpServer, {
    path: `${normalizedPrefix}/socket.io`,
  });
  const sockets: any[] = [];
  const primitives: Record<string, unknown> = {};
  const viewer = new EventEmitter() as ViewerApi;
  const publicDir = join(
    dirname(require.resolve("prismarine-viewer/package.json")),
    "public",
  );

  app.use(compression());
  app.use(`${normalizedPrefix}/`, express.static(publicDir));

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

  io.on("connection", (socket: any) => {
    socket.emit("version", bot.version);
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

function normalizePrefix(prefix?: string): string {
  if (!prefix) {
    return "";
  }

  return prefix.startsWith("/") ? prefix : `/${prefix}`;
}
