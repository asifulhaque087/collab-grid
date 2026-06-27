"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Crosshair,
  Minus,
  Plus,
  Maximize,
  Share,
  MousePointer2,
  Hand,
  Lock,
  Upload,
  Clock,
  X,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import type { BoardCanvas, CanvasWidget, InventoryThumb, Peer } from "@/types/canvas";
import type { Viewport } from "@/types/realtime";
import { CHECKOUT_CART_KEY, type CheckoutCart } from "@/types/realtime";
import { Button } from "@/components/ui/button";
import { ShareModal } from "@/components/boards/share-modal";
import { ImportInventoryModal } from "@/components/boards/import-inventory-modal";
import { AddInventoryModal } from "@/components/inventory/add-inventory-modal";
import { toInventoryThumb, serverWidgetToCanvas } from "@/lib/canvas-mappers";
import { useCanvasSocket } from "@/hooks/use-canvas-socket";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

function formatLock(seconds: number) {
  if (seconds <= 0) return "Expired";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function priceToNumber(price: string) {
  return parseInt(price.replace(/[^0-9]/g, ""), 10) || 0;
}

export function CanvasEditor({
  board,
  endUser = false,
}: {
  board: BoardCanvas;
  /** Anonymous shopper view: hide tenant tools and disable widget moving. */
  endUser?: boolean;
}) {
  const router = useRouter();
  const viewportRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [widgets, setWidgets] = useState<CanvasWidget[]>(board.widgets);
  const [inventory, setInventory] = useState<InventoryThumb[]>(board.inventory);
  const [peers, setPeers] = useState<Peer[]>(board.peers);
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [invQuery, setInvQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ghost, setGhost] = useState({ visible: false, x: 0, y: 0, img: "", name: "" });
  const [shareOpen, setShareOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addInventoryOpen, setAddInventoryOpen] = useState(false);

  // Refs mirror state so window/native listeners read fresh values.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const widgetsRef = useRef(widgets);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  // ── Realtime socket ───────────────────────────────────
  // Wired only when the board exists in the API (real board). The mock/demo
  // fallback keeps its local-only interactions.
  const realtimeEnabled = !!board.boardId;

  // World-space rectangle currently visible in the viewport div, derived from
  // pan/zoom. Sent on join and on every pan/zoom so the backend can subscribe
  // this socket to the overlapping zones.
  const computeViewport = useCallback((): Viewport => {
    const vp = viewportRef.current;
    const s = zoomRef.current / 100;
    const p = panRef.current;
    const w = vp?.clientWidth ?? 1280;
    const h = vp?.clientHeight ?? 720;
    return {
      minX: Math.round(-p.x / s),
      minY: Math.round(-p.y / s),
      maxX: Math.round((w - p.x) / s),
      maxY: Math.round((h - p.y) / s),
    };
  }, []);

  const { connected, me, sendCursor, updateViewport, softLock, releaseSoftLock, hardLock, moveWidget, moveWidgetEnd, placeWidget } = useCanvasSocket({
    slug: board.slug,
    enabled: realtimeEnabled,
    initialViewport: computeViewport,
    onJoined: (result) => {
      // myLocks recovers the user's own active locks after a refresh — force
      // those to "mine" regardless of identity timing.
      const myTtls = new Map(result.myLocks.map((l) => [l.widgetId, l.ttl]));
      setWidgets(
        result.widgets.map((w) => {
          const cw = serverWidgetToCanvas(w, me?.userId ?? null);
          const myTtl = myTtls.get(w.id);
          return myTtl !== undefined
            ? { ...cw, state: "mine" as const, locker: undefined, lockTime: Math.ceil(myTtl / 1000) }
            : cw;
        }),
      );
      setPeers([]);
      if (result.myLocks.length) setSidebarOpen(true);
    },
    onCursor: (peer) => {
      setPeers((prev) => {
        const rest = prev.filter((p) => p.id !== peer.userId);
        return [...rest, { id: peer.userId, name: peer.name, color: peer.color, x: peer.x, y: peer.y }];
      });
    },
    onPeerLeft: (userId) => setPeers((prev) => prev.filter((p) => p.id !== userId)),
    onLockFixed: ({ widgetId, userId, name, ttl }) => {
      const mine = userId === me?.userId;
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === widgetId
            ? { ...w, state: mine ? "mine" : "peer", locker: mine ? undefined : name, lockTime: Math.ceil(ttl / 1000) }
            : w,
        ),
      );
      if (mine) setSidebarOpen(true);
    },
    onLockReleased: ({ widgetId }) => {
      setWidgets((prev) =>
        prev.map((w) => (w.id === widgetId ? { ...w, state: "active", lockTime: undefined, locker: undefined } : w)),
      );
    },
    onLockDenied: ({ reason }) => toast.error(reason),
    // A peer (tenant) repositioned a widget — reflect the new coordinates.
    // The CSS transition on .c-widget animates the move smoothly.
    onWidgetMoved: ({ widgetId, x, y }) =>
      setWidgets((prev) => prev.map((w) => (w.id === widgetId ? { ...w, x, y } : w))),
    onWidgetAnchored: ({ widgetId, x, y }) =>
      setWidgets((prev) => prev.map((w) => (w.id === widgetId ? { ...w, x, y } : w))),
    // A peer (tenant) dropped a sidebar item onto the canvas — add the widget so
    // it appears here too, and drop it from our inventory sidebar.
    onWidgetPlaced: (w) => {
      setWidgets((prev) =>
        prev.some((x) => x.id === w.id)
          ? prev
          : [...prev, serverWidgetToCanvas(w, me?.userId ?? null)],
      );
      setInventory((prev) =>
        prev.map((i) => (i.id === w.id ? { ...i, placed: true } : i)),
      );
    },
    // Checkout started — these widgets go red (hard lock) for everyone, 5 min.
    onHardFixed: ({ widgetIds, ttl }) => {
      const ids = new Set(widgetIds);
      setWidgets((prev) =>
        prev.map((w) => (ids.has(w.id) ? { ...w, hard: true, lockTime: Math.ceil(ttl / 1000) } : w)),
      );
    },
    // Hard lock expired unpaid — back to default.
    onHardReleased: ({ widgetId }) =>
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === widgetId ? { ...w, hard: false, state: "active", lockTime: undefined, locker: undefined } : w,
        ),
      ),
    // Paid — the item is sold and leaves the canvas for everyone.
    onPurchased: ({ widgetId }) =>
      setWidgets((prev) => prev.filter((w) => w.id !== widgetId)),
  });

  // Push viewport changes to the backend (debounced inside the hook) so zone
  // subscriptions follow the user as they pan/zoom.
  useEffect(() => {
    if (realtimeEnabled) updateViewport(computeViewport());
  }, [pan, zoom, realtimeEnabled, updateViewport, computeViewport]);

  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const widgetDrag = useRef<{
    id: string;
    startX: number;
    startY: number;
    offX: number;
    offY: number;
    scale: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const invDrag = useRef<{
    id: string;
    name: string;
    price: string;
    img: string;
    qty: number;
  } | null>(null);

  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`;

  // ── Zoom ──────────────────────────────────────────────
  const changeZoom = useCallback((delta: number, cx?: number, cy?: number) => {
    const oldZoom = zoomRef.current;
    const next = clampZoom(oldZoom + delta);
    if (next === oldZoom) return;
    if (cx !== undefined && cy !== undefined) {
      const oldScale = oldZoom / 100;
      const newScale = next / 100;
      const p = panRef.current;
      const wx = (cx - p.x) / oldScale;
      const wy = (cy - p.y) / oldScale;
      setPan({ x: cx - wx * newScale, y: cy - wy * newScale });
    }
    setZoom(next);
  }, []);

  const zoomFromButtons = (delta: number) => {
    const vp = viewportRef.current;
    if (!vp) return changeZoom(delta);
    const rect = vp.getBoundingClientRect();
    changeZoom(delta, rect.width / 2, rect.height / 2);
  };

  const resetZoom = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  };

  // Native wheel listener so we can preventDefault (passive: false).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".canvas-inv-panel") || target.closest(".widget-detail-panel")) return;
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      changeZoom(e.deltaY > 0 ? -5 : 5, e.clientX - rect.left, e.clientY - rect.top);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [changeZoom]);

  // ── Lock / click on a widget ──────────────────────────
  const lockWidget = useCallback((id: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, state: "mine", lockTime: 60 } : w))
    );
    setSidebarOpen(true);
    const name = widgetsRef.current.find((w) => w.id === id)?.name ?? "widget";
    toast.success(`Locked "${name}" for 60 seconds`);
  }, []);

  const handleWidgetClick = useCallback(
    (id: string) => {
      const w = widgetsRef.current.find((x) => x.id === id);
      if (!w) return;
      if (w.state === "active") {
        // When connected, the server owns the lock (atomic acquire + broadcast).
        // The amber state arrives via the widget:lock:soft:fixed event.
        if (connected) softLock(id);
        else lockWidget(id);
      } else if (w.state === "peer") toast.info("This item is locked by another user");
      else if (w.state === "mine") toast.info("Already in your locked items");
    },
    [lockWidget, connected, softLock]
  );

  const releaseLock = (id: string) => {
    // Drop the lock in Redis too (when connected) so it doesn't survive a
    // refresh; the broadcast clears it for every viewer. Update locally either
    // way so the sidebar responds instantly.
    if (connected) releaseSoftLock(id);
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, state: "active", lockTime: undefined } : w))
    );
    toast.info("Item released");
  };

  const checkout = () => {
    const mine = widgetsRef.current.filter((w) => w.state === "mine");
    if (mine.length === 0) return;

    if (connected) {
      // Promote to hard locks (red, 5 min), hand the cart to the checkout page,
      // and navigate there to collect shipping + payment.
      hardLock();
      const cart: CheckoutCart = {
        boardId: board.boardId!,
        slug: board.slug,
        buyerUserId: me?.userId ?? "",
        endUser,
        // Hard lock lasts 5 minutes from now — the checkout page counts down to it.
        expiresAt: Date.now() + 5 * 60 * 1000,
        items: mine.map((w) => ({
          id: w.id,
          name: w.name,
          price: priceToNumber(w.price),
          img: w.img,
        })),
      };
      sessionStorage.setItem(CHECKOUT_CART_KEY, JSON.stringify(cart));
      router.push("/checkout");
      return;
    }

    // Mock/demo fallback: simulate the purchase locally.
    setWidgets((prev) => prev.map((w) => (w.state === "mine" ? { ...w, state: "sold" } : w)));
    setTimeout(() => {
      setWidgets((prev) => prev.filter((w) => w.state !== "sold"));
    }, 400);
    toast.success(
      `Checkout complete — ${mine.length} item${mine.length > 1 ? "s" : ""} purchased and removed from board`
    );
  };

  // ── Pan + widget drag (window listeners) ──────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const vp = viewportRef.current;
      if (vp) {
        const rect = vp.getBoundingClientRect();
        const s = zoomRef.current / 100;
        const wx = Math.round((e.clientX - rect.left - panRef.current.x) / s);
        const wy = Math.round((e.clientY - rect.top - panRef.current.y) / s);
        setCoords({ x: wx, y: wy });
        if (realtimeEnabled) sendCursor(wx, wy);
      }

      const wd = widgetDrag.current;
      if (wd) {
        const dx = e.clientX - wd.startX;
        const dy = e.clientY - wd.startY;
        if (!wd.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        wd.moved = true;
        // End users can't reposition widgets — a drag is a no-op (they may still
        // click to lock). Tenants/sub-users fall through to move + persist.
        if (endUser) return;
        const nx = Math.max(0, Math.round((e.clientX - wd.offX - wd.panX) / wd.scale));
        const ny = Math.max(0, Math.round((e.clientY - wd.offY - wd.panY) / wd.scale));
        setWidgets((prev) => prev.map((w) => (w.id === wd.id ? { ...w, x: nx, y: ny } : w)));
        if (realtimeEnabled) {
          const dragged = widgetsRef.current.find((w) => w.id === wd.id);
          moveWidget(wd.id, nx, ny, dragged?.width ?? 190, dragged?.height ?? 190);
        }
        return;
      }

      if (panning.current) {
        setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      }
    };

    const onUp = () => {
      const wd = widgetDrag.current;
      if (wd) {
        if (wd.moved) {
          const w = widgetsRef.current.find((x) => x.id === wd.id);
          if (w) {
            toast.info(`Moved "${w.name}" to (${w.x}, ${w.y})`);
            if (realtimeEnabled) moveWidgetEnd(w.id, w.x, w.y, w.width, w.height ?? 190);
          }
        } else {
          handleWidgetClick(wd.id);
        }
        widgetDrag.current = null;
      }
      panning.current = false;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [handleWidgetClick, realtimeEnabled, sendCursor, moveWidget, moveWidgetEnd, endUser]);

  const onViewportPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target === viewportRef.current || target.classList.contains("canvas-world")) {
      panning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const onWidgetPointerDown = (e: React.PointerEvent, w: CanvasWidget) => {
    if (w.state === "sold") return;
    e.stopPropagation();
    const scale = zoom / 100;
    widgetDrag.current = {
      id: w.id,
      startX: e.clientX,
      startY: e.clientY,
      offX: e.clientX - w.x * scale - pan.x,
      offY: e.clientY - w.y * scale - pan.y,
      scale,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
  };

  // ── Countdown timers ──────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setWidgets((prev) => {
        const expired: string[] = [];
        const next = prev.map((w) => {
          if ((w.state === "mine" || w.state === "peer") && (w.lockTime ?? 0) > 0) {
            const lt = (w.lockTime ?? 0) - 1;
            // Hard-locked items stay put until the server resolves them
            // (purchased or released); only soft "mine" locks auto-expire here.
            if (w.state === "mine" && lt <= 0 && !w.hard) {
              expired.push(w.name);
              return { ...w, state: "active" as const, lockTime: undefined };
            }
            return { ...w, lockTime: lt };
          }
          return w;
        });
        if (expired.length) {
          queueMicrotask(() =>
            expired.forEach((name) =>
              toast.info(`Lock expired — "${name}" returned to canvas`)
            )
          );
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Peer cursor jitter (mock/demo only) ───────────────
  // Real boards render live peer cursors from the socket; skip the mock jitter.
  useEffect(() => {
    if (realtimeEnabled) return;
    const iv = setInterval(() => {
      setPeers((prev) =>
        prev.map((p) => ({
          ...p,
          x: p.x + (Math.random() - 0.5) * 3,
          y: p.y + (Math.random() - 0.5) * 3,
        }))
      );
    }, 200);
    return () => clearInterval(iv);
  }, [realtimeEnabled]);

  // ── Inventory drag & drop ─────────────────────────────
  const onInvDragStart = (e: React.DragEvent, item: InventoryThumb) => {
    invDrag.current = {
      id: item.id,
      name: item.name,
      price: item.price,
      img: item.img,
      qty: item.qty,
    };
    const empty = document.createElement("canvas");
    empty.width = 1;
    empty.height = 1;
    e.dataTransfer.setDragImage(empty, 0, 0);
    e.dataTransfer.effectAllowed = "copy";
    setGhost({ visible: true, x: 0, y: 0, img: item.img, name: item.name });
  };

  const onInvDrag = (e: React.DragEvent) => {
    if (e.clientX > 0 && e.clientY > 0) {
      setGhost((g) => ({ ...g, x: e.clientX + 12, y: e.clientY + 12 }));
    }
  };

  const onInvDragEnd = () => {
    invDrag.current = null;
    setGhost((g) => ({ ...g, visible: false }));
  };

  const onViewportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = invDrag.current;
    const vp = viewportRef.current;
    if (!data || !vp) return;
    const rect = vp.getBoundingClientRect();
    const s = zoom / 100;
    const wx = Math.max(0, Math.round((e.clientX - rect.left - pan.x - 220) / s));
    const wy = Math.max(0, Math.round((e.clientY - rect.top - pan.y) / s));
    const bigImg = data.img.replace("200", "400").replace("200", "300");

    setGhost((g) => ({ ...g, visible: false }));
    invDrag.current = null;

    // Real board: persist the placement + broadcast it so every viewer sees the
    // widget appear. Keep its real inventory id so locks/moves/checkout resolve.
    if (realtimeEnabled && connected) {
      placeWidget(data.id, wx, wy);
      setWidgets((prev) =>
        prev.some((w) => w.id === data.id)
          ? prev
          : [
              ...prev,
              {
                id: data.id,
                name: data.name,
                price: data.price,
                qty: data.qty,
                img: bigImg,
                state: "active",
                x: wx,
                y: wy,
                width: 190,
                height: 190,
              },
            ],
      );
      // Drop it from the sidebar — it now lives on the canvas.
      setInventory((prev) =>
        prev.map((i) => (i.id === data.id ? { ...i, placed: true } : i)),
      );
      toast.success(`Placed "${data.name}" at (${wx}, ${wy})`);
      return;
    }

    // Mock/demo fallback: local-only placement with a synthetic id.
    setWidgets((prev) => [
      ...prev,
      {
        id: `wd${Date.now()}`,
        name: data.name,
        price: data.price,
        qty: data.qty,
        img: bigImg,
        state: "active",
        x: wx,
        y: wy,
        width: 190,
      },
    ]);
    toast.success(`Placed "${data.name}" at (${wx}, ${wy})`);
  };

  const lockedItems = widgets.filter((w) => w.state === "mine");
  const lockedTotal = lockedItems.reduce((sum, w) => sum + priceToNumber(w.price), 0);
  // Only unplaced items belong in the sidebar — placed ones live on the canvas.
  const filteredInventory = inventory.filter(
    (i) => !i.placed && i.name.toLowerCase().includes(invQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col">
      {/* Topbar */}
      <div className="canvas-topbar">
        <div className="canvas-topbar-left">
          {!endUser && (
            <button className="canvas-back-btn" title="Back to boards" onClick={() => router.push("/dashboard/boards")}>
              <ChevronLeft />
            </button>
          )}
          <span className="canvas-board-title">{board.title}</span>
          <span className={cn("canvas-board-access", board.access)}>
            {board.access === "public" ? "Public" : "Restricted"}
          </span>
          <span className="topbar-sep" />
          <div className="canvas-coords">
            <Crosshair />
            <span>
              X: {coords.x}&nbsp;&nbsp;Y: {coords.y}
            </span>
          </div>
        </div>

        <div className="canvas-topbar-center">
          <div className="zoom-control">
            <button className="zoom-btn" title="Zoom out" onClick={() => zoomFromButtons(-10)}>
              <Minus />
            </button>
            <span className="zoom-level" title="Click to reset" onClick={resetZoom}>
              {zoom}%
            </span>
            <button className="zoom-btn" title="Zoom in" onClick={() => zoomFromButtons(10)}>
              <Plus />
            </button>
          </div>
          <button className="zoom-fit" title="Fit to screen" onClick={resetZoom}>
            <Maximize />
          </button>
        </div>

        <div className="canvas-topbar-right">
          <div className="presence-strip">
            {board.presence.map((p) => (
              <div key={p.id} className="presence-avatar" style={{ background: p.gradient }} title={p.title}>
                {p.online && <span className="online-ring" />}
                {p.initials}
              </div>
            ))}
          </div>
          <span className="presence-count">{board.presenceCount} online</span>
          {!endUser && (
            <>
              <span className="topbar-sep" />
              <Button size="sm" onClick={() => setShareOpen(true)}>
                <Share />
                Share
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Viewport */}
      <div
        ref={viewportRef}
        className="canvas-viewport"
        onPointerDown={onViewportPointerDown}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={onViewportDrop}
      >
        <div className="canvas-world" style={{ transform }}>
          {widgets.map((w) => {
            const stateClass =
              w.state === "sold"
                ? "state-sold"
                : w.hard
                  ? "state-hard"
                  : w.state === "active"
                    ? "state-active"
                    : "state-locked";
            return (
              <div
                key={w.id}
                className={cn("c-widget", stateClass)}
                style={{ left: w.x, top: w.y, width: w.width }}
                onPointerDown={(e) => onWidgetPointerDown(e, w)}
              >
                {w.state === "peer" && (
                  <div className="c-widget-lock-overlay">
                    <div
                      className="lock-timer"
                      style={(w.lockTime ?? 0) <= 10 ? { color: "var(--color-danger)" } : undefined}
                    >
                      <Lock />
                      <span>{formatLock(w.lockTime ?? 0)}</span>
                    </div>
                    <div className="lock-user-badge">
                      <span className="lock-user-dot" /> {w.locker}
                    </div>
                  </div>
                )}
                {w.state === "sold" && (
                  <div className="c-widget-sold-overlay">
                    <div className="sold-badge">
                      <ShoppingBag /> Sold
                    </div>
                  </div>
                )}
                <div className="c-widget-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.img} alt={w.name} draggable={false} />
                </div>
                <div className="c-widget-body">
                  <div className="c-widget-name">{w.name}</div>
                  <div className="c-widget-meta">
                    <span className="c-widget-qty">Qty: {w.qty}</span>
                    <span className="c-widget-price">{w.price}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {peers.map((p) => (
            <div key={p.id} className="peer-cursor" style={{ left: p.x, top: p.y }}>
              <svg className="peer-cursor-arrow" viewBox="0 0 12 18" fill={p.color} stroke="#fff" strokeWidth="1">
                <path d="M1 1 L1 14 L4 11 L7 17 L9 16 L6 10 L11 10 Z" />
              </svg>
              <span className="peer-cursor-label" style={{ background: p.color }}>
                {p.name}
              </span>
            </div>
          ))}
        </div>

        {/* Inventory panel (tenant only — end users don't place inventory) */}
        {!endUser && (
        <div className="canvas-inv-panel">
          <div className="inv-panel-header">
            <span className="inv-panel-title">Inventory</span>
            <span className="inv-panel-count">{inventory.length} items</span>
          </div>
          <div className="inv-panel-search">
            <input
              type="text"
              placeholder="Search items…"
              value={invQuery}
              onChange={(e) => setInvQuery(e.target.value)}
            />
          </div>
          <div className="inv-panel-list">
            {filteredInventory.map((item) => (
              <div
                key={item.id}
                className="inv-thumb"
                draggable
                onDragStart={(e) => onInvDragStart(e, item)}
                onDrag={onInvDrag}
                onDragEnd={onInvDragEnd}
              >
                <div className="inv-thumb-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.img} alt={item.name} draggable={false} />
                </div>
                <div className="inv-thumb-info">
                  <div className="inv-thumb-name">{item.name}</div>
                  <div className="inv-thumb-meta">
                    <span>Qty: {item.qty}</span>
                    <span className="inv-thumb-price">{item.price}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="inv-panel-footer">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center"
              onClick={() => setImportOpen(true)}
            >
              <Upload />
              Import CSV
            </Button>
          </div>
        </div>
        )}

        {/* Drag ghost */}
        <div
          className="drag-ghost"
          style={{
            display: ghost.visible ? "flex" : "none",
            left: ghost.x,
            top: ghost.y,
          }}
        >
          {ghost.img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ghost.img} alt="" />
          )}
          <span>{ghost.name}</span>
        </div>

        {/* Floating toolbar */}
        <div className="canvas-float-toolbar">
          <button
            className={cn("float-tool-btn", tool === "select" && "active")}
            title="Select"
            onClick={() => setTool("select")}
          >
            <MousePointer2 />
          </button>
          <button
            className={cn("float-tool-btn", tool === "pan" && "active")}
            title="Pan"
            onClick={() => setTool("pan")}
          >
            <Hand />
          </button>
          {!endUser && (
            <>
              <div className="float-tool-sep" />
              <button className="float-tool-btn" title="Add Inventory" onClick={() => setAddInventoryOpen(true)}>
                <Plus />
              </button>
            </>
          )}
          <button
            className={cn("float-tool-btn", sidebarOpen && "active")}
            title={sidebarOpen ? "Hide locked items" : "Show locked items"}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <Lock />
            {lockedItems.length > 0 && (
              <span className="float-tool-badge">{lockedItems.length}</span>
            )}
          </button>
        </div>

        {/* Minimap */}
        <div className="canvas-minimap">
          <div className="minimap-inner">
            <div className="minimap-dot" style={{ left: "8%", top: "10%", width: 10, height: 12, background: "var(--color-active)" }} />
            <div className="minimap-dot" style={{ left: "22%", top: "8%", width: 10, height: 12, background: "var(--color-active)" }} />
            <div className="minimap-dot" style={{ left: "38%", top: "12%", width: 10, height: 12, background: "var(--color-soft-lock)" }} />
            <div className="minimap-dot" style={{ left: "10%", top: "42%", width: 10, height: 12, background: "var(--color-committed)" }} />
            <div className="minimap-dot" style={{ left: "28%", top: "40%", width: 10, height: 12, background: "var(--color-active)" }} />
            <div className="minimap-dot" style={{ left: "44%", top: "46%", width: 10, height: 12, background: "var(--color-soft-lock)" }} />
            <div className="minimap-dot" style={{ left: "54%", top: "10%", width: 12, height: 8, background: "var(--color-active)" }} />
            <div className="minimap-dot" style={{ left: "54%", top: "38%", width: 14, height: 10, background: "var(--color-active)" }} />
            <div className="minimap-viewport" style={{ left: "2%", top: "4%", width: "42%", height: "50%" }} />
          </div>
        </div>

        {/* Locked items sidebar */}
        <div className={cn("widget-detail-panel", sidebarOpen && "open")}>
          <div className="detail-header">
            <span className="detail-title">My Locked Items</span>
            <button
              className="grid size-8 place-items-center rounded-sm text-text-muted transition-all hover:bg-surface-hover hover:text-text"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="size-[18px]" />
            </button>
          </div>
          <div className="detail-body">
            {lockedItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--color-text-muted)" }}>
                <Lock style={{ width: 36, height: 36, margin: "0 auto 12px", display: "block", color: "var(--color-border)" }} />
                <div style={{ fontSize: "0.85rem" }}>No locked items</div>
                <div style={{ fontSize: "0.78rem", marginTop: 4 }}>
                  Click a widget on the canvas to lock it for 60 seconds
                </div>
              </div>
            ) : (
              lockedItems.map((w) => {
                const urgent = (w.lockTime ?? 0) <= 10;
                return (
                  <div key={w.id} className="locked-item">
                    <div className="locked-item-img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={w.img}
                        alt={w.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--radius-sm)" }}
                      />
                    </div>
                    <div className="locked-item-info">
                      <div className="locked-item-name">{w.name}</div>
                      <div className="locked-item-price">{w.price}</div>
                      <div className={cn("locked-item-timer", urgent && "urgent")}>
                        <Clock />
                        {formatLock(w.lockTime ?? 0)}
                      </div>
                    </div>
                    <button className="locked-item-remove" title="Release lock" onClick={() => releaseLock(w.id)}>
                      <X />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          {lockedItems.length > 0 && (
            <div className="detail-footer">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginBottom: 2 }}>Total</div>
                <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.1rem" }}>
                  ৳{lockedTotal.toLocaleString()}
                </div>
              </div>
              <Button className="flex-1 justify-center" onClick={checkout}>
                <ShoppingBag />
                Checkout
              </Button>
            </div>
          )}
        </div>
      </div>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        boardName={board.title}
        boardSlug={board.slug}
      />
      <ImportInventoryModal
        open={importOpen}
        onOpenChange={setImportOpen}
        boardId={board.boardId ?? undefined}
      />
      <AddInventoryModal
        open={addInventoryOpen}
        onOpenChange={setAddInventoryOpen}
        boardId={board.boardId}
        onSuccess={(item) => setInventory((prev) => [toInventoryThumb(item), ...prev])}
      />
    </div>
  );
}
