import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { getPublicBoard } from "@/actions/boards";
import { CanvasEditor } from "@/components/canvas/canvas-editor";
import type { BoardCanvas } from "@/types/canvas";

// Public, unauthenticated end-user board. Renders the realtime canvas in
// shopper mode (no tenant tools). Widgets/peers/locks arrive over the socket on
// join; only published (access: 'public') boards resolve here.
export default async function PublicBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const board = await getPublicBoard(slug);

  if (!board) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="grid size-14 place-items-center rounded-md bg-surface text-text-muted">
          <LayoutGrid className="size-7" />
        </div>
        <h1 className="text-xl font-semibold">This board isn’t available</h1>
        <p className="max-w-sm text-sm text-text-muted">
          The board may be unpublished or the link is incorrect. Ask the owner to
          publish it and share the link again.
        </p>
        <Link href="/" className="text-sm text-active underline">
          Go to CollabGrid
        </Link>
      </div>
    );
  }

  const canvas: BoardCanvas = {
    boardId: board.id,
    slug: board.slug,
    title: board.name,
    access: board.access,
    maxWidth: board.maxWidth ?? 10000,
    maxHeight: board.maxHeight ?? 10000,
    widgets: [],
    inventory: [],
    peers: [],
    presence: [],
    presenceCount: 0,
  };

  return (
    <div className="h-screen">
      <CanvasEditor board={canvas} endUser />
    </div>
  );
}
