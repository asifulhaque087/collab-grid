import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Placeholder for the live canvas board editor. The full-screen canvas
// (viewport, widgets, peer cursors, locks, drag-drop) is a separate feature
// and intentionally lives outside the (dashboard) shell layout.
export default async function CanvasBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg-deep text-center">
      <div className="font-mono text-[0.78rem] text-text-muted">/boards/{slug}</div>
      <h1 className="text-[1.6rem] font-bold tracking-tight text-text">
        Canvas editor coming soon
      </h1>
      <p className="max-w-md text-[0.875rem] text-text-muted">
        The real-time collaborative canvas for this board is part of an upcoming feature.
      </p>
      <Link
        href="/boards"
        className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface px-4 py-2 text-[0.85rem] font-semibold text-text-dim transition-all hover:border-active hover:text-active"
      >
        <ArrowLeft className="size-4" />
        Back to Boards
      </Link>
    </div>
  );
}
