export interface SerializableItem {
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

export interface SerializedWindow {
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

export interface InventoryStatePayload {
  currentWindow: SerializedWindow | null;
  heldItem: SerializableItem | null;
  inventory: SerializedWindow;
  quickBarSlot: number | null;
  username: string;
}

export interface DashboardRuntimeConfig {
  backendUrl: string;
  routePrefix: string;
  socketPath: string;
  viewerUrl: string;
}
