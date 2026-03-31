import { CurrentWindowCard } from "../components/window-view/current-window-card.js";
import { MetaCard } from "../components/window-view/meta-card.js";
import { WindowCard } from "../components/window-view/window-card.js";
import { useDashboardLayoutContext } from "../hooks/use-dashboard-layout-context.js";

export function WindowViewPage() {
  const { config, payload } = useDashboardLayoutContext();
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
            <h2>Prismarine Viewer</h2>
          </div>
          <span className="status subtle">{payload?.username ?? "Waiting for bot"}</span>
        </header>
        <div className="viewer-frame-wrap">
          <iframe src={config.viewerUrl} title="Minecraft bot viewer" />
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
              value={payload?.currentWindow ? String(payload.currentWindow.inventoryStart) : "0"}
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
