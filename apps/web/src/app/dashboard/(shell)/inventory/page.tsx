import {
  getInventory,
  getInventoryStats,
  getBoardOptions,
} from "@/lib/mock/inventory";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatsRow } from "@/components/dashboard/stat-card";
import { InventoryActions } from "@/components/inventory/inventory-actions";
import { InventoryTable } from "@/components/inventory/inventory-table";

export default async function InventoryPage() {
  const [items, stats, boards] = await Promise.all([
    getInventory(),
    getInventoryStats(),
    getBoardOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Manage SKU stock levels and widget linkage"
        actions={<InventoryActions />}
      />
      <StatsRow stats={stats} />
      <InventoryTable items={items} boards={boards} />
    </>
  );
}
