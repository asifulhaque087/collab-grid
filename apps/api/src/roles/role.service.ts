import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { tryit } from '@collab-grid/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import {
  roleTable,
  rolePermissionTable,
  permissionsTable,
  userTable,
} from '@/schemas';
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

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');
    return perms ?? [];
  }

  async findAll(userId: string) {
    const [userRow, userErr] = await tryit(
      this.db
        .select({ parentId: userTable.parentId })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1)
        .then((res) => res[0]),
    );
    if (userErr)
      throw new InternalServerErrorException('An unexpected error occurred');
    const scopeUserId = userRow?.parentId ?? userId;

    const [roles, err] = await tryit(
      this.db.query.roleTable.findMany({
        where: eq(roleTable.primaryUserId, scopeUserId),
        with: {
          rolePermissions: { with: { permission: true } },
          userRoles: true,
        },
      }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');

    return (roles ?? []).map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      primaryUserId: r.primaryUserId,
      memberCount: r.userRoles.length,
      permissions: r.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        action: rp.permission.action,
        subject: rp.permission.subject,
      })),
    }));
  }

  async create(dto: CreateRoleDto, userId: string) {
    const slug = toSlug(dto.name);

    const [userRow, userErr] = await tryit(
      this.db
        .select({ parentId: userTable.parentId })
        .from(userTable)
        .where(eq(userTable.id, userId)),
    );
    if (userErr)
      throw new InternalServerErrorException('An unexpected error occurred');
    const primaryUserId = userRow?.[0]?.parentId ?? userId;

    const [role, txErr] = await tryit(
      this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(roleTable)
          .values({
            slug,
            title: dto.name,
            primaryUserId,
            secondaryUserId: userId,
          })
          .returning();

        if (dto.permissionIds.length > 0) {
          await tx.insert(rolePermissionTable).values(
            dto.permissionIds.map((permissionId) => ({
              roleId: created.id,
              permissionId,
            })),
          );
        }

        return created;
      }),
    );

    if (txErr || !role)
      throw new InternalServerErrorException('An unexpected error occurred');

    return this.findById(role.id);
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findById(id);

    const [, txErr] = await tryit(
      this.db.transaction(async (tx) => {
        if (dto.name) {
          await tx
            .update(roleTable)
            .set({ title: dto.name })
            .where(eq(roleTable.id, id));
        }

        if (dto.permissionIds !== undefined) {
          await tx
            .delete(rolePermissionTable)
            .where(eq(rolePermissionTable.roleId, id));

          if (dto.permissionIds.length > 0) {
            await tx.insert(rolePermissionTable).values(
              dto.permissionIds.map((permissionId) => ({
                roleId: id,
                permissionId,
              })),
            );
          }
        }
      }),
    );

    if (txErr)
      throw new InternalServerErrorException('An unexpected error occurred');

    return this.findById(id);
  }

  async remove(id: string) {
    const [, err] = await tryit(
      this.db.delete(roleTable).where(eq(roleTable.id, id)),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');
  }

  private async findById(id: string) {
    const [role, err] = await tryit(
      this.db.query.roleTable.findFirst({
        where: eq(roleTable.id, id),
        with: {
          rolePermissions: { with: { permission: true } },
          userRoles: true,
        },
      }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');
    if (!role) throw new NotFoundException('Role not found');

    return {
      id: role.id,
      slug: role.slug,
      title: role.title,
      primaryUserId: role.primaryUserId,
      secondaryUserId: role.secondaryUserId,
      memberCount: role.userRoles.length,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        action: rp.permission.action,
        subject: rp.permission.subject,
      })),
    };
  }
}
