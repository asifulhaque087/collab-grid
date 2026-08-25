-- ============================================================================
-- 6. Inventory (Smart Widget) Queries
-- ============================================================================

-- name: ListSmartWidgetsByPrimaryUserId :many
SELECT sw.*, b.name AS board_name
FROM smart_widgets sw
LEFT JOIN boards b ON b.id = sw.board_id
WHERE sw.primary_user_id = sqlc.arg('primary_user_id')
  AND (
    sqlc.narg('board_id')::uuid IS NULL
    OR sw.board_id = sqlc.narg('board_id')
  )
ORDER BY sw.created_at DESC;

-- name: GetSmartWidgetById :one
SELECT sw.*, b.name AS board_name
FROM smart_widgets sw
LEFT JOIN boards b ON b.id = sw.board_id
WHERE sw.id = $1 AND sw.primary_user_id = $2;

-- name: GetBoardExistsForUser :one
SELECT EXISTS (
    SELECT 1
    FROM boards
    WHERE id = $1 AND primary_user_id = $2
);

-- name: CreateSmartWidget :one
INSERT INTO smart_widgets (
    primary_user_id,
    secondary_user_id,
    board_id,
    sku,
    photo,
    quantity,
    price,
    name,
    width,
    height
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: UpdateSmartWidget :exec
UPDATE smart_widgets
SET name = COALESCE(sqlc.narg('name'), name),
    sku = COALESCE(sqlc.narg('sku'), sku),
    quantity = COALESCE(sqlc.narg('quantity'), quantity),
    price = COALESCE(sqlc.narg('price'), price),
    photo = COALESCE(sqlc.narg('photo'), photo),
    board_id = COALESCE(sqlc.narg('board_id'), board_id),
    width = COALESCE(sqlc.narg('width'), width),
    height = COALESCE(sqlc.narg('height'), height),
    updated_at = NOW()
WHERE id = sqlc.arg('id');

-- name: DeleteSmartWidget :exec
DELETE FROM smart_widgets
WHERE id = $1;

-- name: CreateSmartWidgets :copyfrom
INSERT INTO smart_widgets (
    primary_user_id,
    secondary_user_id,
    board_id,
    sku,
    photo,
    quantity,
    price,
    name,
    width,
    height
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
