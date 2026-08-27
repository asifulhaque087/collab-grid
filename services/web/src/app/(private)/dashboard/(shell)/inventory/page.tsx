import { getInventoryItems } from "@/actions/inventory";
import { getBoards } from "@/actions/boards";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatsRow } from "@/components/dashboard/stat-card";
import { InventoryActions } from "@/components/inventory/inventory-actions";
import { InventoryTable } from "@/components/inventory/inventory-table";
import type { Stat } from "@/types";

export default async function InventoryPage() {
  const [items, boards] = await Promise.all([getInventoryItems(), getBoards()]);

  const boardChoices = boards.map((b) => ({ id: b.id, name: b.name }));
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const attached = items.filter((i) => i.boardId).length;

  const stats: Stat[] = [
    { label: "Total SKUs", value: String(items.length), icon: "box", iconTone: "teal" },
    { label: "Total Units", value: totalUnits.toLocaleString(), icon: "units", iconTone: "brand", change: "Available stock", changeTone: "up" },
    { label: "Attached", value: String(attached), icon: "boards", iconTone: "emerald", change: "Linked to a board", changeTone: "up" },
    { label: "Unattached", value: String(items.length - attached), icon: "alert", iconTone: "amber", change: "Not on a board", changeTone: "down" },
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Manage SKU stock levels and widget linkage"
        actions={<InventoryActions boards={boardChoices} />}
      />
      <StatsRow stats={stats} />
      <InventoryTable items={items} boards={boardChoices} />
    </>
  );
}
