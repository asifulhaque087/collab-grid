"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/dashboard/search-bar";
import { AddInventoryModal } from "./add-inventory-modal";

export function InventoryActions() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SearchBar placeholder="Search by SKU or item name…" />
      <Button variant="secondary" onClick={() => toast.success("Exporting inventory as CSV…")}>
        <Download />
        Export
      </Button>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add Item
      </Button>
      <AddInventoryModal open={open} onOpenChange={setOpen} />
    </>
  );
}
