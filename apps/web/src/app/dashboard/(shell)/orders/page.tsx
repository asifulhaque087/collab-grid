import { getOrders } from "@/lib/mock/commerce";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  DataTable,
  Th,
  Tr,
  Td,
  TableFooter,
} from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { OrdersActions } from "@/components/orders/orders-actions";
import type { OrderStatus } from "@/types";

const statusBadge: Record<OrderStatus, { variant: "sold" | "locked" | "expired"; label: string }> = {
  paid: { variant: "sold", label: "Paid" },
  pending: { variant: "locked", label: "Pending" },
  expired: { variant: "expired", label: "Expired" },
};

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="All completed and pending checkout transactions"
        actions={<OrdersActions />}
      />
      <DataTable
        head={
          <>
            <Th>Order ID</Th>
            <Th>Customer</Th>
            <Th>Widget</Th>
            <Th>Board</Th>
            <Th>Amount</Th>
            <Th>Payment</Th>
            <Th>Status</Th>
            <Th>Date</Th>
          </>
        }
        footer={
          <TableFooter
            info={`Showing ${orders.length} of 18 orders`}
            pages={["1", "2", "3", "→"]}
          />
        }
      >
        {orders.map((order) => (
          <Tr key={order.id}>
            <Td variant="mono">{order.id}</Td>
            <Td variant="primary">{order.customer}</Td>
            <Td>{order.widget}</Td>
            <Td>{order.board}</Td>
            <Td variant="mono" tone={order.amountTone}>
              {order.amount}
            </Td>
            <Td>{order.payment}</Td>
            <Td>
              <StatusBadge variant={statusBadge[order.status].variant}>
                {statusBadge[order.status].label}
              </StatusBadge>
            </Td>
            <Td variant="mono">{order.date}</Td>
          </Tr>
        ))}
      </DataTable>
    </>
  );
}
