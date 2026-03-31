import { Outlet } from "react-router-dom";
import { useDashboardConnection } from "../../hooks/use-dashboard-connection.js";
import { MainNav } from "../navigation/main-nav.js";

export function AppLayout() {
  const { config, connectionState, payload } = useDashboardConnection();

  return (
    <div className="app-shell">
      <header className="topbar panel">
        <div className="topbar-copy">
          <span className="eyebrow">Frontend Navigation</span>
          <h1>Minecraft Trading Bot</h1>
        </div>
        <MainNav />
        <span className="status">{connectionState}</span>
      </header>

      <Outlet
        context={{
          config,
          connectionState,
          payload,
        }}
      />
    </div>
  );
}
