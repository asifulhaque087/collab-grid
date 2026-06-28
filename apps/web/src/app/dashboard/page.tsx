import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAbilityFor, Action, Subjects } from "@/lib/ability";

// /dashboard → the user's home page. Tenants/sub-users land on Boards (the main
// dashboard page); the super-admin can't see Boards (a tenant-business menu) so
// they land on Users, the first menu they manage.
export default async function DashboardIndex() {
  const user = await getCurrentUser();
  const ability = createAbilityFor(user);
  if (ability.can(Action.Manage, Subjects.All)) {
    redirect("/dashboard/users");
  }
  redirect("/dashboard/boards");
}
