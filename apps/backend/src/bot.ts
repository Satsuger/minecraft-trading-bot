import mineflayer, { type Bot } from "mineflayer";
import { BlockId } from "@minecraft-trading-bot/constants";
import { config } from "./lib/config.js";
import { OrdersService } from "./services/orders.service.js";

export class MinecraftTradingBotApp {
  private bot: Bot | null = null;
  private ordersService: OrdersService | null = null;

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

    this.ordersService = new OrdersService(this.bot);
    this.registerListeners(this.bot);

    return this.bot;
  }

  private registerListeners(bot: Bot): void {
    bot.once("spawn", async () => {
      console.log(`[bot] spawned on ${config.MC_HOST}:${config.MC_PORT}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("[bot] semi-automation mode enabled");

      if (!this.ordersService) return;

      this.ordersService.fetchOrders(BlockId.RedstoneBlock);
    });

    bot.on("windowOpen", (window) => {
      console.log("[bot] window opened:", window?.title);
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
      this.ordersService = null;
    });
  }
}

void new MinecraftTradingBotApp().start();
