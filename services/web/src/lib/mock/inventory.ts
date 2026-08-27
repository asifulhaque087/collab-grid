import type { InventoryItem, Stat } from "@/types";

export interface BoardOption {
  id: string;
  name: string;
}

const boardOptions: BoardOption[] = [
  { id: "flash", name: "Friday Flash Sale" },
  { id: "retail", name: "Retail Manager Competition" },
  { id: "summer", name: "Summer Collection Preview" },
];

const items: InventoryItem[] = [
  { id: "i1", sku: "SKU-4821", name: "Jamdani Saree — Premium", totalQty: 45, boardId: "flash", boardName: "Friday Flash Sale", createdAt: "Jun 01" },
  { id: "i2", sku: "SKU-1203", name: "Kantha Stitch Scarf", totalQty: 120, boardId: "flash", boardName: "Friday Flash Sale", createdAt: "Jun 03" },
  { id: "i3", sku: "SKU-0087", name: "Nakshi Kantha — Limited", totalQty: 30, boardId: "retail", boardName: "Retail Manager Competition", createdAt: "Jun 05" },
  { id: "i4", sku: "SKU-3390", name: "Leather Bag — Artisan", totalQty: 18, boardId: null, boardName: null, createdAt: "Jun 09" },
  { id: "i5", sku: "SKU-7711", name: "Panjabi — Eid Special", totalQty: 64, boardId: "summer", boardName: "Summer Collection Preview", createdAt: "Jun 12" },
];

const stats: Stat[] = [
  { label: "Total SKUs", value: "128", icon: "box", iconTone: "teal", change: "↑ 14 this month", changeTone: "up" },
  { label: "Total Units", value: "4,230", icon: "units", iconTone: "brand", change: "Available stock", changeTone: "up" },
  { label: "Reserved", value: "87", icon: "lock", iconTone: "amber", change: "Across 3 boards", changeTone: "down" },
  { label: "Low Stock", value: "5", icon: "alert", iconTone: "emerald", change: "Below 10 units", changeTone: "down" },
];

export async function getInventory(): Promise<InventoryItem[]> {
  return items;
}

export async function getInventoryStats(): Promise<Stat[]> {
  return stats;
}

export async function getBoardOptions(): Promise<BoardOption[]> {
  return boardOptions;
}
