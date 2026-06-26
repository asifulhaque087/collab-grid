// Client-side mirror of the NestJS /canvas gateway contract.

export interface CanvasUser {
  userId: string;
  name: string;
  color: string;
}

export interface Viewport {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type LockKind = "soft" | "hard";

export interface ServerWidget {
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
  lock?: { userId: string; kind: LockKind; ttl: number };
}

export interface ServerLock {
  widgetId: string;
  userId: string;
  kind: LockKind;
  ttl: number;
}

export interface BoardJoinResult {
  boardId: string;
  slug: string;
  name: string;
  maxWidth: number;
  maxHeight: number;
  widgets: ServerWidget[];
  peers: CanvasUser[];
  myLocks: ServerLock[];
}

export interface CursorReceive extends CanvasUser {
  x: number;
  y: number;
}

export interface LockFixed {
  widgetId: string;
  userId: string;
  name: string;
  ttl: number;
}

export interface LockReleased {
  widgetId: string;
}

export interface LockDenied {
  widgetId: string;
  reason: string;
}

export interface HardFixed {
  widgetIds: string[];
  userId: string;
  ttl: number;
}

export interface HardReleased {
  widgetId: string;
}

export interface Purchased {
  widgetId: string;
}
