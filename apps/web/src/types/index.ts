// Shared domain types for the dashboard. These mirror the eventual API
// responses from `@apps/api`; for now they back the mock loaders in `lib/mock`.

export type BoardAccess = "public" | "restricted";

export interface BoardUserAvatar {
  initials: string;
  gradient: string;
}

export interface BoardMiniWidget {
  width: number;
  height: number;
  top: number;
  left: number;
  state: "active" | "soft-lock" | "committed";
}

export interface Board {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  access: BoardAccess;
  live: boolean;
  widgetCount: number;
  lockCount: number;
  onlineCount: number;
  users: BoardUserAvatar[];
  preview: BoardMiniWidget[];
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  totalQty: number;
  boardId: string | null;
  boardName: string | null;
  createdAt: string;
}

export type UserStatus = "active" | "inactive";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: UserStatus;
  joined: string;
}

export interface Role {
  id: string;
  name: string;
  members: number;
  permissions: string;
  createdBy: string;
  createdByKind: "system" | "pill";
  created: string;
  system: boolean;
}

export interface ApiPermission {
  id: string;
  name: string;
  action: string;
  subject: string;
  description: string | null;
}

export interface ApiRole {
  id: string;
  slug: string;
  title: string;
  createdBy: "constant" | "admin" | "tenant";
  createdByUserId: string | null;
  createdAt: string | null;
  isSystem: boolean;
  memberCount: number;
  permissions: ApiPermission[];
}

export interface Plan {
  id: string;
  name: string;
  price: string;
  priceUnit: string;
  quotaSummary: string;
  subscribers: number;
  badge: { label: string; variant: "active" | "sold" } | null;
  highlighted: boolean;
}

export type OrderStatus = "paid" | "pending" | "expired";

export interface Order {
  id: string;
  customer: string;
  widget: string;
  board: string;
  amount: string;
  amountTone: "committed" | "soft-lock" | "danger";
  payment: string;
  status: OrderStatus;
  date: string;
}

export type TransactionStatus = "success" | "pending" | "failed";

export interface Transaction {
  id: string;
  order: string;
  method: string;
  amount: string;
  amountTone: "committed" | "soft-lock" | "danger";
  gatewayRef: string;
  status: TransactionStatus;
  timestamp: string;
}

export interface Stat {
  label: string;
  value: string;
  icon: "boards" | "users" | "lock" | "checkout" | "box" | "units" | "alert";
  iconTone: "teal" | "brand" | "amber" | "emerald";
  change?: string;
  changeTone?: "up" | "down";
}
