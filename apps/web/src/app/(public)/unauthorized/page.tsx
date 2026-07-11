import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <main className="dot-grid-bg flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
      <div className="relative z-[1] flex flex-col items-center">
        <div className="mb-5 flex size-14 items-center justify-center rounded-full border border-border bg-surface text-soft-lock">
          <ShieldX className="size-7" />
        </div>
        <h1 className="text-2xl font-semibold text-text">Access denied</h1>
        <p className="mt-2 max-w-md text-sm text-text-dim">
          You don&apos;t have permission to view this page. If you think this is a
          mistake, contact your workspace administrator.
        </p>
        <Link
          href="/dashboard/boards"
          className="mt-6 rounded-sm bg-active px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-active/90"
        >
          Back to Boards
        </Link>
      </div>
    </main>
  );
}
