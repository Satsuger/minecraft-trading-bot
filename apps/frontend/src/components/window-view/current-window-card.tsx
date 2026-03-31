import type { SerializedWindow } from "@torgash/types";
import { WindowCard } from "./window-card.js";

export function CurrentWindowCard({
  windowState,
}: {
  windowState: SerializedWindow | null;
}) {
  if (!windowState) {
    return (
      <section className="window-card empty-state">
        Open a chest, trade, auction, or other container to inspect its slots here.
      </section>
    );
  }

  return (
    <WindowCard
      subtitle={String(windowState.type)}
      title={windowState.title || "Opened Window"}
      windowState={windowState}
    />
  );
}
