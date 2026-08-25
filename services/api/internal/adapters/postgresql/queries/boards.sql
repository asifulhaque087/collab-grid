-- ============================================================================
-- 1. Board Queries
-- ============================================================================

-- name: ListBoardsByPrimaryUserId :many
SELECT b.*, COUNT(sw.id)::bigint AS widget_count
FROM boards b
LEFT JOIN smart_widgets sw ON sw.board_id = b.id
WHERE b.primary_user_id = $1
GROUP BY b.id
ORDER BY b.created_at DESC;

-- name: GetBoardById :one
SELECT b.*, COUNT(sw.id)::bigint AS widget_count
FROM boards b
LEFT JOIN smart_widgets sw ON sw.board_id = b.id
WHERE b.id = $1 AND b.primary_user_id = $2
GROUP BY b.id;

-- name: GetBoardBySlug :one
SELECT b.*, COUNT(sw.id)::bigint AS widget_count
FROM boards b
LEFT JOIN smart_widgets sw ON sw.board_id = b.id
WHERE b.slug = $1 AND b.primary_user_id = $2
GROUP BY b.id;

-- name: GetPublicBoardBySlug :one
SELECT b.*, COUNT(sw.id)::bigint AS widget_count
FROM boards b
LEFT JOIN smart_widgets sw ON sw.board_id = b.id
WHERE b.slug = $1 AND b.access = 'public'
GROUP BY b.id;

-- name: GetBoardIdBySlug :one
SELECT id
FROM boards
WHERE slug = $1
LIMIT 1;

-- name: CreateBoard :one
INSERT INTO boards (
    primary_user_id,
    secondary_user_id,
    name,
    slug,
    access,
    max_width,
    max_height
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: UpdateBoard :one
UPDATE boards
SET name = COALESCE(sqlc.narg('name'), name),
    access = COALESCE(sqlc.narg('access'), access),
    max_width = COALESCE(sqlc.narg('max_width'), max_width),
    max_height = COALESCE(sqlc.narg('max_height'), max_height),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteBoard :exec
DELETE FROM boards
WHERE id = $1;