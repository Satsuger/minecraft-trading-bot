import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { InventoryStatePayload } from "@torgash/types";
import { getDashboardRuntimeConfig } from "../lib/dashboard-runtime.js";

export function useDashboardConnection() {
  const config = getDashboardRuntimeConfig();
  const [connectionState, setConnectionState] = useState("Connecting...");
  const [payload, setPayload] = useState<InventoryStatePayload | null>(null);

  useEffect(() => {
    const socket = io(config.backendUrl, {
      path: config.socketPath,
    });
    const onConnect = () => setConnectionState("Connected");
    const onDisconnect = () => setConnectionState("Disconnected");
    const onInventoryState = (nextPayload: InventoryStatePayload) => {
      setPayload(nextPayload);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("inventoryState", onInventoryState);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("inventoryState", onInventoryState);
      socket.disconnect();
    };
  }, [config.backendUrl, config.socketPath]);

  return {
    config,
    connectionState,
    payload,
  };
}
