-- ============================================================================
-- 7. Role Queries
-- ============================================================================

-- name: GetUserPermissions :many
SELECT DISTINCT p.id, p.name, p.action, p.subject, p.description
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE ur.user_id = $1;

-- name: ListAllPermissions :many
SELECT id, name, action, subject, description
FROM permissions
ORDER BY subject, action;

-- name: ListRolesByPrimaryUserID :many
SELECT r.*, COUNT(ur.id)::bigint AS member_count
FROM roles r
LEFT JOIN user_roles ur ON ur.role_id = r.id
WHERE r.primary_user_id = $1
GROUP BY r.id
ORDER BY r.title;

-- name: GetRoleById :one
SELECT r.*, COUNT(ur.id)::bigint AS member_count
FROM roles r
LEFT JOIN user_roles ur ON ur.role_id = r.id
WHERE r.id = $1
GROUP BY r.id;

-- name: ListRolePermissionsByRoleIDs :many
SELECT rp.role_id,
       p.id AS permission_id,
       p.name AS permission_name,
       p.action AS permission_action,
       p.subject AS permission_subject
FROM role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
WHERE rp.role_id = ANY($1::uuid[]);

-- name: ListRolePermissionEndpoints :many
SELECT DISTINCT p.endpoint, p.method
FROM role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
WHERE rp.role_id = $1;

-- name: CreateRole :one
INSERT INTO roles (
    slug,
    title,
    primary_user_id,
    secondary_user_id
)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: CreateRolePermissions :exec
INSERT INTO role_permissions (role_id, permission_id)
SELECT sqlc.arg('role_id')::uuid, x
FROM unnest(sqlc.arg('permission_ids')::uuid[]) AS x;

-- name: UpdateRole :one
UPDATE roles
SET title = sqlc.arg('title')
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteRolePermissions :exec
DELETE FROM role_permissions
WHERE role_id = $1;

-- name: DeleteRole :exec
DELETE FROM roles
WHERE id = $1;
