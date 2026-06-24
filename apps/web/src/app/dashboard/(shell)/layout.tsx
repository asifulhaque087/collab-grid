import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
        <div className="relative z-[1]">{children}</div>
      </main>
    </div>
  );
}
