"use client";

import { Pencil, Lock } from "lucide-react";
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
import { BoardSelector } from "./board-selector";
import type { InventoryItem } from "@/types";
import type { BoardOption } from "@/lib/mock/inventory";

export function InventoryTable({
  items,
  boards,
}: {
  items: InventoryItem[];
  boards: BoardOption[];
}) {
  return (
    <DataTable
      head={
        <>
          <Th>SKU</Th>
          <Th>Item Name</Th>
          <Th>Total Qty</Th>
          <Th>Board</Th>
          <Th>Created</Th>
          <Th align="right">Actions</Th>
        </>
      }
      footer={
        <TableFooter
          info={`Showing ${items.length} of 128 items`}
          pages={["1", "2", "3", "…", "22", "→"]}
        />
      }
    >
      {items.map((item) => (
        <Tr key={item.id}>
          <Td variant="mono">{item.sku}</Td>
          <Td variant="primary">{item.name}</Td>
          <Td variant="mono">{item.totalQty}</Td>
          <Td>
            <BoardSelector
              boards={boards}
              initialBoardId={item.boardId}
              initialBoardName={item.boardName}
            />
          </Td>
          <Td variant="mono">{item.createdAt}</Td>
          <Td align="right">
            <RowActions>
              <RowActionButton title="Edit" onClick={() => toast.info("Opening item detail…")}>
                <Pencil />
              </RowActionButton>
              <RowActionButton title="View locks" onClick={() => toast.info("Showing lock holders…")}>
                <Lock />
              </RowActionButton>
            </RowActions>
          </Td>
        </Tr>
      ))}
    </DataTable>
  );
}
