// ### Core Auth & User Tables

import { relations } from 'drizzle-orm';
import { text } from 'drizzle-orm/pg-core';
import { primaryKey } from 'drizzle-orm/pg-core';
import { foreignKey } from 'drizzle-orm/pg-core';
import { unique } from 'drizzle-orm/pg-core';
import { timestamp } from 'drizzle-orm/pg-core';
import { numeric } from 'drizzle-orm/pg-core';
import { integer } from 'drizzle-orm/pg-core';
import { date } from 'drizzle-orm/pg-core';
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
    plan: text('plan').notNull(), // 'free' | 'pro'
    planExpiresAt: date('plan_expires_at'),

    parentId: uuid('parent_id'),

    // parentId: uuid('parent_id').references(() => userTable.id), // Tenant hierarchy
  },
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'user_parent_fk',
    }),
  ],
);




// group.ts — Roles (type: 'role') and Plans (type: 'plan')
export const groupTable = pgTable('group', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  type: text('type').$type<'role' | 'plan'>().notNull(),
  createdBy: text('created_by')
    .$type<'constant' | 'admin' | 'tenant'>()
    .notNull(),
});

export const userGroupTable = pgTable(
  'user_group',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => userTable.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groupTable.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({
      name: 'user_group_pkey',
      columns: [table.userId, table.groupId],
    }),
  ],
);

// ### Permissions & Feature Flags

export const permissionsTable = pgTable(
  'permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    action: text('action').notNull(), // e.g. 'create', 'read', 'update', 'delete', 'manage'
    subject: text('subject').notNull(), // e.g. 'Board', 'Widget', 'Inventory', 'all'
    name: text('name').notNull(), // Human-readable label
    description: text('description'),
  },
  (table) => [unique('action_subject_uniq').on(table.action, table.subject)],
);

// group_permission.ts — Which permissions a group holds
export const groupPermissionTable = pgTable(
  'group_permission',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groupTable.id, {
        onDelete: 'cascade',
      }),

    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissionsTable.id, {
        onDelete: 'cascade',
      }),

    totalOperation: integer('total_operation'), // Quota cap (null = perimssion exits | -1 = unlimited)
  },
  (table) => [
    primaryKey({
      name: 'group_permission_pkey',
      columns: [table.groupId, table.permissionId],
    }),
  ],
);

// ### Subscriptions & Payments

// user_plan_snapshot.ts — Denormalized plan entitlements per user
export const userPlanSnapshotTable = pgTable('user_plan_snapshot', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => userTable.id, {
    onDelete: 'cascade',
  }),
  action: text('action').notNull(),
  subject: text('subject').notNull(),
  granted: integer('granted'), // Total allowed operations
  remaining: integer('remaining'), // Remaining budget
  extra: integer('extra').notNull(), // Extra operations
});

// payment_history.ts
export const paymentHistoryTable = pgTable('payment_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => userTable.id),
  planName: text('plan_name').notNull(),
  durationMonth: integer('duration_month').$type<1 | 6 | 12 | 24>().notNull(),
  amountPaid: numeric('amount_paid', { precision: 10, scale: 2 }).notNull(),
  transactionId: text('transaction_id').notNull(),
  paymentMethod: text('payment_method')
    .$type<'bkash' | 'nagad' | 'sslcommerz' | 'manual'>()
    .notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ### Suggested Additional Models

// board.ts — Canvas environments
export const boardTable = pgTable('board', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => userTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  maxWidth: integer('max_width').default(10000),
  maxHeight: integer('max_height').default(10000),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// widget.ts — Interactive canvas nodes
export const smartWidgetTable = pgTable('smart_widget', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => userTable.id, { onDelete: 'cascade' }),
  boardId: uuid('board_id').references(() => boardTable.id, {
    onDelete: 'set null',
  }),
  sku: text('sku').notNull(),
  photo: text('photo'), // Fixed bug: changed duplicated db column name 'sku' to 'photo'
  quantity: integer('quantity').notNull(),
  price: numeric('price'), // Fixed bug: changed duplicated db column name 'pos_x' to 'price'
  name: text('name').notNull(),
  posX: numeric('pos_x'),
  posY: numeric('pos_y'),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==========================================
// User Relations
// ==========================================

export const userTableRelations = relations(userTable, ({ one, many }) => ({
  // Self-referencing relationship (Parent / Children)
  parent: one(userTable, {
    fields: [userTable.parentId],
    references: [userTable.id],
    relationName: 'user_hierarchy',
  }),
  children: many(userTable, {
    relationName: 'user_hierarchy',
  }),
  userGroups: many(userGroupTable),
  paymentHistory: many(paymentHistoryTable),
  boards: many(boardTable),
  smartWidgets: many(smartWidgetTable),
  planSnapshot: one(userPlanSnapshotTable),
}));

// ==========================================
// Group Relations
// ==========================================
export const groupTableRelations = relations(groupTable, ({ many }) => ({
  userGroups: many(userGroupTable),
  groupPermissions: many(groupPermissionTable),
}));

// ==========================================
// UserGroup (Junction Table) Relations
// ==========================================

export const userGroupTableRelations = relations(userGroupTable, ({ one }) => ({
  user: one(userTable, {
    fields: [userGroupTable.userId],
    references: [userTable.id],
  }),
  group: one(groupTable, {
    fields: [userGroupTable.groupId],
    references: [groupTable.id],
  }),
}));

// ==========================================
// Permissions Relations
// ==========================================
export const permissionsTableRelations = relations(
  permissionsTable,
  ({ many }) => ({
    groupPermissions: many(groupPermissionTable),
  }),
);

// ==========================================
// GroupPermission Relations
// ==========================================
export const groupPermissionTableRelations = relations(
  groupPermissionTable,
  ({ one }) => ({
    group: one(groupTable, {
      fields: [groupPermissionTable.groupId],
      references: [groupTable.id],
    }),
    // Composite relation to the target permission record
    permission: one(permissionsTable, {
      fields: [groupPermissionTable.permissionId],
      references: [permissionsTable.id],
    }),
  }),
);

// ==========================================
// UserPlanSnapshot & PaymentHistory Relations
// ==========================================
export const userPlanSnapshotTableRelations = relations(
  userPlanSnapshotTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [userPlanSnapshotTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const paymentHistoryTableRelations = relations(
  paymentHistoryTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [paymentHistoryTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const boardTableRelations = relations(boardTable, ({ one, many }) => ({
  tenant: one(userTable, {
    fields: [boardTable.tenantId],
    references: [userTable.id],
  }),

  smartWidgets: many(smartWidgetTable),

  // smartWidgets: many(smartWidgetTable, {
  //   fields: [boardTable.id],
  //   references: [smartWidgetTable.boardId],
  // }),
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
