-- ============================================================================
-- Subscription Service Queries
-- ============================================================================

-- List a user's subscriptions joined with their package details, newest first.
-- name: ListSubscriptionsByUser :many
SELECT
    s.id,
    s.package_id,
    p.title AS package_title,
    p.slug  AS package_slug,
    s.start_date,
    s.end_date,
    s.payment_method,
    s.amount
FROM subscriptions s
JOIN packages p ON p.id = s.package_id
WHERE s.user_id = $1
ORDER BY s.start_date DESC;

-- Look up a single subscription for a user + package pair. Used to block
-- duplicate Free-package subscriptions.
-- name: GetSubscriptionByUserAndPackage :one
SELECT id
FROM subscriptions
WHERE user_id = $1
  AND package_id = $2
LIMIT 1;

-- Create a subscription and return the inserted row.
-- name: CreateSubscriptionReturning :one
INSERT INTO subscriptions (
    user_id,
    package_id,
    start_date,
    end_date,
    payment_method,
    amount
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- ============================================================================
-- Limit Guard Queries (do not remove — consumed by auth middleware)
-- ============================================================================

-- name: GetUserPrimaryOwner :one
SELECT primary_user_id
FROM users
WHERE id = $1;

-- name: CountUserSubscriptions :one
SELECT COUNT(*)::int
FROM subscriptions
WHERE user_id = $1;

-- name: GetActiveSubscriptions :many
SELECT package_id
FROM subscriptions
WHERE user_id = $1
  AND (end_date IS NULL OR end_date > NOW())
ORDER BY start_date;

-- name: GetPackagePermissionLimitByEndpoint :one
SELECT 
    ppl.id,
    ppl.limit_count
FROM package_permission_limits ppl
JOIN permissions p ON ppl.permission_id = p.id
WHERE ppl.package_id = $1
  AND p.endpoint = $2
  AND p.method = $3
LIMIT 1;

-- name: GetPackagePermissionLimit :one
SELECT 
    ppl.id,
    ppl.limit_count
FROM package_permission_limits ppl
JOIN permissions p ON ppl.permission_id = p.id
WHERE ppl.package_id = $1
  AND p.action = $2
  AND p.subject = $3
LIMIT 1;

-- name: IncrementLimitUsage :one
UPDATE limit_usages
SET used = used + 1
WHERE user_id = $1
  AND package_permission_limit_id = $2
  AND used < $3
RETURNING id;

-- name: DecrementLimitUsage :one
UPDATE limit_usages
SET used = GREATEST(used - 1, 0)
WHERE user_id = $1
  AND package_permission_limit_id = $2
RETURNING id;

-- name: GetLimitUsage :one
SELECT used
FROM limit_usages
WHERE user_id = $1
  AND package_permission_limit_id = $2
LIMIT 1;

-- name: InitializeLimitUsage :one
INSERT INTO limit_usages (
    user_id,
    package_permission_limit_id,
    used
) VALUES (
    $1, $2, 1
)
RETURNING id;
