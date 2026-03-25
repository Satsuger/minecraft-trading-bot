import type { Bot } from "mineflayer";

const HOTBAR_SIZE = 9;

export interface InventoryItemSnapshot {
  count: number;
  displayName: string;
  metadata: number;
  name: string;
  slot: number;
  stackSize: number;
  type: number;
}

export class InventoryService {
  constructor(private readonly bot: Bot) {}

  getItems(): InventoryItemSnapshot[] {
    return this.bot.inventory.items().map((item) => this.serializeItem(item));
  }

  getInventoryItems(): InventoryItemSnapshot[] {
    return this.getItemsInRange(
      this.bot.inventory.inventoryStart,
      this.bot.inventory.hotbarStart,
    );
  }

  getHotbarItems(): InventoryItemSnapshot[] {
    const hotbarStart = this.bot.inventory.hotbarStart;

    return this.getItemsInRange(hotbarStart, hotbarStart + HOTBAR_SIZE);
  }

  async moveInventoryItemToHotbar(
    sourceSlot: number,
    hotbarSlot?: number,
  ): Promise<InventoryItemSnapshot> {
    this.assertInventorySlot(sourceSlot);

    const sourceItem = this.bot.inventory.slots[sourceSlot];
    if (!sourceItem) {
      throw new Error(`No item found in inventory slot ${sourceSlot}`);
    }

    const destinationSlot =
      hotbarSlot === undefined
        ? this.getFirstEmptyHotbarSlot()
        : this.getHotbarWindowSlot(hotbarSlot);

    await this.bot.moveSlotItem(sourceSlot, destinationSlot);

    const movedItem = this.bot.inventory.slots[destinationSlot];
    if (!movedItem) {
      throw new Error(
        `Failed to move item from inventory slot ${sourceSlot} to hotbar slot ${destinationSlot}`,
      );
    }

    return this.serializeItem(movedItem);
  }

  private getItemsInRange(
    startSlot: number,
    endSlot: number,
  ): InventoryItemSnapshot[] {
    return this.bot.inventory
      .itemsRange(startSlot, endSlot)
      .map((item) => this.serializeItem(item));
  }

  private getFirstEmptyHotbarSlot(): number {
    const hotbarStart = this.bot.inventory.hotbarStart;
    const slot = this.bot.inventory.firstEmptySlotRange(
      hotbarStart,
      hotbarStart + HOTBAR_SIZE,
    );

    if (slot === null) {
      throw new Error("No empty hotbar slot available");
    }

    return slot;
  }

  private getHotbarWindowSlot(hotbarSlot: number): number {
    if (!Number.isInteger(hotbarSlot)) {
      throw new Error("Hotbar slot must be an integer");
    }

    if (hotbarSlot < 0 || hotbarSlot >= HOTBAR_SIZE) {
      throw new Error(`Hotbar slot must be between 0 and ${HOTBAR_SIZE - 1}`);
    }

    return this.bot.inventory.hotbarStart + hotbarSlot;
  }

  private assertInventorySlot(slot: number): void {
    const { inventoryStart, hotbarStart } = this.bot.inventory;

    if (!Number.isInteger(slot)) {
      throw new Error("Inventory slot must be an integer");
    }

    if (slot < inventoryStart || slot >= hotbarStart) {
      throw new Error(
        `Inventory slot ${slot} is outside the main inventory range ${inventoryStart}-${hotbarStart - 1}`,
      );
    }
  }

  private serializeItem(
    item: NonNullable<Bot["inventory"]["slots"][number]>,
  ): InventoryItemSnapshot {
    return {
      slot: item.slot,
      type: item.type,
      name: item.name,
      displayName: item.displayName,
      count: item.count,
      metadata: item.metadata,
      stackSize: item.stackSize,
    };
  }
}
