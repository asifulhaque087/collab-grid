import { getUsers } from "@/lib/mock/people";
import { PageHeader } from "@/components/dashboard/page-header";
import { UsersActions } from "@/components/users/users-actions";
import { UsersTable } from "@/components/users/users-table";

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Manage tenant members and their role assignments"
        actions={<UsersActions />}
      />
      <UsersTable users={users} />
    </>
  );
}
