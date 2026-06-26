import type { ApiInventory } from "@/types";
import type { CanvasWidget, InventoryThumb, WidgetState } from "@/types/canvas";
import type { ServerWidget } from "@/types/realtime";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=200&h=200&fit=crop";

export function formatTaka(price: string | null): string {
  if (!price) return "৳0";
  const n = Number(price);
  return Number.isNaN(n) ? `৳${price}` : `৳${n.toLocaleString()}`;
}

// Maps an API inventory record to a canvas sidebar thumbnail. An item is
// "placed" once it has canvas coordinates (posX set).
export function toInventoryThumb(item: ApiInventory): InventoryThumb {
  return {
    id: item.id,
    name: item.name,
    price: formatTaka(item.price),
    img: item.photo ?? FALLBACK_IMG,
    qty: item.quantity,
    placed: item.posX !== null,
  };
}

// Maps a realtime board widget to the canvas widget model. Lock state is
// resolved against the current user: their own lock → "mine", a peer's → "peer".
export function serverWidgetToCanvas(
  w: ServerWidget,
  myUserId: string | null,
  peerName?: string,
): CanvasWidget {
  let state: WidgetState = "active";
  let lockTime: number | undefined;
  let locker: string | undefined;
  if (w.lock) {
    state = w.lock.userId === myUserId ? "mine" : "peer";
    lockTime = Math.ceil(w.lock.ttl / 1000);
    if (state === "peer") locker = peerName ?? "Someone";
  }
  return {
    id: w.id,
    name: w.name,
    price: `৳${w.price.toLocaleString()}`,
    qty: w.quantity,
    img: w.photo ?? FALLBACK_IMG,
    state,
    x: w.x,
    y: w.y,
    width: w.width,
    locker,
    lockTime,
  };
}
