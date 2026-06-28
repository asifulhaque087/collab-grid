import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PermissionProvider } from "@/components/providers/permission-provider";
import { requireAuth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <PermissionProvider
      permissions={user.permissions}
      quotas={user.quotas}
      plan={user.plan}
    >
      <SidebarProvider>
        <div className="flex h-screen flex-col">
          <Header user={user} />
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main className="dot-grid-bg flex-1 overflow-y-auto bg-bg px-4 py-5 sm:px-6 md:px-8 md:py-7">
              <div className="relative z-[1]">
                <PermissionGuard>{children}</PermissionGuard>
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </PermissionProvider>
  );
}
