"use client";

import * as React from "react";
import { createAbilityFor, type AppAbility, type PermissionTuple } from "@/lib/ability";

interface PermissionContextValue {
  permissions: PermissionTuple[];
  ability: AppAbility;
}

const PermissionContext = React.createContext<PermissionContextValue | null>(null);

// Provides the signed-in user's effective permissions (and a memoized CASL
// ability) to client components below the dashboard layout. Hydrated from the
// server-fetched user in the layout, so no client API call is needed.
export function PermissionProvider({
  children,
  permissions = [],
}: {
  children: React.ReactNode;
  permissions?: PermissionTuple[];
}) {
  const ability = React.useMemo(
    () => createAbilityFor({ permissions }),
    [permissions],
  );

  const value = React.useMemo<PermissionContextValue>(
    () => ({ permissions, ability }),
    [permissions, ability],
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

// Read the current user's permissions + ability. Use `ability.can(action,
// subject)` to conditionally render UI (e.g. hide a sidebar item or button).
export function usePermission() {
  const ctx = React.useContext(PermissionContext);
  if (!ctx) {
    throw new Error("usePermission must be used within <PermissionProvider>");
  }
  return ctx;
}
