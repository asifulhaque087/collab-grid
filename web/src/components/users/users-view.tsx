"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddUserModal } from "./add-user-modal";
import { UsersTable } from "./users-table";
import type { ApiRole, ApiUser } from "@/types";

interface UsersViewProps {
  users: ApiUser[];
  roles: ApiRole[];
}

export function UsersView({ users, roles }: UsersViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);

  function openCreate() {
    setEditingUser(null);
    setModalOpen(true);
  }

  function openEdit(user: ApiUser) {
    setEditingUser(user);
    setModalOpen(true);
  }

  function handleOpenChange(open: boolean) {
    setModalOpen(open);
    if (!open) setEditingUser(null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate}>
          <Plus />
          Add User
        </Button>
      </div>

      <UsersTable users={users} onEdit={openEdit} />

      <AddUserModal
        open={modalOpen}
        onOpenChange={handleOpenChange}
        roles={roles}
        editingUser={editingUser}
      />
    </>
  );
}
