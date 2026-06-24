import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, inArray, count } from 'drizzle-orm';
import { tryit } from '@collab-grid/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import {
  groupTable,
  groupPermissionTable,
  permissionsTable,
  userGroupTable,
} from '@/schemas';
import { SUPER_ADMIN_ROLE_SLUG } from '@/auth/rbac.constants';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

@Injectable()
export class RoleService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private async resolveCreatedBy(
    userId: string,
  ): Promise<'admin' | 'tenant'> {
    const [groups, err] = await tryit(
      this.db
        .select({ slug: groupTable.slug, createdBy: groupTable.createdBy })
        .from(userGroupTable)
        .innerJoin(groupTable, eq(userGroupTable.groupId, groupTable.id))
        .where(eq(userGroupTable.userId, userId)),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');

    const isSuperAdmin = (groups ?? []).some(
      (g) => g.slug === SUPER_ADMIN_ROLE_SLUG && g.createdBy === 'constant',
    );

    return isSuperAdmin ? 'admin' : 'tenant';
  }

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

  async findAll(userId: string) {
    const createdBy = await this.resolveCreatedBy(userId);

    // Super-admin sees all roles; tenants see system roles + their own custom roles
    const [roles, err] = await tryit(
      this.db.query.groupTable.findMany({
        where:
          createdBy === 'admin'
            ? eq(groupTable.type, 'role')
            : and(
                eq(groupTable.type, 'role'),
              ),
        with: {
          groupPermissions: {
            with: { permission: true },
          },
          userGroups: true,
        },
      }),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');

    return (roles ?? [])
      .filter(
        (r) =>
          createdBy === 'admin' ||
          r.createdBy === 'constant' ||
          r.createdByUserId === userId,
      )
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        createdBy: r.createdBy,
        createdByUserId: r.createdByUserId,
        createdAt: r.createdAt,
        isSystem: r.createdBy === 'constant',
        memberCount: r.userGroups.length,
        permissions: r.groupPermissions.map((gp) => ({
          id: gp.permission.id,
          name: gp.permission.name,
          action: gp.permission.action,
          subject: gp.permission.subject,
        })),
      }));
  }

  async create(dto: CreateRoleDto, userId: string) {
    const createdBy = await this.resolveCreatedBy(userId);
    const slug = toSlug(dto.name);

    const [role, txErr] = await tryit(
      this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(groupTable)
          .values({
            slug,
            title: dto.name,
            type: 'role',
            createdBy,
            createdByUserId: userId,
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

    if (txErr || !role) throw new InternalServerErrorException('An unexpected error occurred');

    return this.findById(role.id);
  }

  async update(id: string, dto: UpdateRoleDto, userId: string) {
    const role = await this.findById(id);

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be modified');
    }

    const createdBy = await this.resolveCreatedBy(userId);
    if (createdBy !== 'admin' && role.createdByUserId !== userId) {
      throw new ForbiddenException('You do not own this role');
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

  async remove(id: string, userId: string) {
    const role = await this.findById(id);

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    const createdBy = await this.resolveCreatedBy(userId);
    if (createdBy !== 'admin' && role.createdByUserId !== userId) {
      throw new ForbiddenException('You do not own this role');
    }

    const [, err] = await tryit(
      this.db.delete(groupTable).where(eq(groupTable.id, id)),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');
  }

  private async findById(id: string) {
    const [role, err] = await tryit(
      this.db.query.groupTable.findFirst({
        where: eq(groupTable.id, id),
        with: {
          groupPermissions: { with: { permission: true } },
          userGroups: true,
        },
      }),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');
    if (!role) throw new NotFoundException('Role not found');

    return {
      id: role.id,
      slug: role.slug,
      title: role.title,
      createdBy: role.createdBy,
      createdByUserId: role.createdByUserId,
      createdAt: role.createdAt,
      isSystem: role.createdBy === 'constant',
      memberCount: role.userGroups.length,
      permissions: role.groupPermissions.map((gp) => ({
        id: gp.permission.id,
        name: gp.permission.name,
        action: gp.permission.action,
        subject: gp.permission.subject,
      })),
    };
  }
}
