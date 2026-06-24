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
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

@Injectable()
export class PlanService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
      })),
    }));
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

        if (dto.permissionIds.length > 0) {
          await tx.insert(groupPermissionTable).values(
            dto.permissionIds.map((permissionId) => ({
              groupId: created.id,
              permissionId,
              totalOperation: null,
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

        if (dto.permissionIds !== undefined) {
          await tx
            .delete(groupPermissionTable)
            .where(eq(groupPermissionTable.groupId, id));

          if (dto.permissionIds.length > 0) {
            await tx.insert(groupPermissionTable).values(
              dto.permissionIds.map((permissionId) => ({
                groupId: id,
                permissionId,
                totalOperation: null,
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
      })),
    };
  }
}
