"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddRoleModal } from "./add-role-modal";
import { RolesTable } from "./roles-table";
import type { ApiRole, ApiPermission } from "@/types";

interface RolesViewProps {
  roles: ApiRole[];
  permissions: ApiPermission[];
}

export function RolesView({ roles, permissions }: RolesViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ApiRole | null>(null);

  function openCreate() {
    setEditingRole(null);
    setModalOpen(true);
  }

  function openEdit(role: ApiRole) {
    setEditingRole(role);
    setModalOpen(true);
  }

  function handleOpenChange(open: boolean) {
    setModalOpen(open);
    if (!open) setEditingRole(null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate}>
          <Plus />
          Create Role
        </Button>
      </div>

      <RolesTable roles={roles} onEdit={openEdit} />

      <AddRoleModal
        open={modalOpen}
        onOpenChange={handleOpenChange}
        permissions={permissions}
        editingRole={editingRole}
      />
    </>
  );
}
