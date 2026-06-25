# Goal

We will implement RBAC system in frontend using casl library.


# Steps

- Create ability.ts
- update proxy.ts
- add PermissionGuard (server route handler)
- Wrap the app with Permission Guard
- Dashboard provider (client permissions provider)



## Create ability.ts

Casl implement korar jonno ata e holo main file. Akhane define kora createAbilityFor method er maddome amra casl ke bole dibo akjon user er ki ki permission ase after login or page refresh.

Tarpore ai file theke return kora build function er maddome check kora jabe kno user kno task korar jonno permission ase kina. Tbe akhane permissions gula hard code kora thakle amader get korte hobe auth/me or after login



```ts
import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from "@casl/ability";

// CASL action/subject model — mirrors apps/api/src/auth/permissions.ts so the
// web's route/menu gating evaluates exactly like the server's PermissionsGuard.
export enum Action {
  Manage = "manage",
  Create = "create",
  Read = "read",
  Update = "update",
  Delete = "delete",
}

export enum Subjects {
  All = "all",
  Prescription = "Prescription",
  Patient = "Patient",
  Ai = "Ai",
  Report = "Report",
  Plan = "Plan",
  Subscription = "Subscription",
  Payment = "Payment",
  User = "User",
  Role = "Role",
}

// A single permission a user effectively holds, as returned by GET /auth/me.
export interface PermissionTuple {
  action: string;
  subject: string;
}

export type AppAbility = MongoAbility<[Action, Subjects]>;

// Build a CASL ability from the user's effective permission tuples.
export function createAbilityFor(
  user: { permissions?: PermissionTuple[] } | null,
): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  for (const p of user?.permissions ?? []) {
    can(p.action as Action, p.subject as Subjects);
  }
  return build();
}
```



## Update proxy.ts

Amra jani proxy.ts kno page a switch houar age run hoi. Ai ketre amra request header switch houa page er url set kortesi. Atake samne permission guard a get kore check korbo current page a switch korar jonno jei jei permissions required aigula user er ase kina.


```ts
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-path", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Only run on dashboard routes (where the permission guard lives); skip static
// assets and Next internals.
export const config = {
  matcher: ["/dashboard/:path*"],
};
```



## Permission Guard


Ata akta server side component. Ati check korbe kno page access korar jonno user er enough permission ase kina. Ata age request header theke current page er path ber korbe.

Tarpore oi path access korar jonno amra agei akta file a likhe rakhi ki ki permission required. Ai permission gulake get korbe using getRequiredPermissionForPath function.

Tarpore createAbiltyFor function er maddome age permissions set korbe abong ability.can er maddome check korbe. build function ability instance return kore jar maddome amra ability.can use kore permission check kori.


Currently akhane for every page switch get current user api call kora hocce. Kintu amra chaile server er secret use kore direct jwt token theke permission get korte pari.


```tsx
export async function PermissionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const pathname = headerList.get("x-current-path") ?? "";

  const requirement = getRequiredPermissionForPath(pathname);
  if (!requirement) return <>{children}</>;

  const user = await getCurrentUser();
  const ability = createAbilityFor(user);

  if (!ability.can(requirement.action, requirement.subject)) {
    redirect("/unauthorized");
  }

  return <>{children}</>;
}
```


## Wrap permission guard


Atao jehetu server component permission guard moto tai akhan thekeo as props amra permission guard a user er permission provide korte pari. Kintu I think akhane call korar pore permission guard same api call korle cache result e return hoi so no problem.

```tsx
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
		<div className="relative min-h-screen bg-slate-100">
			<Sidebar />
			<div className="flex min-h-screen flex-col lg:ml-60">
				<TopBar today={today} />
				<main className="flex-1 p-4 md:p-6">
					<PermissionGuard>{children}</PermissionGuard>
				</main>
			</div>
		</div>
  );
}
```



## Permission Provider

Akhane atar nam DashboardProvider ase. Kintu amra use korar somoi PermissionProvider use korbo. Atake layout.tsx server component a wrap korbo Next step a. Ati use hoi client component permissions gulake provide korar jonno.




```ts

"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_PROFILE, type DoctorProfile } from "./data";
import type { BuilderValues } from "./builder/schema";
import type { PermissionTuple } from "@/lib/ability";


interface DashboardContextValue {
  permissions: PermissionTuple[];
}

const DashboardContext = React.createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = React.useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within <DashboardProvider>");
  return ctx;
}

export function DashboardProvider({
  children,
  doctorName,
  permissions = [],
}: {
  children: React.ReactNode;
  permissions?: PermissionTuple[];
}) {



  const value: DashboardContextValue = {
    permissions,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
```



## Wrap this in layout


Amra jani layout.tsx file a mainly currentUser ke fetch kora hoi. Current User er permissions gulake wrapper er value te set korbo. Tahole useDashboard or usePermission hook er maddome client component gula permissions ke get korte parbe.



```tsx
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <PermissionProvider  permissions={user.permissions ?? []}>
      <div className="relative min-h-screen bg-slate-100">
        <Sidebar />
        <div className="flex min-h-screen flex-col lg:ml-60">
          <TopBar today={today} />
          <main className="flex-1 p-4 md:p-6">
            <PermissionGuard>{children}</PermissionGuard>
          </main>
        </div>
      </div>
    </DashboardProvider>
  );
}
```



# Note

In the steps we did not add Can component. if think we should do that you can use can component also using casl react library
