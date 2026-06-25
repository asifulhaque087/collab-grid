import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAbilityFor } from "@/lib/ability";
import { getRequiredPermissionForPath } from "@/lib/route-permissions";

// Server-side route guard. Reads the current path (stamped by proxy.ts), looks
// up the permission that path requires, builds the user's CASL ability, and
// redirects to /unauthorized when the user can't satisfy it. Routes with no
// requirement render straight through.
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
