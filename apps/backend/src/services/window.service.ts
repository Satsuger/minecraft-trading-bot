import type { Bot } from "mineflayer";
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

  constructor(private readonly bot: Bot) {
    this.bot.on("windowOpen", this.handleWindowOpen.bind(this));
  }

  private handleWindowOpen(window: Window) {
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
  }

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

  
}
