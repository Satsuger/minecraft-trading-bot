import type { SerializableItem } from "@torgash/types";
import { SlotCard } from "./slot-card.js";

export function SlotSection({
  activeSlot = null,
  slots,
  startIndex,
  title,
}: {
  activeSlot?: number | null;
  slots: Array<SerializableItem | null>;
  startIndex: number;
  title: string;
}) {
  if (!slots.length) {
    return null;
  }

  return (
    <section className="window-section">
      <h3>{title}</h3>
      <div className="slot-grid">
        {slots.map((item, index) => {
          const slotIndex = startIndex + index;
          return (
            <SlotCard
              key={`${title}-${slotIndex}`}
              active={activeSlot === slotIndex}
              hotbar={title === "Hotbar"}
              index={slotIndex}
              item={item}
            />
          );
        })}
      </div>
    </section>
  );
}
