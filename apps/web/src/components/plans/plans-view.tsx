"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddPlanModal } from "./add-plan-modal";
import { PlansTable } from "./plans-table";
import type { ApiPlan, ApiPermission } from "@/types";

interface PlansViewProps {
  plans: ApiPlan[];
  permissions: ApiPermission[];
}

export function PlansView({ plans, permissions }: PlansViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ApiPlan | null>(null);

  function openCreate() {
    setEditingPlan(null);
    setModalOpen(true);
  }

  function openEdit(plan: ApiPlan) {
    setEditingPlan(plan);
    setModalOpen(true);
  }

  function handleOpenChange(open: boolean) {
    setModalOpen(open);
    if (!open) setEditingPlan(null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate}>
          <Plus />
          Create Plan
        </Button>
      </div>

      <PlansTable plans={plans} onEdit={openEdit} />

      <AddPlanModal
        open={modalOpen}
        onOpenChange={handleOpenChange}
        permissions={permissions}
        editingPlan={editingPlan}
      />
    </>
  );
}
