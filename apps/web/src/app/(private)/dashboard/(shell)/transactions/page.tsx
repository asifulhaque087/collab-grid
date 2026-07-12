import { TransactionsView } from "@/components/transactions/transactions-view";
import type { Transaction } from "@/types";
import { API_URL, authHeaders } from "@/lib/api";

interface ApiPayment {
  id: string;
  planName: string;
  durationMonth: number;
  amountPaid: string;
  transactionId: string;
  paymentMethod: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

async function fetchPayments(): Promise<ApiPayment[]> {
  const res = await fetch(`${API_URL}/subscription/payments`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

function toTransaction(p: ApiPayment): Transaction {
  return {
    id: p.transactionId,
    order: `${p.planName} · ${p.durationMonth}mo`,
    method: p.paymentMethod,
    amount: `$${p.amountPaid}`,
    amountTone: "committed",
    gatewayRef: p.transactionId,
    status: "success",
    timestamp: new Date(p.createdAt).toLocaleString(),
  };
}

export default async function TransactionsPage() {
  const payments = await fetchPayments();
  const transactions = payments.map(toTransaction);
  return <TransactionsView transactions={transactions} />;
}
