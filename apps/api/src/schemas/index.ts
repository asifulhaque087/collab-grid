// ### Core Auth & User Tables

import { relations } from 'drizzle-orm';
import { text } from 'drizzle-orm/pg-core';
import { foreignKey } from 'drizzle-orm/pg-core';
import { unique } from 'drizzle-orm/pg-core';
import { index } from 'drizzle-orm/pg-core';
import { timestamp } from 'drizzle-orm/pg-core';
import { numeric } from 'drizzle-orm/pg-core';
import { integer } from 'drizzle-orm/pg-core';
import { uuid } from 'drizzle-orm/pg-core';
import { pgTable } from 'drizzle-orm/pg-core';

// user.ts
export const userTable = pgTable(
  'user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    password: text('password'),
    provider: text('provider'),

    refreshToken: text('refresh_token'),
    resetPasswordToken: text('reset_password_token'),
    resetPasswordExpiresAt: timestamp('reset_password_expires_at'),

    parentId: uuid('parent_id'),
  },
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'user_parent_fk',
    }),
  ],
);

// ### Permissions & Feature Flags

export const permissionsTable = pgTable(
  'permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    action: text('action').notNull(),
    subject: text('subject').notNull(),
    name: text('name').notNull(),
    description: text('description'),
  },
  (table) => [unique('action_subject_uniq').on(table.action, table.subject)],
);

// ### Role-Based Access Control

export const roleTable = pgTable(
  'role',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    primaryUserId: uuid('primary_user_id').references(() => userTable.id, {
      onDelete: 'cascade',
    }),
    secondaryUserId: uuid('secondary_user_id').references(() => userTable.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [index('role_primary_user_id_idx').on(table.primaryUserId)],
);

export const rolePermissionTable = pgTable(
  'role_permission',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roleTable.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissionsTable.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('role_permission_role_id_idx').on(table.roleId),
    index('role_permission_permission_id_idx').on(table.permissionId),
  ],
);

export const userRoleTable = pgTable(
  'user_role',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => userTable.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roleTable.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('user_role_user_id_idx').on(table.userId),
    index('user_role_role_id_idx').on(table.roleId),
  ],
);

// ### Permission Limits (Packages)

export const packageTable = pgTable('package', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  primaryUserId: uuid('primary_user_id').references(() => userTable.id, {
    onDelete: 'cascade',
  }),
  secondaryUserId: uuid('secondary_user_id').references(() => userTable.id, {
    onDelete: 'set null',
  }),
});

export const packagePermissionLimitTable = pgTable(
  'package_permission_limit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => packageTable.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissionsTable.id, { onDelete: 'cascade' }),
    limit: integer('limit'),
  },
  (table) => [
    index('pkg_perm_limit_package_id_idx').on(table.packageId),
    index('pkg_perm_limit_permission_id_idx').on(table.permissionId),
  ],
);

export const subscriptionTable = pgTable(
  'subscription',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => userTable.id, { onDelete: 'cascade' }),
    packageId: uuid('package_id')
      .notNull()
      .references(() => packageTable.id, { onDelete: 'cascade' }),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date'),
    paymentMethod: text('payment_method')
      .$type<'bkash' | 'nagad' | 'sslcommerz' | 'manual'>()
      .notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  },
  (table) => [index('subscription_user_id_idx').on(table.userId)],
);

export const limitUsageTable = pgTable(
  'limit_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    used: integer('used').notNull(),
    packagePermissionLimitId: uuid('package_permission_limit_id')
      .notNull()
      .references(() => packagePermissionLimitTable.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => [
    index('limit_usage_pkg_perm_limit_id_idx').on(
      table.packagePermissionLimitId,
    ),
  ],
);

export const userLimitUsageTable = pgTable(
  'user_limit_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => userTable.id, { onDelete: 'cascade' }),
    limitUsageId: uuid('limit_usage_id')
      .notNull()
      .references(() => limitUsageTable.id, { onDelete: 'cascade' }),
  },
  (table) => [index('user_limit_usage_user_id_idx').on(table.userId)],
);

// ### Suggested Additional Models

// board.ts — Canvas environments
export const boardTable = pgTable('board', {
  id: uuid('id').primaryKey().defaultRandom(),
  primaryUserId: uuid('primary_user_id').references(() => userTable.id, {
    onDelete: 'cascade',
  }),
  secondaryUserId: uuid('secondary_user_id').references(() => userTable.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  access: text('access')
    .$type<'restricted' | 'public'>()
    .notNull()
    .default('restricted'),
  maxWidth: integer('max_width').default(10000),
  maxHeight: integer('max_height').default(10000),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// widget.ts — Interactive canvas nodes
export const smartWidgetTable = pgTable('smart_widget', {
  id: uuid('id').primaryKey().defaultRandom(),
  primaryUserId: uuid('primary_user_id').references(() => userTable.id, {
    onDelete: 'cascade',
  }),
  secondaryUserId: uuid('secondary_user_id').references(() => userTable.id, {
    onDelete: 'set null',
  }),
  boardId: uuid('board_id').references(() => boardTable.id, {
    onDelete: 'set null',
  }),
  sku: text('sku').notNull(),
  photo: text('photo'),
  quantity: integer('quantity').notNull(),
  price: numeric('price'),
  name: text('name').notNull(),
  posX: numeric('pos_x'),
  posY: numeric('pos_y'),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// order.ts — End-user purchases.
export const orderTable = pgTable('order', {
  id: uuid('id').primaryKey().defaultRandom(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  boardId: uuid('board_id').references(() => boardTable.id, {
    onDelete: 'set null',
  }),
  buyerUserId: text('buyer_user_id'),
  buyerName: text('buyer_name'),
  email: text('email'),
  phone: text('phone'),
  address: text('address').notNull(),
  city: text('city'),
  postalCode: text('postal_code'),
  country: text('country'),
  amountTotal: numeric('amount_total', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull().default('card'),
  cardLast4: text('card_last4'),
  status: text('status').$type<'paid'>().notNull().default('paid'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// order_item.ts
export const orderItemTable = pgTable('order_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orderTable.id, { onDelete: 'cascade' }),
  widgetId: uuid('widget_id'),
  name: text('name').notNull(),
  sku: text('sku').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
});

// ==========================================
// User Relations
// ==========================================

export const userTableRelations = relations(userTable, ({ one, many }) => ({
  parent: one(userTable, {
    fields: [userTable.parentId],
    references: [userTable.id],
    relationName: 'user_hierarchy',
  }),
  children: many(userTable, {
    relationName: 'user_hierarchy',
  }),
  boards: many(boardTable),
  smartWidgets: many(smartWidgetTable),
  userRoles: many(userRoleTable),
  subscriptions: many(subscriptionTable),
}));

// ==========================================
// Permissions Relations
// ==========================================
export const permissionsTableRelations = relations(
  permissionsTable,
  ({ many }) => ({
    rolePermissions: many(rolePermissionTable),
    packagePermissionLimits: many(packagePermissionLimitTable),
  }),
);

// ==========================================
// Role Relations
// ==========================================
export const roleTableRelations = relations(roleTable, ({ one, many }) => ({
  primaryUser: one(userTable, {
    fields: [roleTable.primaryUserId],
    references: [userTable.id],
    relationName: 'role_primary_user',
  }),
  secondaryUser: one(userTable, {
    fields: [roleTable.secondaryUserId],
    references: [userTable.id],
    relationName: 'role_secondary_user',
  }),
  rolePermissions: many(rolePermissionTable),
  userRoles: many(userRoleTable),
}));

export const rolePermissionTableRelations = relations(
  rolePermissionTable,
  ({ one }) => ({
    role: one(roleTable, {
      fields: [rolePermissionTable.roleId],
      references: [roleTable.id],
    }),
    permission: one(permissionsTable, {
      fields: [rolePermissionTable.permissionId],
      references: [permissionsTable.id],
    }),
  }),
);

export const userRoleTableRelations = relations(userRoleTable, ({ one }) => ({
  user: one(userTable, {
    fields: [userRoleTable.userId],
    references: [userTable.id],
  }),
  role: one(roleTable, {
    fields: [userRoleTable.roleId],
    references: [roleTable.id],
  }),
}));

// ==========================================
// Package Relations
// ==========================================
export const packageTableRelations = relations(
  packageTable,
  ({ one, many }) => ({
    primaryUser: one(userTable, {
      fields: [packageTable.primaryUserId],
      references: [userTable.id],
      relationName: 'package_primary_user',
    }),
    secondaryUser: one(userTable, {
      fields: [packageTable.secondaryUserId],
      references: [userTable.id],
      relationName: 'package_secondary_user',
    }),
    packagePermissionLimits: many(packagePermissionLimitTable),
    subscriptions: many(subscriptionTable),
  }),
);

export const packagePermissionLimitTableRelations = relations(
  packagePermissionLimitTable,
  ({ one, many }) => ({
    package: one(packageTable, {
      fields: [packagePermissionLimitTable.packageId],
      references: [packageTable.id],
    }),
    permission: one(permissionsTable, {
      fields: [packagePermissionLimitTable.permissionId],
      references: [permissionsTable.id],
    }),
    limitUsages: many(limitUsageTable),
  }),
);

export const subscriptionTableRelations = relations(
  subscriptionTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [subscriptionTable.userId],
      references: [userTable.id],
    }),
    package: one(packageTable, {
      fields: [subscriptionTable.packageId],
      references: [packageTable.id],
    }),
  }),
);

export const limitUsageTableRelations = relations(
  limitUsageTable,
  ({ one, many }) => ({
    packagePermissionLimit: one(packagePermissionLimitTable, {
      fields: [limitUsageTable.packagePermissionLimitId],
      references: [packagePermissionLimitTable.id],
    }),
    userLimitUsages: many(userLimitUsageTable),
  }),
);

export const userLimitUsageTableRelations = relations(
  userLimitUsageTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [userLimitUsageTable.userId],
      references: [userTable.id],
    }),
    limitUsage: one(limitUsageTable, {
      fields: [userLimitUsageTable.limitUsageId],
      references: [limitUsageTable.id],
    }),
  }),
);

// ==========================================
// Board & Widget Relations
// ==========================================

export const boardTableRelations = relations(boardTable, ({ one, many }) => ({
  primaryUser: one(userTable, {
    fields: [boardTable.primaryUserId],
    references: [userTable.id],
    relationName: 'board_primary_user',
  }),
  secondaryUser: one(userTable, {
    fields: [boardTable.secondaryUserId],
    references: [userTable.id],
    relationName: 'board_secondary_user',
  }),
  smartWidgets: many(smartWidgetTable),
}));

export const smartWidgetTableRelations = relations(
  smartWidgetTable,
  ({ one }) => ({
    board: one(boardTable, {
      fields: [smartWidgetTable.boardId],
      references: [boardTable.id],
    }),
  }),
);

export const orderTableRelations = relations(orderTable, ({ one, many }) => ({
  board: one(boardTable, {
    fields: [orderTable.boardId],
    references: [boardTable.id],
  }),
  items: many(orderItemTable),
}));

export const orderItemTableRelations = relations(orderItemTable, ({ one }) => ({
  order: one(orderTable, {
    fields: [orderItemTable.orderId],
    references: [orderTable.id],
  }),
}));
