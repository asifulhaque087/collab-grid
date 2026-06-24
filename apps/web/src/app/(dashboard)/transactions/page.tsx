import { getTransactions } from "@/lib/mock/commerce";
import { TransactionsView } from "@/components/transactions/transactions-view";

export default async function TransactionsPage() {
  const transactions = await getTransactions();
  return <TransactionsView transactions={transactions} />;
}
