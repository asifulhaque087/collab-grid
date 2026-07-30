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
