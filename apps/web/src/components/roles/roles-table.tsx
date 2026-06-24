"use client";

import { useState, useTransition } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { deleteRole } from "@/actions/roles";
import type { ApiRole } from "@/types";

interface RolesTableProps {
  roles: ApiRole[];
  onEdit: (role: ApiRole) => void;
}

export function RolesTable({ roles, onEdit }: RolesTableProps) {
  const [deletingRole, setDeletingRole] = useState<ApiRole | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    if (!deletingRole) return;
    startTransition(async () => {
      try {
        await deleteRole(deletingRole.id);
        toast.success(`"${deletingRole.title}" deleted`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete role");
      } finally {
        setDeletingRole(null);
      }
    });
  }

  const customCount = roles.filter((r) => !r.isSystem).length;

  return (
    <>
      <DataTable
        head={
          <>
            <Th>Role Name</Th>
            <Th>Members</Th>
            <Th>Permissions</Th>
            <Th>Created By</Th>
            <Th align="right">Actions</Th>
          </>
        }
        footer={<TableFooter info={`${customCount} custom role${customCount !== 1 ? "s" : ""}`} />}
      >
        {roles.map((role) => (
          <Tr key={role.id}>
            <Td variant="primary">{role.title}</Td>
            <Td variant="mono">{role.memberCount}</Td>
            <Td>{role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""}</Td>
            <Td>
              {role.isSystem ? (
                <StatusBadge variant="active">System</StatusBadge>
              ) : (
                <TypePill>{role.createdBy}</TypePill>
              )}
            </Td>
            <Td align="right">
              <RowActions>
                {role.isSystem ? (
                  <RowActionButton title="View" onClick={() => toast.info("System role — read only")}>
                    <Eye />
                  </RowActionButton>
                ) : (
                  <>
                    <RowActionButton title="Edit" onClick={() => onEdit(role)}>
                      <Pencil />
                    </RowActionButton>
                    <RowActionButton
                      title="Delete"
                      onClick={() => setDeletingRole(role)}
                    >
                      <Trash2 />
                    </RowActionButton>
                  </>
                )}
              </RowActions>
            </Td>
          </Tr>
        ))}
      </DataTable>

      <AlertDialog
        open={Boolean(deletingRole)}
        onOpenChange={(open) => !open && setDeletingRole(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong className="text-text">&ldquo;{deletingRole?.title}&rdquo;</strong>?
              This will remove the role from all assigned users and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
