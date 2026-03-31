import type { DashboardRuntimeConfig, InventoryStatePayload } from "@torgash/types";
import { useOutletContext } from "react-router-dom";

export type DashboardLayoutContext = {
  config: DashboardRuntimeConfig;
  connectionState: string;
  payload: InventoryStatePayload | null;
};

export function useDashboardLayoutContext() {
  return useOutletContext<DashboardLayoutContext>();
}
