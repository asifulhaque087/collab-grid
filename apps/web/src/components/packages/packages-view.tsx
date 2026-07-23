"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddPackageModal } from "./add-package-modal";
import { PackagesTable } from "./packages-table";
import type { ApiPackage, ApiPermission } from "@/types";

interface PackagesViewProps {
  packages: ApiPackage[];
  permissions: ApiPermission[];
}

export function PackagesView({ packages, permissions }: PackagesViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<ApiPackage | null>(null);

  function openCreate() {
    setEditingPackage(null);
    setModalOpen(true);
  }

  function openEdit(pkg: ApiPackage) {
    setEditingPackage(pkg);
    setModalOpen(true);
  }

  function handleOpenChange(open: boolean) {
    setModalOpen(open);
    if (!open) setEditingPackage(null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate}>
          <Plus />
          Create Package
        </Button>
      </div>

      <PackagesTable packages={packages} onEdit={openEdit} />

      <AddPackageModal
        open={modalOpen}
        onOpenChange={handleOpenChange}
        permissions={permissions}
        editingPackage={editingPackage}
      />
    </>
  );
}
