import type { Bot } from "mineflayer";
import { BlockId } from "@minecraft-trading-bot/constants";
import { ChatCommandService } from "./chatCommand.service.js";
import { WindowService } from "./window.service.js";

export class OrdersService {
  private readonly chatCommands: ChatCommandService;
  private readonly windowService: WindowService;

  constructor(
    private readonly bot: Bot,
    chatCommands?: ChatCommandService,
    windowService?: WindowService,
  ) {
    this.chatCommands = chatCommands ?? new ChatCommandService(bot);
    this.windowService = windowService ?? new WindowService();
  }

  async fetchOrders(blockId: BlockId) {
    const windowPromise = this.windowService.waitForOrdersWindow();

    this.chatCommands.openOrders(blockId);

    const window = await windowPromise;

    const currentPaginationPage = this.windowService.getPaginationPage(window);
    const serialized = this.windowService.serializeOrdersWindow(window);

    return serialized.orders
  }
}

