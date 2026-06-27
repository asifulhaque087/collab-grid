import { getBoardCanvas } from "@/lib/mock/canvas";
import { getBoardBySlug } from "@/actions/boards";
import { getInventoryItems } from "@/actions/inventory";
import { Header } from "@/components/layout/header";
import { CanvasEditor } from "@/components/canvas/canvas-editor";
import { toInventoryThumb } from "@/lib/canvas-mappers";
import { requireAuth } from "@/lib/auth";
import type { BoardCanvas } from "@/types/canvas";

// The live canvas board editor renders full-width under the global header
// (no nav sidebar), matching the prototype's canvas mode.
export default async function CanvasBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // This is the tenant-facing editor — anonymous end users belong on the public
  // /b/[slug] route, so gate it behind auth (redirects to /sign-in otherwise).
  await requireAuth();

  const { slug } = await params;

  // Resolve the real board so the editor knows its id (for new widgets) and can
  // show the board's actual inventory in the sidebar. Real widgets/peers arrive
  // over the socket on join, so seed them empty — no mock placeholders to flash.
  const apiBoard = await getBoardBySlug(slug);
  const mock = await getBoardCanvas(slug);

  let board: BoardCanvas = mock;
  if (apiBoard) {
    const items = await getInventoryItems(apiBoard.id);
    board = {
      ...mock,
      boardId: apiBoard.id,
      slug: apiBoard.slug,
      title: apiBoard.name,
      access: apiBoard.access,
      maxWidth: apiBoard.maxWidth ?? 10000,
      maxHeight: apiBoard.maxHeight ?? 10000,
      inventory: items.map(toInventoryThumb),
      widgets: [],
      peers: [],
    };
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="min-h-0 flex-1 overflow-hidden">
        <CanvasEditor board={board} />
      </div>
    </div>
  );
}
