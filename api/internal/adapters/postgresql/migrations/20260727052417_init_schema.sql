-- +goose Up
-- Enable extension for default_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Core Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT,
    provider TEXT,
    refresh_token TEXT,
    reset_password_token TEXT,
    reset_password_expires_at TIMESTAMP,
    primary_user_id UUID,
    secondary_user_id UUID,
    CONSTRAINT users_primary_user_fk FOREIGN KEY (primary_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT users_secondary_user_fk FOREIGN KEY (secondary_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 2. Permissions Table
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    subject TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    CONSTRAINT action_subject_uniq UNIQUE (action, subject)
);

-- 3. Roles Table & Role Permissions
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    primary_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    secondary_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX roles_primary_user_id_idx ON roles(primary_user_id);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE
);
CREATE INDEX role_permissions_role_id_idx ON role_permissions(role_id);
CREATE INDEX role_permissions_permission_id_idx ON role_permissions(permission_id);

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE
);
CREATE INDEX user_roles_user_id_idx ON user_roles(user_id);
CREATE INDEX user_roles_role_id_idx ON user_roles(role_id);

-- 4. Packages, Limits & Subscriptions
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    price TEXT NOT NULL DEFAULT '0',
    primary_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    secondary_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE package_permission_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    limit_count INTEGER
);
CREATE INDEX pkg_perm_limits_package_id_idx ON package_permission_limits(package_id);
CREATE INDEX pkg_perm_limits_permission_id_idx ON package_permission_limits(permission_id);

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    payment_method TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL
);
CREATE INDEX subscriptions_user_id_idx ON subscriptions(user_id);

CREATE TABLE limit_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    used INTEGER NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_permission_limit_id UUID NOT NULL REFERENCES package_permission_limits(id) ON DELETE CASCADE
);
CREATE INDEX limit_usages_pkg_perm_limit_user_id_idx ON limit_usages(package_permission_limit_id, user_id);

-- 5. Canvas Environments (Boards & Smart Widgets)
CREATE TABLE boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    secondary_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    access TEXT NOT NULL DEFAULT 'restricted',
    max_width INTEGER DEFAULT 10000,
    max_height INTEGER DEFAULT 10000,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE smart_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    secondary_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    board_id UUID REFERENCES boards(id) ON DELETE SET NULL,
    sku TEXT NOT NULL,
    photo TEXT,
    quantity INTEGER NOT NULL,
    price NUMERIC,
    name TEXT NOT NULL,
    pos_x NUMERIC,
    pos_y NUMERIC,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. Orders & Order Items
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    board_id UUID REFERENCES boards(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
    buyer_user_id TEXT,
    buyer_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT NOT NULL,
    city TEXT,
    postal_code TEXT,
    country TEXT,
    amount_total NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'card',
    card_last4 TEXT,
    status TEXT NOT NULL DEFAULT 'paid',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX orders_seller_id_idx ON orders(seller_id);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    widget_id UUID REFERENCES smart_widgets(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1
);

-- +goose Down
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS smart_widgets;
DROP TABLE IF EXISTS boards;
DROP TABLE IF EXISTS limit_usages;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS package_permission_limits;
DROP TABLE IF EXISTS packages;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS users;
