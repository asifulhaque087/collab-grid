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
import { deleteInventory } from "@/actions/inventory";
import { BoardSelector, type BoardOption } from "./board-selector";
import { AddInventoryModal } from "./add-inventory-modal";
import type { ApiInventory } from "@/types";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPrice(price: string | null) {
  if (!price) return "—";
  const n = Number(price);
  return Number.isNaN(n) ? price : `৳${n.toLocaleString()}`;
}

export function InventoryTable({
  items,
  boards,
}: {
  items: ApiInventory[];
  boards: BoardOption[];
}) {
  const [editing, setEditing] = useState<ApiInventory | null>(null);
  const [deleting, setDeleting] = useState<ApiInventory | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      try {
        await deleteInventory(target.id);
        toast.success(`"${target.name}" deleted`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete item");
      } finally {
        setDeleting(null);
      }
    });
  }

  return (
    <>
      <DataTable
        head={
          <>
            <Th>SKU</Th>
            <Th>Item Name</Th>
            <Th>Quantity</Th>
            <Th>Price</Th>
            <Th>Board</Th>
            <Th>Created</Th>
            <Th align="right">Actions</Th>
          </>
        }
        footer={<TableFooter info={`Showing ${items.length} item${items.length === 1 ? "" : "s"}`} />}
      >
        {items.map((item) => (
          <Tr key={item.id}>
            <Td variant="mono">{item.sku}</Td>
            <Td variant="primary">{item.name}</Td>
            <Td variant="mono">{item.quantity}</Td>
            <Td variant="mono">{formatPrice(item.price)}</Td>
            <Td>
              <BoardSelector
                itemId={item.id}
                boards={boards}
                initialBoardId={item.boardId}
                initialBoardName={item.boardName}
              />
            </Td>
            <Td variant="mono">{formatDate(item.createdAt)}</Td>
            <Td align="right">
              <RowActions>
                <RowActionButton title="Edit" onClick={() => setEditing(item)}>
                  <Pencil />
                </RowActionButton>
                <RowActionButton title="Delete" onClick={() => setDeleting(item)}>
                  <Trash2 />
                </RowActionButton>
              </RowActions>
            </Td>
          </Tr>
        ))}
      </DataTable>

      <AddInventoryModal
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        item={editing ?? undefined}
        boards={boards}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inventory item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong className="text-text">&ldquo;{deleting?.name}&rdquo;</strong>? This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete item"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
