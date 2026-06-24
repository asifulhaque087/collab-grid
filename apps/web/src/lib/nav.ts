import {
  LayoutGrid,
  Boxes,
  Users,
  Shield,
  CreditCard,
  ShoppingBag,
  LineChart,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

// Single source of truth for the sidebar. Sections/items can later be
// filtered by role (e.g. super-admin hides Orders) — render full tenant nav.
export const navSections: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { label: "Boards", href: "/dashboard/boards", icon: LayoutGrid, badge: "4" },
      { label: "Inventory", href: "/dashboard/inventory", icon: Boxes, badge: "128" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/dashboard/users", icon: Users },
      { label: "Roles", href: "/dashboard/roles", icon: Shield },
      { label: "Plans", href: "/dashboard/plans", icon: CreditCard },
      { label: "Orders", href: "/dashboard/orders", icon: ShoppingBag, badge: "18" },
      { label: "Transactions", href: "/dashboard/transactions", icon: LineChart },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];
