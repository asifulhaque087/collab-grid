-- ============================================================================
-- Realtime Canvas Queries
-- ============================================================================

-- Lookup a board by its public slug. Returned regardless of access level; the
-- gateway decides whether anonymous (public) or authenticated (private) access
-- is allowed based on the `access` column.
-- name: GetRealtimeBoardBySlug :one
SELECT id, slug, name, access, max_width, max_height
FROM boards
WHERE slug = $1;

-- Placed widgets for a board: those that already carry canvas coordinates
-- (pos_x IS NOT NULL). Sidebar inventory items have NULL coordinates and are
-- excluded until they are first placed.
-- name: GetPlacedWidgets :many
SELECT id, name, sku, photo, price, quantity, pos_x, pos_y, width, height
FROM smart_widgets
WHERE board_id = $1
  AND pos_x IS NOT NULL
ORDER BY created_at DESC;

-- Stamp new canvas coordinates onto a widget, board-scoped so a stray id can't
-- touch another board's row. Returns the full row so callers can read the
-- widget's stored dimensions (width/height) for zone calculations.
-- name: UpdateWidgetPosition :one
UPDATE smart_widgets
SET pos_x = sqlc.arg('pos_x'),
    pos_y = sqlc.arg('pos_y'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
  AND board_id = sqlc.arg('board_id')
RETURNING id, name, sku, photo, price, quantity, pos_x, pos_y, width, height;

-- Permanently remove a sold/purchased widget, board-scoped.
-- name: RemoveWidget :exec
DELETE FROM smart_widgets
WHERE id = $1
  AND board_id = $2;

-- The set of (action, subject) grants a user holds through their roles. Used to
-- decide whether an authenticated editor may reposition widgets on the canvas
-- (requires update:SmartWidget).
-- name: GetUserWidgetPermissions :many
SELECT p.action, p.subject
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE ur.user_id = $1;
