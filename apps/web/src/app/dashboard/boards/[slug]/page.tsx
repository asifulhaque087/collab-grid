import { getBoardCanvas } from "@/lib/mock/canvas";
import { getBoardBySlug } from "@/actions/boards";
import { getInventoryItems } from "@/actions/inventory";
import { Header } from "@/components/layout/header";
import { CanvasEditor } from "@/components/canvas/canvas-editor";
import { toInventoryThumb } from "@/lib/canvas-mappers";
import type { BoardCanvas } from "@/types/canvas";

// The live canvas board editor renders full-width under the global header
// (no nav sidebar), matching the prototype's canvas mode.
export default async function CanvasBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Resolve the real board so the editor knows its id (for new widgets) and can
  // show the board's actual inventory in the sidebar. Mock widgets/peers/presence
  // still back the demo interactions until the realtime canvas lands.
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
      inventory: items.map(toInventoryThumb),
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
