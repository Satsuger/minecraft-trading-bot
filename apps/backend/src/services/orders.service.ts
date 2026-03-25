import type { Bot } from "mineflayer";
import { BlockId } from "@minecraft-trading-bot/constants";
import { decodeCompactNumber } from "@minecraft-trading-bot/utils";
import { ChatCommandService } from "./chatCommand.service.js";
import type { Window } from "prismarine-windows";
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
    this.windowService = windowService ?? new WindowService(bot);
  }

  async fetchOrders(blockId: BlockId) {
    const windowPromise = this.windowService.waitForOrdersWindow();

    this.chatCommands.openOrders(blockId);

    const window = await windowPromise;

    const currentPaginationPage = this.windowService.getPaginationPage(window);
    const serialized = this.serializeOrdersWindow(window);

    debugger;
  }

  private serializeOrdersWindow(window: Window) {
    const windowSlots = window.slots.slice(0, window.inventoryStart - 1);
    const orderSlots = window.slots.slice(0, window.inventoryStart - 10);
    const orderActionSlots = window.slots
      .slice(window.inventoryStart - 10, window.inventoryStart - 1)
      .filter(Boolean);
    const inventorySlots = window.slots.slice(
      window.inventoryStart - 1,
      window.hotbarStart - 1,
    );
    const hotbarSlots = window.slots.slice(
      window.hotbarStart - 1,
      window.slots.length - 1,
    );

    return {
      orders: orderSlots.map(this.serializeOrdersItem),
      // orderActions: orderActionSlots.map(this.serializeOrdersItem),
      // inventory: inventorySlots.map(this.serializeOrdersItem),
      // hotbar: hotbarSlots.map(this.serializeOrdersItem),
    };
  }

  private serializeOrdersItem = (slot: Window["slots"][number]) => {
    if (!slot) return null;

    const loreComponent = (slot as ItemWithComponents).components?.find(
      (component) => component.type === "lore",
    );

    if (!loreComponent) return null;

    const price = this.getOrderPrice(loreComponent);
    const orderUser = this.getOrderUser(loreComponent);
    const { orderAmount, deliveredAmount } =
      this.getOrderAmounts(loreComponent);

    return {
      slot: slot.slot,
      order: {
        itemId: slot.name,
        displayName: slot.displayName,
        price,
        orderUser,
        orderAmount,
        deliveredAmount,
        updatedAt: new Date().toISOString(),
      },
    };
  };

  private getOrderPrice = (loreComponent?: LoreComponent) => {
    let rawPrice =
      loreComponent?.data?.[1]?.value?.extra?.value?.value?.[0]?.text?.value;

    if (!rawPrice?.trim()) return;
    if (rawPrice[0] === "$") rawPrice = rawPrice.slice(1);

    return decodeCompactNumber(rawPrice);
  };

  private getOrderAmounts = (loreComponent?: LoreComponent) => {
    const rawOrderAmount =
      loreComponent?.data?.[2].value.extra.value.value[2].text.value;
    const rawDeliveredAmount =
      loreComponent?.data?.[2].value.extra.value.value[0].text.value;

    const orderAmount = decodeCompactNumber(rawOrderAmount);
    const deliveredAmount = decodeCompactNumber(rawDeliveredAmount);

    return { orderAmount, deliveredAmount };
  };

  private getOrderUser = (loreComponent?: LoreComponent) => {
    const loreText =
      loreComponent?.data?.[4].value.extra.value.value[0].text.value;
    const prefix = "Click to deliver ";

    if (!loreText?.startsWith(prefix)) return;

    const remainder = loreText.slice(prefix.length);
    const orderUser = remainder.split(" ")[0];

    return orderUser.trim();
  };
}

type LoreComponent = {
  type?: string;
  data?: any[];
};

type ItemWithComponents = NonNullable<Window["slots"][number]> & {
  components?: LoreComponent[];
};
