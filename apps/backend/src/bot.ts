import mineflayer, { type Bot } from "mineflayer";
import { BlockId } from "@torgash/constants";
import { config } from "./lib/config.js";
import { OrdersService } from "./services/orders.service.js";
import { TaskSchedulerService } from "./services/task-scheduler/index.js";
import { WindowService } from "./services/window.service.js";
import { EnchantingTableStrategy } from "./strategies/enchantingTable.strategy.js";

export class MinecraftTradingBotApp {
  private bot: Bot | null = null;

  private windowService = new WindowService();
  private taskScheduler = new TaskSchedulerService();

  constructor() {
    this.taskScheduler.stop();
  }

  start(): Bot {
    if (this.bot) {
      return this.bot;
    }

    this.bot = mineflayer.createBot({
      host: config.MC_HOST,
      port: config.MC_PORT,
      username: config.MC_USERNAME,
      version: config.MC_VERSION,
      auth: "microsoft",
    });

    this.registerListeners(this.bot);

    return this.bot;
  }

  private registerListeners(bot: Bot): void {
    bot.once("spawn", async () => {
      console.log(`[bot] spawned on ${config.MC_HOST}:${config.MC_PORT}`);

      await new Promise((resolve) => setTimeout(resolve, 2000));
      this.taskScheduler.resume();

      new EnchantingTableStrategy(bot, this.taskScheduler).run();

      console.log("[bot] semi-automation mode enabled");
    });

    bot.on("windowOpen", (window) => {
      if (!window) return;

      console.log("[bot] window opened:", window.title);

      this.windowService?.handleWindowOpen(window);
    });

    bot.on("windowClose", (window) => {
      console.log("[bot] window closed:", window?.title);
    });

    bot.on("kicked", (reason) => {
      console.error("[bot] kicked:", reason);
    });

    bot.on("error", (error) => {
      console.error("[bot] error:", error);
    });

    bot.on("end", (why) => {
      console.log("[bot] disconnected", why);

      this.bot = null;
    });
  }
}

void new MinecraftTradingBotApp().start();
