"use client";

import { Pencil, CircleX, CircleCheck } from "lucide-react";
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
import type { User } from "@/types";

export function UsersTable({ users }: { users: User[] }) {
  return (
    <DataTable
      head={
        <>
          <Th>Name</Th>
          <Th>Email</Th>
          <Th>Role</Th>
          <Th>Status</Th>
          <Th>Joined</Th>
          <Th align="right">Actions</Th>
        </>
      }
      footer={<TableFooter info={`Showing ${users.length} users`} />}
    >
      {users.map((user) => (
        <Tr key={user.id}>
          <Td variant="primary">{user.name}</Td>
          <Td>{user.email}</Td>
          <Td>
            <TypePill>{user.role}</TypePill>
          </Td>
          <Td>
            <StatusBadge variant={user.status === "active" ? "active" : "idle"}>
              {user.status === "active" ? "Active" : "Inactive"}
            </StatusBadge>
          </Td>
          <Td variant="mono">{user.joined}</Td>
          <Td align="right">
            <RowActions>
              <RowActionButton title="Edit" onClick={() => toast.info("Opening user profile…")}>
                <Pencil />
              </RowActionButton>
              {user.status === "active" ? (
                <RowActionButton title="Deactivate" onClick={() => toast.success("User deactivated")}>
                  <CircleX />
                </RowActionButton>
              ) : (
                <RowActionButton title="Activate" onClick={() => toast.success("User activated")}>
                  <CircleCheck />
                </RowActionButton>
              )}
            </RowActions>
          </Td>
        </Tr>
      ))}
    </DataTable>
  );
}
