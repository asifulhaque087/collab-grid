import { getBoardCanvas } from "@/lib/mock/canvas";
import { Header } from "@/components/layout/header";
import { CanvasEditor } from "@/components/canvas/canvas-editor";

// The live canvas board editor renders full-width under the global header
// (no nav sidebar), matching the prototype's canvas mode.
export default async function CanvasBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const board = await getBoardCanvas(slug);

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="min-h-0 flex-1 overflow-hidden">
        <CanvasEditor board={board} />
      </div>
    </div>
  );
}
