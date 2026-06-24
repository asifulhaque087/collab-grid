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
      { label: "Boards", href: "/boards", icon: LayoutGrid, badge: "4" },
      { label: "Inventory", href: "/inventory", icon: Boxes, badge: "128" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/users", icon: Users },
      { label: "Roles", href: "/roles", icon: Shield },
      { label: "Plans", href: "/plans", icon: CreditCard },
      { label: "Orders", href: "/orders", icon: ShoppingBag, badge: "18" },
      { label: "Transactions", href: "/transactions", icon: LineChart },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Billing", href: "/billing", icon: CreditCard },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];
