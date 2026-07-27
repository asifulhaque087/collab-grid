-- ============================================================================
-- 1. Defaults & Seed Checks
-- ============================================================================

-- name: GetPackageBySlug :one
SELECT *
FROM packages
WHERE slug = $1
LIMIT 1;

-- name: GetRoleBySlug :one
SELECT *
FROM roles
WHERE slug = $1
LIMIT 1;


-- ============================================================================
-- 2. User & Signup Queries
-- ============================================================================

-- name: GetUserByEmail :one
SELECT *
FROM users
WHERE email = $1
LIMIT 1;

-- name: GetUserById :one
SELECT *
FROM users
WHERE id = $1
LIMIT 1;

-- name: GetUserByRefreshToken :one
SELECT *
FROM users
WHERE refresh_token = $1
LIMIT 1;

-- name: GetUserByResetToken :one
SELECT *
FROM users
WHERE reset_password_token = $1
LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (name, email, password, provider)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: AssignUserRole :exec
INSERT INTO user_roles (user_id, role_id)
VALUES ($1, $2);

-- name: CreateSubscription :exec
INSERT INTO subscriptions (
    user_id, package_id, start_date, end_date, payment_method, amount
)
VALUES ($1, $2, $3, $4, $5, $6);


-- ============================================================================
-- 3. Password & Session Management Updates
-- ============================================================================

-- name: SetResetPasswordToken :exec
UPDATE users
SET reset_password_token = $1,
    reset_password_expires_at = $2
WHERE id = $3;

-- name: UpdatePasswordAndClearTokens :exec
UPDATE users
SET password = $1,
    reset_password_token = NULL,
    reset_password_expires_at = NULL,
    refresh_token = NULL
WHERE id = $2;

-- name: UpdateRefreshToken :exec
UPDATE users
SET refresh_token = $1
WHERE id = $2;

-- name: ClearRefreshToken :exec
UPDATE users
SET refresh_token = NULL
WHERE id = $1;


-- ============================================================================
-- 4. Access Control (RBAC) & Quotas
-- ============================================================================

-- name: GetAccessContextByUserId :many
SELECT
    r.slug AS role_slug,
    r.title AS role_title,
    p.action,
    p.subject
FROM user_roles ur
INNER JOIN roles r ON ur.role_id = r.id
INNER JOIN role_permissions rp ON r.id = rp.role_id
INNER JOIN permissions p ON rp.permission_id = p.id
WHERE ur.user_id = $1;

-- name: GetUserQuotas :many
SELECT
    p.action,
    p.subject,
    ppl.limit_count,
    COALESCE(SUM(lu.used), 0)::bigint AS total_used
FROM subscriptions s
INNER JOIN package_permission_limits ppl ON s.package_id = ppl.package_id
INNER JOIN permissions p ON ppl.permission_id = p.id
LEFT JOIN limit_usages lu ON ppl.id = lu.package_permission_limit_id AND lu.user_id = $1
WHERE s.user_id = $1
  AND (s.end_date IS NULL OR s.end_date > NOW())
GROUP BY p.action, p.subject, ppl.limit_count;
