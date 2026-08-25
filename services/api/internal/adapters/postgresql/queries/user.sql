-- ============================================================================
-- 8. User Queries
-- ============================================================================

-- name: ListWorkspaceUsers :many
SELECT id, name, email, provider
FROM users
WHERE id <> sqlc.arg('exclude_user_id')::uuid
  AND (
    primary_user_id = sqlc.arg('scope_user_id')::uuid
    OR id = sqlc.arg('scope_user_id')::uuid
  )
ORDER BY name;

-- name: GetUserProfileById :one
SELECT id, name, email, provider
FROM users
WHERE id = $1;

-- name: CreateSubUser :one
INSERT INTO users (name, email, password, provider, primary_user_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, name, email, provider;

-- name: UpdateUserProfile :one
UPDATE users
SET name = COALESCE(sqlc.narg('name'), name),
    email = COALESCE(sqlc.narg('email'), email),
    password = COALESCE(sqlc.narg('password'), password)
WHERE id = sqlc.arg('id')
RETURNING id, name, email, provider;

-- name: DeleteSubUser :exec
DELETE FROM users
WHERE id = $1;

-- name: ListUserRolesByUserIDs :many
SELECT DISTINCT ur.user_id, r.id AS role_id, r.title, r.slug
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = ANY(sqlc.arg('user_ids')::uuid[]);

-- name: GrantUserRoles :exec
INSERT INTO user_roles (user_id, role_id)
SELECT sqlc.arg('user_id')::uuid, x
FROM unnest(sqlc.arg('role_ids')::uuid[]) AS x;

-- name: DeleteUserRoles :exec
DELETE FROM user_roles
WHERE user_id = $1;
