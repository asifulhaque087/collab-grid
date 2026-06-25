import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
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
    <PermissionProvider permissions={user.permissions}>
      <div
        className="grid h-screen"
        style={{
          gridTemplateColumns: "var(--sidebar-w) 1fr",
          gridTemplateRows: "var(--header-h) 1fr",
        }}
      >
        <Header />
        <Sidebar />
        <main className="dot-grid-bg overflow-y-auto bg-bg px-8 py-7">
          <div className="relative z-[1]">
            <PermissionGuard>{children}</PermissionGuard>
          </div>
        </main>
      </div>
    </PermissionProvider>
  );
}
