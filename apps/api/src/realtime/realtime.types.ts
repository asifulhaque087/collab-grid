import type { Viewport } from './zone.service';

export type { Viewport };

// Anonymous end-user identity. End users never register; the client mints/stores
// a userId in sessionStorage and sends it on connect so locks survive a refresh.
export interface CanvasUser {
  userId: string;
  name: string;
  color: string;
}

export type LockKind = 'soft' | 'hard';

export interface WidgetLock {
  widgetId: string;
  userId: string;
  kind: LockKind;
  // ms remaining until the lock auto-expires.
  ttl: number;
}

// A widget as streamed to the canvas on join. Coordinates are world-space.
export interface CanvasWidgetDto {
  id: string;
  name: string;
  sku: string;
  photo: string | null;
  price: number;
  quantity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  // Present when another user currently holds a lock on it.
  lock?: { userId: string; kind: LockKind; ttl: number };
}

export interface BoardJoinResult {
  boardId: string;
  slug: string;
  name: string;
  maxWidth: number;
  maxHeight: number;
  widgets: CanvasWidgetDto[];
  peers: CanvasUser[];
  // The joining user's own active locks (with remaining ttl) for refresh recovery.
  myLocks: WidgetLock[];
}

// Client → server payloads.
export interface JoinPayload {
  slug: string;
  viewport: Viewport;
}

export interface CursorMovePayload {
  x: number;
  y: number;
}

export interface ViewportUpdatePayload {
  viewport: Viewport;
}

export interface SoftLockPayload {
  widgetId: string;
}

// Widget reposition. width/height let the backend compute every zone the
// widget's bounding box overlaps so the move broadcasts to the right rooms.
export interface WidgetMovePayload {
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
