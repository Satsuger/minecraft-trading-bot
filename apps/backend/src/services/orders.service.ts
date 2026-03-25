import type { Bot } from "mineflayer";
import { BlockId } from "@minecraft-trading-bot/shared";
import {
  ChatCommandService,
  type SendCommandAndWaitOptions,
} from "./chatCommand.service.js";

export class OrdersService {
  private readonly chatCommands: ChatCommandService;

  constructor(
    private readonly bot: Bot,
    chatCommands?: ChatCommandService,
  ) {
    this.chatCommands = chatCommands ?? new ChatCommandService(bot);
  }

  async fetchOrders(blockId: BlockId) {
    this.bot.on("windowOpen", (window) => {
      debugger;
      if (!this.isOrdersWindow(window.title)) return;

      console.log("[orders] window opened:", window.title);
    });

    this.chatCommands.openOrders(blockId);
  }

  private isOrdersWindow(windowTitle: string): boolean {
    const ordersTitleVariants = ["orders", "ᴏʀᴅᴇʀѕ"];

    return ordersTitleVariants.some((variant) =>
      windowTitle.toLowerCase().includes(variant),
    );
  }
}
