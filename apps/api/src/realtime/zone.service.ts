import { Injectable } from '@nestjs/common';

export interface Viewport {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// The canvas is a fixed 10,000 x 10,000 world partitioned into a 10 x 10 matrix
// of square "zones". A socket only subscribes to the zones its viewport
// overlaps, so high-frequency events (cursors, widget moves) fan out to the
// handful of users actually looking at that region instead of the whole board.
@Injectable()
export class ZoneService {
  private readonly ZONE_SIZE = 1000;
  private readonly GRID_DIM = 10; // zones 0..9 on each axis

  // Viewport / cursor: the zones a rectangular viewport (or a point, when
  // min===max) overlaps.
  calculateOverlappingZones(viewport: Viewport): string[] {
    return this.collectZones(
      viewport.minX,
      viewport.minY,
      viewport.maxX,
      viewport.maxY,
    );
  }

  // Widget: the zones a widget's bounding box (x,y + width,height) overlaps.
  calculateWidgetOverlappingZones(
    x: number,
    y: number,
    width: number,
    height: number,
  ): string[] {
    return this.collectZones(x, y, x + width, y + height);
  }

  // The single zone a point falls in (used for cursor position).
  zoneForPoint(x: number, y: number): string | null {
    const zones = this.collectZones(x, y, x, y);
    return zones[0] ?? null;
  }

  // Socket.io room name for a board's zone. Rooms are board-scoped so two
  // boards never share a zone room.
  room(boardId: string, zone: string): string {
    return `board:${boardId}:zone:${zone}`;
  }

  // Board-wide room — every socket on a board joins this. Used for events that
  // must reach all viewers regardless of viewport (presence, lock state).
  boardRoom(boardId: string): string {
    return `board:${boardId}`;
  }

  private collectZones(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): string[] {
    const zones: string[] = [];

    const startZoneX = Math.floor(minX / this.ZONE_SIZE);
    const endZoneX = Math.floor(maxX / this.ZONE_SIZE);
    const startZoneY = Math.floor(minY / this.ZONE_SIZE);
    const endZoneY = Math.floor(maxY / this.ZONE_SIZE);

    for (let x = startZoneX; x <= endZoneX; x++) {
      for (let y = startZoneY; y <= endZoneY; y++) {
        // Guardrail against the 10,000 x 10,000 boundary (zones 0..9).
        if (x >= 0 && x < this.GRID_DIM && y >= 0 && y < this.GRID_DIM) {
          zones.push(`${x}_${y}`);
        }
      }
    }
    return zones;
  }
}
