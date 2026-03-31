import type { SerializableItem } from "@torgash/types";

export function SlotCard({
  active,
  hotbar,
  index,
  item,
}: {
  active: boolean;
  hotbar: boolean;
  index: number;
  item: SerializableItem | null;
}) {
  const className = [
    "slot",
    item ? "" : "empty",
    hotbar ? "hotbar" : "",
    active ? "active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const durability =
    item?.maxDurability != null && item.durabilityUsed != null
      ? `${item.maxDurability - item.durabilityUsed}/${item.maxDurability}`
      : null;

  return (
    <article className={className} title={item?.name ?? `Slot ${index}`}>
      <span className="slot-index">#{index}</span>
      {item ? (
        <>
          <div className="slot-name">{item.displayName}</div>
          <span className="slot-count">x{item.count}</span>
          {durability ? <span className="slot-extra">{durability}</span> : null}
        </>
      ) : null}
    </article>
  );
}
