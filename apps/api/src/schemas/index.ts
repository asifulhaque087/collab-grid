// ### Core Auth & User Tables

import { relations } from 'drizzle-orm';
import { text } from 'drizzle-orm/pg-core';
import { primaryKey } from 'drizzle-orm/pg-core';
import { foreignKey } from 'drizzle-orm/pg-core';
import { timestamp } from 'drizzle-orm/pg-core';
import { numeric } from 'drizzle-orm/pg-core';
import { integer } from 'drizzle-orm/pg-core';
import { date } from 'drizzle-orm/pg-core';
import { uuid } from 'drizzle-orm/pg-core';
import { pgTable } from 'drizzle-orm/pg-core';

// user.ts
export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  password: text('password').notNull(),
  refreshToken: text('refresh_token'),
  resetPasswordToken: text('reset_password_token'),
  resetPasswordExpiresAt: text('reset_password_expires_at'),
  plan: text('plan'), // 'free' | 'pro'
  planExpiresAt: date('plan_expires_at'),
  parentId: uuid('parent_id').references(() => user.id), // Tenant hierarchy
});

// group.ts — Roles (type: 'role') and Plans (type: 'plan')
export const group = pgTable('group', {
  slug: text('slug').primaryKey(),
  title: text('title').notNull(),
  type: text('type').$type<'role' | 'plan'>().notNull(),
  createdBy: text('created_by')
    .$type<'constant' | 'admin' | 'tenant'>()
    .notNull(),
});

// user_group.ts — Many-to-Many junction
export const userGroup = pgTable(
  'user_group',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    groupId: text('group_id')
      .notNull()
      .references(() => group.slug, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({
      name: 'user_group_pkey',
      columns: [table.userId, table.groupId],
    }),
  ],
);

// ### Permissions & Feature Flags

// permissions.ts — CASL action+subject pairs
export const permissions = pgTable(
  'permissions',
  {
    action: text('action').notNull(), // e.g. 'create', 'read', 'update', 'delete', 'manage'
    subject: text('subject').notNull(), // e.g. 'Board', 'Widget', 'Inventory', 'all'
    name: text('name').notNull(), // Human-readable label
    description: text('description'),
  },
  (table) => [
    primaryKey({
      name: 'permissions_pkey',
      columns: [table.action, table.subject],
    }),
  ],
);

// group_permission.ts — Which permissions a group holds
export const groupPermission = pgTable(
  'group_permission',
  {
    groupId: text('group_id')
      .primaryKey()
      .references(() => group.slug, { onDelete: 'cascade' }),
    permissionAction: text('permission_action').notNull(),
    permissionSubject: text('permission_subject').notNull(),
    totalOperation: integer('total_operation'), // Quota cap (null =  perimssion exits | -1 = unlimited)
  },
  (table) => [
    foreignKey({
      columns: [table.permissionAction, table.permissionSubject],
      foreignColumns: [permissions.action, permissions.subject],
      name: 'group_permission_to_permissions_fk',
    }).onDelete('cascade'),
  ],
);

// ### Subscriptions & Payments

// user_plan_snapshot.ts — Denormalized plan entitlements per user
export const userPlanSnapshot = pgTable('user_plan_snapshot', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  subject: text('subject').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  granted: integer('granted').notNull(), // Total allowed operations
  remaining: integer('remaining').notNull(), // Remaining budget
});

// payment_history.ts
export const paymentHistory = pgTable('payment_history', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => user.id),
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

// These models are not yet defined but will be required:

// board.ts — Canvas environments
export const board = pgTable('board', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  maxWidth: integer('max_width').default(10000),
  maxHeight: integer('max_height').default(10000),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// widget.ts — Interactive canvas nodes
export const smartWidget = pgTable('smart_widget', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  boardId: uuid('board_id').references(() => board.id, {
    onDelete: 'set null',
  }),
  sku: text('sku').notNull(),
  photo: text('sku'),
  quantity: integer('quantity').notNull(),
  price: numeric('pos_x'),
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

export const userRelations = relations(user, ({ one, many }) => ({
  // Self-referencing relationship (Parent / Children)
  parent: one(user, {
    fields: [user.parentId],
    references: [user.id],
    relationName: 'user_hierarchy',
  }),
  children: many(user, {
    relationName: 'user_hierarchy',
  }),

  // Many-to-Many join table link
  userGroups: many(userGroup),

  paymentHistory: many(paymentHistory, {
    fields: [user.id],
    references: [paymentHistory.userId],
  }),

  boards: many(board, {
    fields: [user.id],
    references: [board.tenantId],
  }),

  smartWidgets: many(smartWidget, {
    fields: [user.id],
    references: [board.tenantId],
  }),

  // One-to-One relationships
  planSnapshot: one(userPlanSnapshot, {
    fields: [user.id],
    references: [userPlanSnapshot.userId],
  }),
}));

// ==========================================
// Group Relations
// ==========================================
export const groupRelations = relations(group, ({ many }) => ({
  userGroups: many(userGroup),
  groupPermissions: many(groupPermission),
}));

// ==========================================
// UserGroup (Junction Table) Relations
// ==========================================

export const userGroupRelations = relations(userGroup, ({ one }) => ({
  user: one(user, {
    fields: [userGroup.userId],
    references: [user.id],
  }),
  group: one(group, {
    fields: [userGroup.groupId],
    references: [group.slug],
  }),
}));

// ==========================================
// Permissions Relations
// ==========================================
export const permissionsRelations = relations(permissions, ({ many }) => ({
  groupPermissions: many(groupPermission),
}));

// ==========================================
// GroupPermission Relations
// ==========================================
export const groupPermissionRelations = relations(
  groupPermission,
  ({ one }) => ({
    group: one(group, {
      fields: [groupPermission.groupId],
      references: [group.slug],
    }),
    // Composite relation to the target permission record
    permission: one(permissions, {
      fields: [
        groupPermission.permissionAction,
        groupPermission.permissionSubject,
      ],
      references: [permissions.action, permissions.subject],
    }),
  }),
);

// ==========================================
// UserPlanSnapshot & PaymentHistory Relations
// ==========================================
export const userPlanSnapshotRelations = relations(
  userPlanSnapshot,
  ({ one }) => ({
    user: one(user, {
      fields: [userPlanSnapshot.userId],
      references: [user.id],
    }),
  }),
);

export const paymentHistoryRelations = relations(paymentHistory, ({ one }) => ({
  user: one(user, {
    fields: [paymentHistory.userId],
    references: [user.id],
  }),
}));

export const boardRelations = relations(board, ({ one }) => ({
  tenant: one(user, {
    fields: [board.tenantId],
    references: [user.id],
  }),
  smartWidgets: many(smartWidget, {
    fields: [board.id],
    references: [smartWidget.boardId],
  }),
}));

export const smartWidgetRelations = relations(smartWidget, ({ one }) => ({
  board: one(board, {
    fields: [smartWidget.boardId],
    references: [board.id],
  }),
}));
