-- ============================================================================
-- Package Queries
-- ============================================================================

-- Permissions exposed for building/assigning package quotas. Mirrors the TS
-- service which joins permissions through the tenant role (TENANT_ROLE_SLUG).
-- name: ListTenantRolePermissions :many
SELECT DISTINCT p.id, p.name, p.action, p.subject, p.description
FROM permissions p
JOIN role_permissions rp ON rp.permission_id = p.id
JOIN roles r ON r.id = rp.role_id
WHERE r.slug = $1
ORDER BY p.subject, p.action;

-- All packages with their active subscription count.
-- name: ListPackages :many
SELECT p.id,
       p.title,
       p.slug,
       p.price,
       p.primary_user_id,
       p.secondary_user_id,
       COUNT(s.id)::bigint AS subscriber_count
FROM packages p
LEFT JOIN subscriptions s ON s.package_id = p.id
GROUP BY p.id
ORDER BY p.title;

-- Single package with its active subscription count.
-- name: GetPackageByID :one
SELECT p.id,
       p.title,
       p.slug,
       p.price,
       p.primary_user_id,
       p.secondary_user_id,
       COUNT(s.id)::bigint AS subscriber_count
FROM packages p
LEFT JOIN subscriptions s ON s.package_id = p.id
WHERE p.id = $1
GROUP BY p.id;

-- Permission limits (with joined permission metadata) for the given packages.
-- name: ListPackagePermissionLimits :many
SELECT ppl.package_id,
       p.id AS permission_id,
       p.name AS permission_name,
       p.action AS permission_action,
       p.subject AS permission_subject,
       ppl.limit_count
FROM package_permission_limits ppl
JOIN permissions p ON p.id = ppl.permission_id
WHERE ppl.package_id = ANY($1::uuid[]);

-- Partial update of a package. NULL arguments leave the column unchanged.
-- name: UpdatePackage :one
UPDATE packages
SET title = COALESCE(sqlc.narg('title'), title),
    slug  = COALESCE(sqlc.narg('slug'), slug),
    price = COALESCE(sqlc.narg('price'), price)
WHERE id = sqlc.arg('id')
RETURNING *;

-- Delete all permission limits belonging to a package.
-- name: DeletePackagePermissionLimits :exec
DELETE FROM package_permission_limits
WHERE package_id = $1;

-- Delete a package.
-- name: DeletePackage :exec
DELETE FROM packages
WHERE id = $1;
