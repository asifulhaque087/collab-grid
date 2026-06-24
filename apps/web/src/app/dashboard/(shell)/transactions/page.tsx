import { cookies } from "next/headers";
import { TransactionsView } from "@/components/transactions/transactions-view";
import type { Transaction } from "@/types";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

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
  const store = await cookies();
  const token = store.get("accessToken")?.value;
  const res = await fetch(`${API_URL}/subscription/payments`, {
    headers: token ? { Cookie: `accessToken=${token}` } : {},
    cache: "no-store",
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
