"use client";

import * as React from "react";
import {
  createAbilityFor,
  type AppAbility,
  type PermissionTuple,
  type Quota,
} from "@/lib/ability";

interface PermissionContextValue {
  permissions: PermissionTuple[];
  ability: AppAbility;
  quotas: Quota[];
  plan: string;
}

const PermissionContext = React.createContext<PermissionContextValue | null>(null);

export function PermissionProvider({
  children,
  permissions = [],
  quotas = [],
  plan = "free",
}: {
  children: React.ReactNode;
  permissions?: PermissionTuple[];
  quotas?: Quota[];
  plan?: string;
}) {
  const ability = React.useMemo(
    () => createAbilityFor({ permissions }),
    [permissions]
  );

  const value = React.useMemo<PermissionContextValue>(
    () => ({ permissions, ability, quotas, plan }),
    [permissions, ability, quotas, plan]
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission() {
  const ctx = React.useContext(PermissionContext);
  if (!ctx) {
    throw new Error("usePermission must be used within <PermissionProvider>");
  }
  return ctx;
}
