import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

interface SerializableItem {
  count: number;
  displayName: string;
  durabilityUsed: number | null;
  maxDurability: number | null;
  metadata: number;
  name: string;
  slot: number;
  stackSize: number | null;
  type: number;
}

interface SerializedWindow {
  hotbarStart: number;
  id: number;
  inventoryEnd: number;
  inventoryStart: number;
  selectedItem: SerializableItem | null;
  slotCount: number;
  slots: Array<SerializableItem | null>;
  title: string;
  type: number | string;
}

interface InventoryStatePayload {
  currentWindow: SerializedWindow | null;
  heldItem: SerializableItem | null;
  inventory: SerializedWindow;
  quickBarSlot: number | null;
  username: string;
}

interface DashboardConfig {
  socketPath: string;
  viewerPath: string;
}

interface SocketLike {
  on: (event: string, handler: (...args: any[]) => void) => void;
  off?: (event: string, handler: (...args: any[]) => void) => void;
  disconnect?: () => void;
}

declare global {
  interface Window {
    __MC_DASHBOARD__?: DashboardConfig;
    io?: (options: { path: string }) => SocketLike;
  }
}

function App() {
  const config = window.__MC_DASHBOARD__;
  const [connectionState, setConnectionState] = useState("Connecting...");
  const [payload, setPayload] = useState<InventoryStatePayload | null>(null);

  useEffect(() => {
    if (!config || !window.io) {
      setConnectionState("Socket client unavailable");
      return;
    }

    const socket = window.io({ path: config.socketPath });
    const onConnect = () => setConnectionState("Connected");
    const onDisconnect = () => setConnectionState("Disconnected");
    const onInventoryState = (nextPayload: InventoryStatePayload) => {
      setPayload(nextPayload);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("inventoryState", onInventoryState);

    return () => {
      socket.off?.("connect", onConnect);
      socket.off?.("disconnect", onDisconnect);
      socket.off?.("inventoryState", onInventoryState);
      socket.disconnect?.();
    };
  }, [config]);

  if (!config) {
    return <div className="shell-error">Missing dashboard configuration.</div>;
  }

  const heldItemLabel = payload?.heldItem
    ? `${payload.heldItem.displayName} x${payload.heldItem.count}`
    : "Empty hand";
  const currentWindowLabel = payload?.currentWindow
    ? payload.currentWindow.title || String(payload.currentWindow.type)
    : "No container open";

  return (
    <div className="layout">
      <section className="panel viewer-panel">
        <header className="panel-header">
          <div>
            <span className="eyebrow">World View</span>
            <h1>Prismarine Viewer</h1>
          </div>
          <span className="status">{connectionState}</span>
        </header>
        <div className="viewer-frame-wrap">
          <iframe src={config.viewerPath} title="Minecraft bot viewer" />
        </div>
      </section>

      <aside className="panel sidebar">
        <header className="panel-header">
          <div>
            <span className="eyebrow">Live Slots</span>
            <h2>Inventory Dashboard</h2>
          </div>
          <span className="status subtle">{payload?.username ?? "Waiting for bot"}</span>
        </header>

        <div className="sidebar-content">
          <section className="meta-grid">
            <MetaCard label="Held Item" value={heldItemLabel} />
            <MetaCard
              label="Selected Hotbar"
              value={payload?.quickBarSlot == null ? "n/a" : String(payload.quickBarSlot)}
            />
            <MetaCard label="Open Window" value={currentWindowLabel} />
            <MetaCard
              label="Container Slots"
              value={
                payload?.currentWindow
                  ? String(payload.currentWindow.inventoryStart)
                  : "0"
              }
            />
          </section>

          {payload ? (
            <>
              <WindowCard
                activeSlot={
                  payload.quickBarSlot == null
                    ? null
                    : payload.inventory.hotbarStart + payload.quickBarSlot
                }
                title="Player Inventory"
                windowState={payload.inventory}
              />
              <CurrentWindowCard windowState={payload.currentWindow} />
            </>
          ) : (
            <section className="window-card empty-state">
              Waiting for inventory state from the bot server.
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="meta-card">
      <span className="meta-label">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function CurrentWindowCard({
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
      title={windowState.title || "Opened Window"}
      subtitle={String(windowState.type)}
      windowState={windowState}
    />
  );
}

function WindowCard({
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
  const accessorySlots = windowState === null
    ? []
    : windowState.slots.slice(0, windowState.inventoryStart);
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
            title="Equipment / Crafting"
            slots={accessorySlots}
            startIndex={0}
          />
          <SlotSection
            title="Main Inventory"
            slots={mainSlots}
            startIndex={windowState.inventoryStart}
          />
          <SlotSection
            activeSlot={activeSlot}
            title="Hotbar"
            slots={hotbarSlots}
            startIndex={windowState.hotbarStart}
          />
        </>
      ) : (
        <SlotSection title="Container Slots" slots={accessorySlots} startIndex={0} />
      )}

      {windowState.selectedItem ? (
        <SlotSection
          title="Cursor Item"
          slots={[windowState.selectedItem]}
          startIndex={windowState.selectedItem.slot}
        />
      ) : null}
    </section>
  );
}

function SlotSection({
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
              index={slotIndex}
              item={item}
              hotbar={title === "Hotbar"}
            />
          );
        })}
      </div>
    </section>
  );
}

function SlotCard({
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

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing root element");
}

createRoot(rootElement).render(<App />);
