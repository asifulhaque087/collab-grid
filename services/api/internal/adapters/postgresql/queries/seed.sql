-- name: TruncateAllTables :exec
TRUNCATE TABLE
    order_items,
    orders,
    smart_widgets,
    boards,
    limit_usages,
    subscriptions,
    package_permission_limits,
    packages,
    user_roles,
    role_permissions,
    roles,
    permissions,
    users
RESTART IDENTITY CASCADE;

-- name: InsertPermission :one
INSERT INTO permissions (action, subject, name, endpoint, method, description)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, action, subject;

-- name: InsertRole :one
INSERT INTO roles (title, slug, primary_user_id, secondary_user_id)
VALUES ($1, $2, $3, $4)
RETURNING id;

-- name: InsertUser :one
INSERT INTO users (name, email, password, provider, primary_user_id, secondary_user_id)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id;

-- name: InsertPackage :one
INSERT INTO packages (title, slug, price, primary_user_id, secondary_user_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;

-- name: GrantRolePermission :exec
INSERT INTO role_permissions (role_id, permission_id)
VALUES ($1, $2);

-- name: InsertPackagePermissionLimit :exec
INSERT INTO package_permission_limits (package_id, permission_id, limit_count)
VALUES ($1, $2, $3);

-- name: InsertSubscription :exec
INSERT INTO subscriptions (user_id, package_id, start_date, end_date, payment_method, amount)
VALUES ($1, $2, $3, $4, $5, $6);
