package realtime

import "fmt"

// ZoneService partitions the fixed 10,000 x 10,000 canvas world into a 10x10
// matrix of square zones. A socket only subscribes to the zones its viewport (or
// a widget's bounding box) overlaps, so high-frequency events (cursors, widget
// moves) fan out to the handful of users actually looking at that region.
type ZoneService struct {
	zoneSize int
	gridDim  int
}

func NewZoneService() *ZoneService {
	return &ZoneService{zoneSize: 1000, gridDim: 10}
}

func (z *ZoneService) CalculateOverlappingZones(vp Viewport) []string {
	return z.collect(vp.MinX, vp.MinY, vp.MaxX, vp.MaxY)
}

func (z *ZoneService) CalculateWidgetOverlappingZones(x, y, width, height float64) []string {
	return z.collect(x, y, x+width, y+height)
}

func (z *ZoneService) ZoneForPoint(x, y float64) string {
	zones := z.collect(x, y, x, y)
	if len(zones) == 0 {
		return ""
	}
	return zones[0]
}

func (z *ZoneService) collect(minX, minY, maxX, maxY float64) []string {
	zones := make([]string, 0)

	startX := int(minX) / z.zoneSize
	endX := int(maxX) / z.zoneSize
	startY := int(minY) / z.zoneSize
	endY := int(maxY) / z.zoneSize

	for x := startX; x <= endX; x++ {
		for y := startY; y <= endY; y++ {
			if x >= 0 && x < z.gridDim && y >= 0 && y < z.gridDim {
				zones = append(zones, fmt.Sprintf("%d_%d", x, y))
			}
		}
	}
	return zones
}

// Room returns the socket.io-style room name for a board's zone. Rooms are
// board-scoped so two boards never share a zone room.
func (z *ZoneService) Room(boardID, zone string) string {
	return fmt.Sprintf("board:%s:zone:%s", boardID, zone)
}

// BoardRoom returns the board-wide room that every socket on a board joins. Used
// for events that must reach all viewers regardless of viewport (presence, lock
// state).
func (z *ZoneService) BoardRoom(boardID string) string {
	return "board:" + boardID
}

// BoardRoom is the package-level helper used across the service (e.g. the expiry
// watcher) where a ZoneService instance isn't in scope.
func BoardRoom(boardID string) string {
	return "board:" + boardID
}
