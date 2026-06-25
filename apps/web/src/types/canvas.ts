export type WidgetState = "active" | "mine" | "peer" | "sold";

export interface CanvasWidget {
  id: string;
  name: string;
  price: string; // "৳4,500"
  qty: number;
  img: string;
  state: WidgetState;
  x: number;
  y: number;
  width: number;
  locker?: string; // for peer-locked widgets
  lockTime?: number; // remaining seconds for peer lock
}

export interface InventoryThumb {
  id: string;
  name: string;
  price: string;
  img: string;
  qty: number;
  placed: boolean;
}

export interface Peer {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

export interface PresenceAvatar {
  id: string;
  initials: string;
  gradient: string;
  online: boolean;
  title: string;
}

export interface BoardCanvas {
  /** Real board id when the board exists in the API; null for mock fallback. */
  boardId: string | null;
  slug: string;
  title: string;
  access: "public" | "restricted";
  widgets: CanvasWidget[];
  inventory: InventoryThumb[];
  peers: Peer[];
  presence: PresenceAvatar[];
  presenceCount: number;
}
