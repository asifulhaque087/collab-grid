import type { Order, Transaction, Plan } from "@/types";

const orders: Order[] = [
  { id: "ORD-001", customer: "user-29fa…", widget: "Jamdani Saree — Premium", board: "Friday Flash Sale", amount: "৳4,500", amountTone: "committed", payment: "bKash", status: "paid", date: "Jun 20" },
  { id: "ORD-002", customer: "user-83bc…", widget: "Kantha Stitch Scarf", board: "Friday Flash Sale", amount: "৳1,200", amountTone: "committed", payment: "Nagad", status: "paid", date: "Jun 20" },
  { id: "ORD-003", customer: "user-44ab…", widget: "Leather Bag — Artisan", board: "Retail Competition", amount: "৳8,900", amountTone: "soft-lock", payment: "SSLCommerz", status: "pending", date: "Jun 20" },
  { id: "ORD-004", customer: "user-12ef…", widget: "Panjabi — Eid Special", board: "Friday Flash Sale", amount: "৳3,800", amountTone: "danger", payment: "—", status: "expired", date: "Jun 19" },
  { id: "ORD-005", customer: "user-91hi…", widget: "Nakshi Kantha — Limited", board: "Retail Competition", amount: "৳6,200", amountTone: "committed", payment: "bKash", status: "paid", date: "Jun 18" },
];

const transactions: Transaction[] = [
  { id: "TXN-A1B2", order: "ORD-001", method: "bKash", amount: "৳4,500", amountTone: "committed", gatewayRef: "BK-8F3D…", status: "success", timestamp: "Jun 20 14:32" },
  { id: "TXN-C3D4", order: "ORD-002", method: "Nagad", amount: "৳1,200", amountTone: "committed", gatewayRef: "NG-2A9E…", status: "success", timestamp: "Jun 20 14:18" },
  { id: "TXN-E5F6", order: "ORD-003", method: "SSLCommerz", amount: "৳8,900", amountTone: "soft-lock", gatewayRef: "SSL-7B1C…", status: "pending", timestamp: "Jun 20 15:01" },
  { id: "TXN-G7H8", order: "ORD-004", method: "—", amount: "৳3,800", amountTone: "danger", gatewayRef: "—", status: "failed", timestamp: "Jun 19 11:44" },
  { id: "TXN-I9J0", order: "ORD-005", method: "bKash", amount: "৳6,200", amountTone: "committed", gatewayRef: "BK-4E2F…", status: "success", timestamp: "Jun 18 09:15" },
];

const plans: Plan[] = [
  { id: "free", name: "Free", price: "৳0", priceUnit: "/mo", quotaSummary: "2 boards · 3 custom roles · 25 widgets/board", subscribers: 12, badge: { label: "Active", variant: "active" }, highlighted: true },
  { id: "pro", name: "Pro", price: "$9", priceUnit: "/mo", quotaSummary: "15 boards · 20 custom roles · Unlimited widgets", subscribers: 4, badge: { label: "Popular", variant: "sold" }, highlighted: false },
];

export async function getOrders(): Promise<Order[]> {
  return orders;
}

export async function getTransactions(): Promise<Transaction[]> {
  return transactions;
}

export async function getPlans(): Promise<Plan[]> {
  return plans;
}
