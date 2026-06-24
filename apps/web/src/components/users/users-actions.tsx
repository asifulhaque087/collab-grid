"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/dashboard/search-bar";
import { AddUserModal } from "./add-user-modal";

export function UsersActions() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SearchBar placeholder="Search by name or role…" />
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add User
      </Button>
      <AddUserModal open={open} onOpenChange={setOpen} />
    </>
  );
}
