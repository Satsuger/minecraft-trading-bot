import { decodeCompactNumber } from "@minecraft-trading-bot/utils";
import type { Window } from "prismarine-windows";

type WindowType = "auction" | "crafting" | "orders" | "unknown";
type WindowWithInventoryTitle = Window & { inventoryTitle?: string };

interface WindowEvent {
  openedAt: number;
  type: WindowType;
  window: Window;
}

interface PendingWindowWaiter {
  id: string;
  predicate: (event: WindowEvent) => boolean;
  resolve: (window: Window) => void;
}

export class WindowService {
  private pending: PendingWindowWaiter[] = [];

  handleWindowOpen = (window: Window) => {
    const type = this.classify(window);

    const event: WindowEvent = {
      type,
      window,
      openedAt: Date.now(),
    };

    for (const waiter of [...this.pending]) {
      if (!waiter.predicate(event)) continue;
      waiter.resolve(event.window);
      this.removeWaiter(waiter.id);
      break;
    }
  };

  private removeWaiter(id: string) {
    this.pending = this.pending.filter((waiter) => waiter.id !== id);
  }

  waitForWindow(
    predicate: (event: WindowEvent) => boolean,
    timeoutMs = 5000,
  ): Promise<Window> {
    return new Promise<Window>((resolve, reject) => {
      const id = crypto.randomUUID();

      const timeoutId = setTimeout(() => {
        this.removeWaiter(id);
        reject(new Error("Timed out waiting for window"));
      }, timeoutMs);

      this.pending.push({
        id,
        predicate,
        resolve: (window) => {
          clearTimeout(timeoutId);
          resolve(window);
        },
      });
    });
  }

  waitForWindowType(type: WindowType, timeoutMs = 5000): Promise<Window> {
    return this.waitForWindow((event) => event.type === type, timeoutMs);
  }

  waitForOrdersWindow(timeoutMs = 5000): Promise<Window> {
    return this.waitForWindowType("orders", timeoutMs);
  }

  waitForAuctionWindow(timeoutMs = 5000): Promise<Window> {
    return this.waitForWindowType("auction", timeoutMs);
  }

  waitForCraftingWindow(timeoutMs = 5000): Promise<Window> {
    return this.waitForWindowType("crafting", timeoutMs);
  }

  private classify(window: Window): WindowType {
    const title = this.getTitle(window)?.toLowerCase();

    if (this.isOrdersWindow(title)) return "orders";
    if (title.includes("auction")) return "auction";
    if (title.includes("craft")) return "crafting";

    return "unknown";
  }

  private isOrdersWindow(windowTitle: string): boolean {
    const ordersTitleVariants = ["orders", "ᴏʀᴅᴇʀѕ"];

    return ordersTitleVariants.some((variant) =>
      windowTitle.toLowerCase().includes(variant),
    );
  }

  private getTitle(window: Window): string {
    const windowWithFlexibleTitle = window as Omit<
      WindowWithInventoryTitle,
      "title"
    > & {
      title?: string | { value?: string };
    };
    const { title } = windowWithFlexibleTitle;

    if (typeof title === "string") return title;
    if (title?.value) return title.value;

    return windowWithFlexibleTitle.inventoryTitle ?? "";
  }

  getPaginationPage(window: Window): number | null {
    const title = this.getTitle(window);
    const match = title.match(/page\s+(\d+)/i);

    if (!match) return null;

    return Number.parseInt(match[1], 10);
  }

  // -------------------- ORDERS WINDOW SERIALIZATION --------------------
  serializeOrdersWindow(window: Window) {
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

  private getOrderUser = (loreComponent?: any) => {
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
