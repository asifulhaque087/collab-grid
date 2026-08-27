"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
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
import { deleteUser } from "@/actions/users";
import type { ApiUser } from "@/types";

interface UsersTableProps {
  users: ApiUser[];
  onEdit: (user: ApiUser) => void;
}

export function UsersTable({ users, onEdit }: UsersTableProps) {
  const [deletingUser, setDeletingUser] = useState<ApiUser | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    if (!deletingUser) return;
    startTransition(async () => {
      try {
        await deleteUser(deletingUser.id);
        toast.success(`"${deletingUser.name}" deleted`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete user");
      } finally {
        setDeletingUser(null);
      }
    });
  }

  return (
    <>
      <DataTable
        head={
          <>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th align="right">Actions</Th>
          </>
        }
        footer={<TableFooter info={`Showing ${users.length} user${users.length !== 1 ? "s" : ""}`} />}
      >
        {users.map((user) => (
          <Tr key={user.id}>
            <Td variant="primary">{user.name}</Td>
            <Td>{user.email}</Td>
            <Td>
              {user.roles.length > 0 ? (
                user.roles.map((r) => (
                  <TypePill key={r.id}>{r.title}</TypePill>
                ))
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </Td>
            <Td>
              <StatusBadge variant="active">Active</StatusBadge>
            </Td>
            <Td align="right">
              <RowActions>
                <RowActionButton title="Edit" onClick={() => onEdit(user)}>
                  <Pencil />
                </RowActionButton>
                <RowActionButton
                  title="Delete"
                  onClick={() => setDeletingUser(user)}
                >
                  <Trash2 />
                </RowActionButton>
              </RowActions>
            </Td>
          </Tr>
        ))}
      </DataTable>

      <AlertDialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => !open && setDeletingUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong className="text-text">&ldquo;{deletingUser?.name}&rdquo;</strong>?
              This will remove the user and all their data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
