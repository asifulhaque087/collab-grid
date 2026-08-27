"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DataTable,
  Th,
  Tr,
  Td,
  TableFooter,
} from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { Transaction, TransactionStatus } from "@/types";

const statusBadge: Record<
  TransactionStatus,
  { variant: "sold" | "locked" | "expired"; label: string }
> = {
  success: { variant: "sold", label: "Success" },
  pending: { variant: "locked", label: "Pending" },
  failed: { variant: "expired", label: "Failed" },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "success", label: "Success" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
] as const;

export function TransactionsView({ transactions }: { transactions: Transaction[] }) {
  const [filter, setFilter] = useState<string>("all");

  const rows =
    filter === "all"
      ? transactions
      : transactions.filter((t) => t.status === filter);

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Payment ledger across all orders"
        actions={
          <>
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList>
                {FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value}>
                    {f.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button variant="secondary" onClick={() => toast.success("Exporting transactions…")}>
              <Download />
              Export
            </Button>
          </>
        }
      />
      <DataTable
        head={
          <>
            <Th>TXN ID</Th>
            <Th>Order</Th>
            <Th>Method</Th>
            <Th>Amount</Th>
            <Th>Gateway Ref</Th>
            <Th>Status</Th>
            <Th>Timestamp</Th>
          </>
        }
        footer={<TableFooter info={`Showing ${rows.length} transactions`} />}
      >
        {rows.map((txn) => (
          <Tr key={txn.id}>
            <Td variant="mono">{txn.id}</Td>
            <Td variant="mono">{txn.order}</Td>
            <Td>{txn.method}</Td>
            <Td variant="mono" tone={txn.amountTone}>
              {txn.amount}
            </Td>
            <Td variant="mono">{txn.gatewayRef}</Td>
            <Td>
              <StatusBadge variant={statusBadge[txn.status].variant}>
                {statusBadge[txn.status].label}
              </StatusBadge>
            </Td>
            <Td variant="mono">{txn.timestamp}</Td>
          </Tr>
        ))}
      </DataTable>
    </>
  );
}
