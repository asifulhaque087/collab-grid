import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { tryit } from '@collab-grid/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import {
  groupTable,
  paymentHistoryTable,
  userGroupTable,
  userPlanSnapshotTable,
  userTable,
} from '@/schemas';
import { FREE_PLAN_SLUG, TENANT_ROLE_SLUG } from '@/auth/rbac.constants';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

const UNLIMITED = -1;

// Monthly price per plan slug (BDT/USD agnostic — gateway integration lands
// later). Free is $0; Pro is $9/month per the project spec.
const PLAN_MONTHLY_PRICE: Record<string, number> = {
  free: 0,
  pro: 9,
};

function addMonths(base: Date, months: number): Date {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

// `plan_expires_at` is a DATE column (string mode) — store as YYYY-MM-DD.
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class SubscriptionService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // A tenant subscribes to / upgrades a plan. Adds the plan's quotas onto the
  // user's snapshot, extends (or starts) the expiry, and records the payment.
  async subscribe(dto: CreateSubscriptionDto, userId: string) {
    const [plan, planErr] = await tryit(
      this.db.query.groupTable.findFirst({
        where: and(eq(groupTable.slug, dto.plan), eq(groupTable.type, 'plan')),
        with: { groupPermissions: { with: { permission: true } } },
      }),
    );

    if (planErr)
      throw new InternalServerErrorException('An unexpected error occurred');
    if (!plan) throw new NotFoundException('Plan not found');

    const [user, userErr] = await tryit(
      this.db
        .select({ planExpiresAt: userTable.planExpiresAt })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .then((rows) => rows[0]),
    );

    if (userErr)
      throw new InternalServerErrorException('An unexpected error occurred');
    if (!user) throw new NotFoundException('User not found');

    // Extend from current expiry when still active, otherwise start from now.
    const now = new Date();
    const currentExpiry = user.planExpiresAt
      ? new Date(user.planExpiresAt)
      : null;
    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const newExpiry = addMonths(base, dto.durationMonth);

    const monthlyPrice = PLAN_MONTHLY_PRICE[dto.plan] ?? 0;
    const amountPaid = (monthlyPrice * dto.durationMonth).toFixed(2);

    const [, txErr] = await tryit(
      this.db.transaction(async (tx) => {
        // Add each plan quota onto the matching snapshot row (insert if absent).
        for (const gp of plan.groupPermissions) {
          if (gp.totalOperation === null) continue;

          const { action, subject } = gp.permission;
          const quota = gp.totalOperation;

          // Target the numeric quota row (granted not null). A user can also
          // have a null boolean-capability row for the same action/subject from
          // their tenant role — that one must not absorb the quota.
          const existing = await tx
            .select()
            .from(userPlanSnapshotTable)
            .where(
              and(
                eq(userPlanSnapshotTable.userId, userId),
                eq(userPlanSnapshotTable.action, action),
                eq(userPlanSnapshotTable.subject, subject),
                isNotNull(userPlanSnapshotTable.granted),
              ),
            )
            .then((rows) => rows[0]);

          if (!existing) {
            await tx.insert(userPlanSnapshotTable).values({
              userId,
              action,
              subject,
              granted: quota,
              remaining: quota,
              extra: 0,
            });
            continue;
          }

          // Unlimited plan quota (-1) makes the entitlement unlimited outright;
          // otherwise add the new quota onto the existing budget.
          const isUnlimited =
            quota === UNLIMITED ||
            existing.granted === UNLIMITED ||
            existing.remaining === UNLIMITED;

          await tx
            .update(userPlanSnapshotTable)
            .set({
              granted: isUnlimited
                ? UNLIMITED
                : (existing.granted ?? 0) + quota,
              remaining: isUnlimited
                ? UNLIMITED
                : (existing.remaining ?? 0) + quota,
            })
            .where(eq(userPlanSnapshotTable.id, existing.id));
        }

        await tx
          .update(userTable)
          .set({ plan: dto.plan, planExpiresAt: toDateString(newExpiry) })
          .where(eq(userTable.id, userId));

        await tx.insert(paymentHistoryTable).values({
          userId,
          planName: plan.title,
          durationMonth: dto.durationMonth,
          amountPaid,
          transactionId: dto.transactionId,
          paymentMethod: 'manual',
          startDate: now,
          endDate: newExpiry,
        });
      }),
    );

    if (txErr)
      throw new InternalServerErrorException('An unexpected error occurred');

    return {
      plan: dto.plan,
      planExpiresAt: toDateString(newExpiry),
      amountPaid,
      transactionId: dto.transactionId,
    };
  }

  // Payment ledger for a user, newest first — surfaced in the Transactions table.
  async findPayments(userId: string) {
    const [payments, err] = await tryit(
      this.db.query.paymentHistoryTable.findMany({
        where: eq(paymentHistoryTable.userId, userId),
        orderBy: (p, { desc }) => [desc(p.createdAt)],
      }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');
    return payments ?? [];
  }

  // Nightly: downgrade expired tenants to the free plan and reset their quota
  // snapshot to the free plan's entitlements.
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async downgradeExpiredTenants() {
    const [freePlan, planErr] = await tryit(
      this.db.query.groupTable.findFirst({
        where: and(
          eq(groupTable.slug, FREE_PLAN_SLUG),
          eq(groupTable.type, 'plan'),
        ),
        with: { groupPermissions: { with: { permission: true } } },
      }),
    );

    if (planErr || !freePlan) {
      throw new InternalServerErrorException('Failed to resolve free plan');
    }

    const today = toDateString(new Date());

    // Tenant-role users whose plan has expired.
    const [expiredUsers, usersErr] = await tryit(
      this.db
        .select({ userId: userTable.id })
        .from(userTable)
        .innerJoin(userGroupTable, eq(userTable.id, userGroupTable.userId))
        .innerJoin(groupTable, eq(userGroupTable.groupId, groupTable.id))
        .where(
          and(
            eq(groupTable.slug, TENANT_ROLE_SLUG),
            eq(groupTable.type, 'role'),
            lt(userTable.planExpiresAt, today),
          ),
        ),
    );

    if (usersErr) {
      throw new InternalServerErrorException(
        'Failed to resolve expired tenants',
      );
    }

    for (const { userId } of expiredUsers ?? []) {
      await tryit(
        this.db.transaction(async (tx) => {
          await tx
            .update(userTable)
            .set({ plan: FREE_PLAN_SLUG })
            .where(eq(userTable.id, userId));

          // Reset each free-plan quota back to its base value.
          for (const gp of freePlan.groupPermissions) {
            if (gp.totalOperation === null) continue;
            const { action, subject } = gp.permission;

            await tx
              .update(userPlanSnapshotTable)
              .set({
                granted: gp.totalOperation,
                remaining: gp.totalOperation,
                extra: 0,
              })
              .where(
                and(
                  eq(userPlanSnapshotTable.userId, userId),
                  eq(userPlanSnapshotTable.action, action),
                  eq(userPlanSnapshotTable.subject, subject),
                  // Only the numeric quota row, never the null capability row.
                  isNotNull(userPlanSnapshotTable.granted),
                ),
              );
          }
        }),
      );
    }
  }
}
