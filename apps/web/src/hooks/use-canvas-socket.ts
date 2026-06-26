"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  BoardJoinResult,
  CanvasUser,
  CursorReceive,
  HardFixed,
  HardReleased,
  LockDenied,
  LockFixed,
  LockReleased,
  Purchased,
  ServerWidget,
  Viewport,
} from "@/types/realtime";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";
const USER_ID_KEY = "canvas:userId";
const USER_NAME_KEY = "canvas:userName";

// End users have no account. We mint a stable id once per browser session and
// keep it in sessionStorage so a refresh re-joins as the same user and recovers
// any locks held in Redis.
function readStoredIdentity(): { userId?: string; name?: string } {
  if (typeof window === "undefined") return {};
  return {
    userId: sessionStorage.getItem(USER_ID_KEY) ?? undefined,
    name: sessionStorage.getItem(USER_NAME_KEY) ?? undefined,
  };
}

interface WidgetMoved {
  widgetId: string;
  x: number;
  y: number;
}

interface Callbacks {
  onJoined?: (result: BoardJoinResult) => void;
  onCursor?: (peer: CursorReceive) => void;
  onPeerJoined?: (peer: CanvasUser) => void;
  onPeerLeft?: (userId: string) => void;
  onLockFixed?: (lock: LockFixed) => void;
  onLockReleased?: (lock: LockReleased) => void;
  onLockDenied?: (denied: LockDenied) => void;
  onWidgetMoved?: (move: WidgetMoved) => void;
  onWidgetAnchored?: (move: WidgetMoved) => void;
  onWidgetPlaced?: (widget: ServerWidget) => void;
  onHardFixed?: (lock: HardFixed) => void;
  onHardReleased?: (lock: HardReleased) => void;
  onPurchased?: (p: Purchased) => void;
}

interface Options extends Callbacks {
  slug: string;
  enabled: boolean;
  /** World-space viewport at the moment of joining. */
  initialViewport: () => Viewport;
}

const CURSOR_THROTTLE_MS = 40;
const VIEWPORT_DEBOUNCE_MS = 150;

export function useCanvasSocket({
  slug,
  enabled,
  initialViewport,
  ...cb
}: Options) {
  const [connected, setConnected] = useState(false);
  const [me, setMe] = useState<CanvasUser | null>(null);

  const socketRef = useRef<Socket | null>(null);
  // Keep latest callbacks / viewport getter without re-running the connect
  // effect. Updated in an effect (never during render).
  const cbRef = useRef<Callbacks>(cb);
  const initialViewportRef = useRef(initialViewport);
  useEffect(() => {
    cbRef.current = cb;
    initialViewportRef.current = initialViewport;
  });

  const lastCursorSent = useRef(0);
  const lastMoveSent = useRef(0);
  const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const { userId, name } = readStoredIdentity();
    const socket = io(`${WS_URL}/canvas`, {
      transports: ["websocket"],
      // Send the httpOnly auth cookie so the gateway can authorize widget moves
      // (tenant/sub-user). Anonymous end users simply have no cookie.
      withCredentials: true,
      auth: { userId, name },
    });
    socketRef.current = socket;

    socket.on("session", (user: CanvasUser) => {
      setMe(user);
      sessionStorage.setItem(USER_ID_KEY, user.userId);
      sessionStorage.setItem(USER_NAME_KEY, user.name);
    });

    socket.on("connect", () => {
      setConnected(true);
      socket.emit(
        "board:join",
        { slug, viewport: initialViewportRef.current() },
        (result: BoardJoinResult | { error: string }) => {
          if ("error" in result) return;
          cbRef.current.onJoined?.(result);
        },
      );
    });

    socket.on("disconnect", () => setConnected(false));
    socket.on("cursor:move:receive", (p: CursorReceive) => cbRef.current.onCursor?.(p));
    socket.on("peer:joined", (p: CanvasUser) => cbRef.current.onPeerJoined?.(p));
    socket.on("peer:left", (p: { userId: string }) => cbRef.current.onPeerLeft?.(p.userId));
    socket.on("widget:lock:soft:fixed", (l: LockFixed) => cbRef.current.onLockFixed?.(l));
    socket.on("widget:lock:soft:release", (l: LockReleased) => cbRef.current.onLockReleased?.(l));
    socket.on("widget:lock:soft:denied", (d: LockDenied) => cbRef.current.onLockDenied?.(d));
    socket.on("widget:moved", (m: WidgetMoved) => cbRef.current.onWidgetMoved?.(m));
    socket.on("widget:anchored", (m: WidgetMoved) => cbRef.current.onWidgetAnchored?.(m));
    socket.on("widget:placed", (w: ServerWidget) => cbRef.current.onWidgetPlaced?.(w));
    socket.on("widget:lock:hard:fixed", (l: HardFixed) => cbRef.current.onHardFixed?.(l));
    socket.on("widget:lock:hard:release", (l: HardReleased) => cbRef.current.onHardReleased?.(l));
    socket.on("widget:purchased", (p: Purchased) => cbRef.current.onPurchased?.(p));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, slug]);

  const sendCursor = useCallback((x: number, y: number) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    const now = Date.now();
    if (now - lastCursorSent.current < CURSOR_THROTTLE_MS) return;
    lastCursorSent.current = now;
    socket.emit("cursor:move:send", { x, y });
  }, []);

  const updateViewport = useCallback((viewport: Viewport) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    if (viewportTimer.current) clearTimeout(viewportTimer.current);
    viewportTimer.current = setTimeout(() => {
      socket.emit("viewport:update", { viewport });
    }, VIEWPORT_DEBOUNCE_MS);
  }, []);

  const softLock = useCallback((widgetId: string) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit("widget:lock:soft:init", { widgetId });
  }, []);

  // Checkout — promote all of this user's soft locks to 5-minute hard locks.
  const hardLock = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit("widget:lock:hard:init", {});
  }, []);

  // Throttled mid-drag move. Ignored server-side unless the socket is allowed
  // to move widgets (tenant/permitted sub-user).
  const moveWidget = useCallback(
    (widgetId: string, x: number, y: number, width: number, height: number) => {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      const now = Date.now();
      if (now - lastMoveSent.current < CURSOR_THROTTLE_MS) return;
      lastMoveSent.current = now;
      socket.emit("widget:move", { widgetId, x, y, width, height });
    },
    [],
  );

  const moveWidgetEnd = useCallback(
    (widgetId: string, x: number, y: number, width: number, height: number) => {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      socket.emit("widget:move:end", { widgetId, x, y, width, height });
    },
    [],
  );

  // Drop a sidebar inventory item onto the canvas — persists its first
  // coordinates and broadcasts the full widget to peers. Ignored server-side
  // unless the socket may manage widgets (tenant/permitted sub-user).
  const placeWidget = useCallback((widgetId: string, x: number, y: number) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit("widget:place", { widgetId, x, y });
  }, []);

  return { connected, me, sendCursor, updateViewport, softLock, hardLock, moveWidget, moveWidgetEnd, placeWidget };
}
