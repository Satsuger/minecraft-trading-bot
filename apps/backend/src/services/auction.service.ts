import type { Bot } from "mineflayer";
import { BlockId } from "@torgash/constants";
import { ChatCommandService } from "./chatCommand.service.js";
import { WindowService } from "./window.service.js";

export class AuctionService {
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

  async fetchAuctionItems(blockId: BlockId) {
    const windowPromise = this.windowService.waitForOrdersWindow();

    this.chatCommands.openAuctions(blockId);

    const window = await windowPromise;

    const currentPaginationPage = this.windowService.getPaginationPage(window);
    const serialized = this.windowService.serializeOrdersWindow(window);

    return serialized.orders
  }
}
