"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Settings, User, LogOut } from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/actions/auth";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

function IconButton({
  label,
  badge,
  onClick,
  children,
}: {
  label: string;
  badge?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="relative grid size-9 place-items-center rounded-sm text-text-dim transition-colors hover:bg-surface-hover hover:text-text [&_svg]:size-[18px]"
    >
      {children}
      {badge && (
        <span className="absolute right-[5px] top-[5px] size-2 rounded-full border-2 border-surface bg-danger" />
      )}
    </button>
  );
}

// Derive up-to-two-letter initials from the user's name for the avatar.
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function HeaderActions({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await logoutAction();
    toast.success("Signed out");
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <>
      <IconButton label="Search" onClick={() => toast.info("Search panel coming soon")}>
        <Search />
      </IconButton>
      <IconButton label="Notifications" badge onClick={() => toast.info("No new notifications")}>
        <Bell />
      </IconButton>
      <IconButton label="Settings" onClick={() => toast.info("Navigating to settings…")}>
        <Settings />
      </IconButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            title={name}
            aria-label="Profile menu"
            className="ml-1.5 grid size-8 cursor-pointer place-items-center rounded-full bg-[linear-gradient(135deg,var(--color-brand-light),var(--color-active))] text-[0.8rem] font-semibold text-white transition-shadow hover:shadow-[0_0_0_2px_var(--color-active)] focus:outline-none data-[state=open]:shadow-[0_0_0_2px_var(--color-active)]"
          >
            {initialsOf(name)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-3 pb-2 pt-1">
            <div className="truncate text-[0.85rem] font-semibold text-text">
              {name}
            </div>
            <div className="truncate font-mono text-[0.7rem] text-text-muted">
              {email}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push("/dashboard/settings")}>
            <User />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            danger
            disabled={loggingOut}
            onSelect={(e) => {
              e.preventDefault();
              void handleLogout();
            }}
          >
            <LogOut />
            {loggingOut ? "Signing out…" : "Log out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
