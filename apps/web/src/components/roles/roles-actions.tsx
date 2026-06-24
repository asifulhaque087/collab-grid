"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddRoleModal } from "./add-role-modal";

export function RolesActions() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Create Role
      </Button>
      <AddRoleModal open={open} onOpenChange={setOpen} />
    </>
  );
}
