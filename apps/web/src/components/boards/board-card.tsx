"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Lock, Users, Share2, Upload, Globe } from "lucide-react";
import { toast } from "sonner";
import type { Board, BoardMiniWidget } from "@/types";
import { ShareModal } from "./share-modal";
import { ImportInventoryModal } from "./import-inventory-modal";

const widgetColor: Record<BoardMiniWidget["state"], { bg: string; border: string }> = {
  active: { bg: "rgba(13,148,136,0.15)", border: "var(--color-active)" },
  "soft-lock": { bg: "rgba(217,119,6,0.15)", border: "var(--color-soft-lock)" },
  committed: { bg: "rgba(5,150,105,0.15)", border: "var(--color-committed)" },
};

function CardActionButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-[4px] text-text-muted transition-all hover:bg-surface-hover hover:text-text [&_svg]:size-3.5"
    >
      {children}
    </button>
  );
}

export function BoardCard({ board }: { board: Board }) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <>
      <div
        onClick={() => router.push(`/dashboard/boards/${board.slug}`)}
        className="group cursor-pointer overflow-hidden rounded-md border border-border bg-surface transition-all hover:-translate-y-0.5 hover:border-active hover:shadow-[var(--shadow-md),var(--shadow-glow-teal)]"
      >
        {/* Canvas preview */}
        <div className="relative h-[140px] overflow-hidden bg-bg-deep">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          {board.preview.map((w, i) => {
            const c = widgetColor[w.state];
            return (
              <div
                key={i}
                className="absolute z-[1] rounded-[4px] border"
                style={{
                  width: w.width,
                  height: w.height,
                  top: w.top,
                  left: w.left,
                  background: c.bg,
                  borderColor: c.border,
                }}
              />
            );
          })}
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-center gap-2 text-[0.95rem] font-semibold text-text">
            {board.name}
            {board.live && (
              <span className="size-2 animate-pulse-dot rounded-full bg-committed shadow-[0_0_6px_var(--color-committed)]" />
            )}
          </div>
          <div className="mt-0.5 text-[0.78rem] text-text-muted">{board.subtitle}</div>
          <div className="mt-2 flex gap-3.5 text-[0.78rem] text-text-muted">
            <span className="flex items-center gap-1.5">
              <Box className="size-[13px]" /> {board.widgetCount} widgets
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="size-[13px]" /> {board.lockCount} locks
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-[13px]" /> {board.onlineCount} online
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <div className="flex items-center">
            {board.users.map((u, i) => (
              <div
                key={i}
                className="grid size-6 place-items-center rounded-full border-2 border-surface text-[0.6rem] font-semibold text-white first:ml-0 [&:not(:first-child)]:-ml-1.5"
                style={{ background: u.gradient }}
              >
                {u.initials}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <CardActionButton title="Share" onClick={stop(() => setShareOpen(true))}>
              <Share2 />
            </CardActionButton>
            <CardActionButton title="Import Inventory" onClick={stop(() => setImportOpen(true))}>
              <Upload />
            </CardActionButton>
            <CardActionButton
              title="Publish"
              onClick={stop(() => toast.success(`${board.name} is now published`))}
            >
              <Globe />
            </CardActionButton>
          </div>
        </div>
      </div>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        boardName={board.name}
        boardSlug={board.slug}
      />
      <ImportInventoryModal open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
