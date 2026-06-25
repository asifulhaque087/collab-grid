import type { ApiInventory } from "@/types";
import type { InventoryThumb } from "@/types/canvas";

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
