"use client";

import { useState } from "react";
import { Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/dashboard/search-bar";
import { ImportInventoryModal } from "@/components/boards/import-inventory-modal";
import { AddInventoryModal, type BoardChoice } from "./add-inventory-modal";

export function InventoryActions({ boards }: { boards: BoardChoice[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <SearchBar placeholder="Search by SKU or item name…" />
      <Button variant="secondary" onClick={() => setImportOpen(true)}>
        <Upload />
        Import CSV
      </Button>
      <Button onClick={() => setAddOpen(true)}>
        <Plus />
        Add Item
      </Button>
      <AddInventoryModal open={addOpen} onOpenChange={setAddOpen} boards={boards} />
      <ImportInventoryModal open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
