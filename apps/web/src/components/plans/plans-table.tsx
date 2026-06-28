"use client";

import { useState, useTransition } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ViewPlanModal } from "./view-plan-modal";
import {
  DataTable,
  Th,
  Tr,
  Td,
  TableFooter,
  RowActions,
} from "@/components/dashboard/data-table";
import { RowActionButton } from "@/components/dashboard/row-action-button";
import { StatusBadge, TypePill } from "@/components/dashboard/status-badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { deletePlan } from "@/actions/plans";
import type { ApiPlan } from "@/types";

interface PlansTableProps {
  plans: ApiPlan[];
  onEdit: (plan: ApiPlan) => void;
}

export function PlansTable({ plans, onEdit }: PlansTableProps) {
  const [deletingPlan, setDeletingPlan] = useState<ApiPlan | null>(null);
  const [viewingPlan, setViewingPlan] = useState<ApiPlan | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    if (!deletingPlan) return;
    startTransition(async () => {
      try {
        await deletePlan(deletingPlan.id);
        toast.success(`"${deletingPlan.title}" deleted`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete plan");
      } finally {
        setDeletingPlan(null);
      }
    });
  }

  const customCount = plans.filter((p) => !p.isSystem).length;

  return (
    <>
      <DataTable
        head={
          <>
            <Th>Plan Name</Th>
            <Th>Subscribers</Th>
            <Th>Permissions</Th>
            <Th>Created By</Th>
            <Th align="right">Actions</Th>
          </>
        }
        footer={<TableFooter info={`${customCount} custom plan${customCount !== 1 ? "s" : ""}`} />}
      >
        {plans.map((plan) => (
          <Tr key={plan.id}>
            <Td variant="primary">{plan.title}</Td>
            <Td variant="mono">{plan.subscriberCount}</Td>
            <Td>{plan.permissions.length} permission{plan.permissions.length !== 1 ? "s" : ""}</Td>
            <Td>
              {plan.isSystem ? (
                <StatusBadge variant="active">System</StatusBadge>
              ) : (
                <TypePill>{plan.createdBy}</TypePill>
              )}
            </Td>
            <Td align="right">
              <RowActions>
                <RowActionButton title="View" onClick={() => setViewingPlan(plan)}>
                  <Eye />
                </RowActionButton>
                <RowActionButton title="Edit" onClick={() => onEdit(plan)}>
                  <Pencil />
                </RowActionButton>
                {!plan.isSystem && (
                  <RowActionButton
                    title="Delete"
                    onClick={() => setDeletingPlan(plan)}
                  >
                    <Trash2 />
                  </RowActionButton>
                )}
              </RowActions>
            </Td>
          </Tr>
        ))}
      </DataTable>

      <AlertDialog
        open={Boolean(deletingPlan)}
        onOpenChange={(open) => !open && setDeletingPlan(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong className="text-text">&ldquo;{deletingPlan?.title}&rdquo;</strong>?
              This will remove the plan permanently and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete plan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ViewPlanModal
        open={Boolean(viewingPlan)}
        onOpenChange={(open) => !open && setViewingPlan(null)}
        plan={viewingPlan}
      />
    </>
  );
}
