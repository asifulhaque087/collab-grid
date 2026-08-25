-- ============================================================================
-- 9. Order Queries
-- ============================================================================

-- name: GetOrderIdByIdempotencyKey :one
SELECT id
FROM orders
WHERE idempotency_key = $1;

-- name: GetBoardIdById :one
SELECT id
FROM boards
WHERE id = $1;

-- name: ListWidgetsForOrder :many
SELECT id, name, sku, price, quantity
FROM smart_widgets
WHERE board_id = $1
  AND id = ANY(sqlc.arg('widget_ids')::uuid[]);

-- name: CreateOrder :one
INSERT INTO orders (
    idempotency_key,
    board_id,
    buyer_user_id,
    buyer_name,
    email,
    phone,
    address,
    city,
    postal_code,
    country,
    amount_total,
    payment_method,
    card_last4,
    status
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *;

-- name: CreateOrderItems :copyfrom
INSERT INTO order_items (order_id, widget_id, name, sku, price, quantity)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: ListOrdersByPrimaryUserID :many
SELECT o.id, o.buyer_name, o.email, o.amount_total, o.payment_method,
       o.card_last4, o.status, o.created_at, o.board_id,
       b.name AS board_name,
       oi.id AS item_id, oi.name AS item_name, oi.sku AS item_sku,
       oi.price AS item_price, oi.quantity AS item_quantity
FROM orders o
JOIN boards b ON b.id = o.board_id
JOIN order_items oi ON oi.order_id = o.id
WHERE b.primary_user_id = $1
ORDER BY o.created_at DESC;

-- name: GetOrderById :one
SELECT *
FROM orders
WHERE id = $1;

-- name: ListOrderItemsByOrderId :many
SELECT id, widget_id, name, sku, price, quantity
FROM order_items
WHERE order_id = $1;
