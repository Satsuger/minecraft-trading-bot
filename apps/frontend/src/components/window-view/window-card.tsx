import type { SerializedWindow } from "@torgash/types";
import { SlotSection } from "./slot-section.js";

export function WindowCard({
  activeSlot = null,
  subtitle,
  title,
  windowState,
}: {
  activeSlot?: number | null;
  subtitle?: string;
  title: string;
  windowState: SerializedWindow;
}) {
  const accessorySlots = windowState.slots.slice(0, windowState.inventoryStart);
  const mainSlots = windowState.slots.slice(
    windowState.inventoryStart,
    windowState.hotbarStart,
  );
  const hotbarSlots = windowState.slots.slice(
    windowState.hotbarStart,
    windowState.inventoryEnd,
  );
  const showInventorySections = windowState.id === 0;

  return (
    <section className="window-card">
      <div className="window-title">
        <strong>{title}</strong>
        <span>{subtitle ?? windowState.title}</span>
      </div>

      {showInventorySections ? (
        <>
          <SlotSection
            startIndex={0}
            title="Equipment / Crafting"
            slots={accessorySlots}
          />
          <SlotSection
            startIndex={windowState.inventoryStart}
            title="Main Inventory"
            slots={mainSlots}
          />
          <SlotSection
            activeSlot={activeSlot}
            startIndex={windowState.hotbarStart}
            title="Hotbar"
            slots={hotbarSlots}
          />
        </>
      ) : (
        <SlotSection startIndex={0} title="Container Slots" slots={accessorySlots} />
      )}

      {windowState.selectedItem ? (
        <SlotSection
          startIndex={windowState.selectedItem.slot}
          title="Cursor Item"
          slots={[windowState.selectedItem]}
        />
      ) : null}
    </section>
  );
}
