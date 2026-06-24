"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddPlanModal } from "./add-plan-modal";

export function PlansActions() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Create Plan
      </Button>
      <AddPlanModal open={open} onOpenChange={setOpen} />
    </>
  );
}
