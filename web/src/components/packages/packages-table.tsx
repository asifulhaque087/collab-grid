"use client";

import { useState, useTransition } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ViewPackageModal } from "./view-package-modal";
import {
  DataTable,
  Th,
  Tr,
  Td,
  TableFooter,
  RowActions,
} from "@/components/dashboard/data-table";
import { RowActionButton } from "@/components/dashboard/row-action-button";

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
import { deletePackage } from "@/actions/packages";
import type { ApiPackage } from "@/types";

interface PackagesTableProps {
  packages: ApiPackage[];
  onEdit: (pkg: ApiPackage) => void;
}

export function PackagesTable({ packages, onEdit }: PackagesTableProps) {
  const [deletingPackage, setDeletingPackage] = useState<ApiPackage | null>(null);
  const [viewingPackage, setViewingPackage] = useState<ApiPackage | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    if (!deletingPackage) return;
    startTransition(async () => {
      try {
        await deletePackage(deletingPackage.id);
        toast.success(`"${deletingPackage.title}" deleted`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete package");
      } finally {
        setDeletingPackage(null);
      }
    });
  }

  const customCount = packages.filter((p) => !p.isSystem).length;

  return (
    <>
      <DataTable
        head={
          <>
            <Th>Package</Th>
            <Th>Subscribers</Th>
            <Th>Permissions</Th>
            <Th align="right">Actions</Th>
          </>
        }
        footer={<TableFooter info={`${customCount} custom package${customCount !== 1 ? "s" : ""}`} />}
      >
        {packages.map((pkg) => (
          <Tr key={pkg.id}>
            <Td variant="primary">{pkg.title}</Td>
            <Td variant="mono">{pkg.subscriberCount}</Td>
            <Td>{pkg.permissions.length} permission{pkg.permissions.length !== 1 ? "s" : ""}</Td>
            <Td align="right">
              <RowActions>
                <RowActionButton title="View" onClick={() => setViewingPackage(pkg)}>
                  <Eye />
                </RowActionButton>
                <RowActionButton title="Edit" onClick={() => onEdit(pkg)}>
                  <Pencil />
                </RowActionButton>
                {!pkg.isSystem && (
                  <RowActionButton
                    title="Delete"
                    onClick={() => setDeletingPackage(pkg)}
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
        open={Boolean(deletingPackage)}
        onOpenChange={(open) => !open && setDeletingPackage(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete package</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong className="text-text">&ldquo;{deletingPackage?.title}&rdquo;</strong>?
              This will remove the package permanently and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete package"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ViewPackageModal
        open={Boolean(viewingPackage)}
        onOpenChange={(open) => !open && setViewingPackage(null)}
        pkg={viewingPackage}
      />
    </>
  );
}
