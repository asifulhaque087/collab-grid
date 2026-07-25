"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/dashboard/search-bar";

export function OrdersActions() {
  return (
    <>
      <SearchBar placeholder="Search by order ID or customer…" />
      <Button variant="secondary" onClick={() => toast.success("Exporting orders…")}>
        <Download />
        Export
      </Button>
    </>
  );
}
