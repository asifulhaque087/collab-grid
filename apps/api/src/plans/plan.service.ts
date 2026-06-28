import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { tryit } from '@collab-grid/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import {
  groupTable,
  groupPermissionTable,
  permissionsTable,
} from '@/schemas';
import { TENANT_ROLE_SLUG } from '@/auth/rbac.constants';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

const UNLIMITED_QUOTA = -1;

// Monthly price per plan slug — mirrors SubscriptionService.PLAN_MONTHLY_PRICE.
// The schema has no price column, so price is derived from the slug.
const PLAN_MONTHLY_PRICE: Record<string, number> = {
  free: 0,
  pro: 9,
};

// Maps a quota'd permission subject onto its homepage feature caption.
const QUOTA_FEATURE_TEXT: Record<string, string> = {
  Board: 'boards',
  Group: 'custom roles per tenant',
  SmartWidget: 'widgets per board',
};

// Render order for the derived feature bullets.
const QUOTA_FEATURE_ORDER = ['Board', 'Group', 'SmartWidget'];

@Injectable()
export class PlanService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // Plans only ever quota the tenant role's permissions, so the picker is
  // scoped to that role's grants (excludes the super-admin `manage:all`).
  async listPermissions() {
    const [perms, err] = await tryit(
      this.db
        .select({
          id: permissionsTable.id,
          name: permissionsTable.name,
          action: permissionsTable.action,
          subject: permissionsTable.subject,
          description: permissionsTable.description,
        })
        .from(permissionsTable)
        .innerJoin(
          groupPermissionTable,
          eq(groupPermissionTable.permissionId, permissionsTable.id),
        )
        .innerJoin(groupTable, eq(groupTable.id, groupPermissionTable.groupId))
        .where(eq(groupTable.slug, TENANT_ROLE_SLUG))
        .orderBy(permissionsTable.subject, permissionsTable.action),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');
    return perms ?? [];
  }

  async findAll() {
    const [plans, err] = await tryit(
      this.db.query.groupTable.findMany({
        where: eq(groupTable.type, 'plan'),
        with: {
          groupPermissions: { with: { permission: true } },
          userGroups: true,
        },
      }),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');

    return (plans ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      createdBy: p.createdBy,
      createdByUserId: p.createdByUserId,
      createdAt: p.createdAt,
      isSystem: p.createdBy === 'constant',
      subscriberCount: p.userGroups.length,
      permissions: p.groupPermissions.map((gp) => ({
        id: gp.permission.id,
        name: gp.permission.name,
        action: gp.permission.action,
        subject: gp.permission.subject,
        totalOperation: gp.totalOperation,
      })),
    }));
  }

  // Public, unauthenticated plan cards for the marketing homepage funnel.
  // Quota numbers stored on each plan's group permissions become feature
  // bullets; price is derived from the slug. Cheapest plan first.
  async findPublicPlans() {
    const [plans, err] = await tryit(
      this.db.query.groupTable.findMany({
        where: eq(groupTable.type, 'plan'),
        with: { groupPermissions: { with: { permission: true } } },
      }),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');

    return (plans ?? [])
      .map((p) => {
        const monthlyPrice = PLAN_MONTHLY_PRICE[p.slug] ?? 0;

        const features = p.groupPermissions
          .filter(
            (gp) =>
              gp.totalOperation !== null &&
              QUOTA_FEATURE_TEXT[gp.permission.subject],
          )
          .sort(
            (a, b) =>
              QUOTA_FEATURE_ORDER.indexOf(a.permission.subject) -
              QUOTA_FEATURE_ORDER.indexOf(b.permission.subject),
          )
          .map((gp) => ({
            value:
              gp.totalOperation === UNLIMITED_QUOTA
                ? 'Unlimited'
                : String(gp.totalOperation),
            text: QUOTA_FEATURE_TEXT[gp.permission.subject],
          }));

        return {
          id: p.id,
          slug: p.slug,
          title: p.title,
          monthlyPrice,
          featured: monthlyPrice > 0,
          features,
        };
      })
      .sort((a, b) => a.monthlyPrice - b.monthlyPrice);
  }

  async create(dto: CreatePlanDto, userId: string) {
    const slug = toSlug(dto.name);

    const [plan, txErr] = await tryit(
      this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(groupTable)
          .values({
            slug,
            title: dto.name,
            type: 'plan',
            createdBy: 'admin',
            createdByUserId: userId,
            grantedByUserId: null,
          })
          .returning();

        if (dto.permissions.length > 0) {
          await tx.insert(groupPermissionTable).values(
            dto.permissions.map((p) => ({
              groupId: created.id,
              permissionId: p.permissionId,
              totalOperation: p.totalOperation,
            })),
          );
        }

        return created;
      }),
    );

    if (txErr || !plan) throw new InternalServerErrorException('An unexpected error occurred');

    return this.findById(plan.id);
  }

  async update(id: string, dto: UpdatePlanDto) {
    const plan = await this.findById(id);

    if (plan.isSystem) {
      throw new ForbiddenException('System plans cannot be modified');
    }

    const [, txErr] = await tryit(
      this.db.transaction(async (tx) => {
        if (dto.name) {
          await tx
            .update(groupTable)
            .set({ slug: toSlug(dto.name), title: dto.name })
            .where(eq(groupTable.id, id));
        }

        if (dto.permissions !== undefined) {
          await tx
            .delete(groupPermissionTable)
            .where(eq(groupPermissionTable.groupId, id));

          if (dto.permissions.length > 0) {
            await tx.insert(groupPermissionTable).values(
              dto.permissions.map((p) => ({
                groupId: id,
                permissionId: p.permissionId,
                totalOperation: p.totalOperation,
              })),
            );
          }
        }
      }),
    );

    if (txErr) throw new InternalServerErrorException('An unexpected error occurred');

    return this.findById(id);
  }

  async remove(id: string) {
    const plan = await this.findById(id);

    if (plan.isSystem) {
      throw new ForbiddenException('System plans cannot be deleted');
    }

    const [, err] = await tryit(
      this.db.delete(groupTable).where(eq(groupTable.id, id)),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');
  }

  private async findById(id: string) {
    const [plan, err] = await tryit(
      this.db.query.groupTable.findFirst({
        where: eq(groupTable.id, id),
        with: {
          groupPermissions: { with: { permission: true } },
          userGroups: true,
        },
      }),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');
    if (!plan) throw new NotFoundException('Plan not found');

    return {
      id: plan.id,
      slug: plan.slug,
      title: plan.title,
      createdBy: plan.createdBy,
      createdByUserId: plan.createdByUserId,
      createdAt: plan.createdAt,
      isSystem: plan.createdBy === 'constant',
      subscriberCount: plan.userGroups.length,
      permissions: plan.groupPermissions.map((gp) => ({
        id: gp.permission.id,
        name: gp.permission.name,
        action: gp.permission.action,
        subject: gp.permission.subject,
        totalOperation: gp.totalOperation,
      })),
    };
  }
}
