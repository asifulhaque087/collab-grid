"use client";

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
import type { Role } from "@/types";

export function RolesTable({ roles }: { roles: Role[] }) {
  return (
    <DataTable
      head={
        <>
          <Th>Role Name</Th>
          <Th>Members</Th>
          <Th>Permissions</Th>
          <Th>Created By</Th>
          <Th>Created</Th>
          <Th align="right">Actions</Th>
        </>
      }
      footer={<TableFooter info="2 of 3 custom roles used (Free Plan)" />}
    >
      {roles.map((role) => (
        <Tr key={role.id}>
          <Td variant="primary">{role.name}</Td>
          <Td variant="mono">{role.members}</Td>
          <Td>{role.permissions}</Td>
          <Td>
            {role.createdByKind === "system" ? (
              <StatusBadge variant="active">{role.createdBy}</StatusBadge>
            ) : (
              <TypePill>{role.createdBy}</TypePill>
            )}
          </Td>
          <Td variant="mono">{role.created}</Td>
          <Td align="right">
            <RowActions>
              {role.system ? (
                <RowActionButton title="View" onClick={() => toast.info("Opening role detail…")}>
                  <Eye />
                </RowActionButton>
              ) : (
                <>
                  <RowActionButton title="Edit" onClick={() => toast.info("Opening role editor…")}>
                    <Pencil />
                  </RowActionButton>
                  <RowActionButton title="Delete" onClick={() => toast.success("Role deleted")}>
                    <Trash2 />
                  </RowActionButton>
                </>
              )}
            </RowActions>
          </Td>
        </Tr>
      ))}
    </DataTable>
  );
}
