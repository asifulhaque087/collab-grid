import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { tryit } from '@collab-grid/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import { Action, Subjects } from '@/auth/permissions';
import {
  roleTable,
  rolePermissionTable,
  userRoleTable,
  permissionsTable,
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

  // async listPermissions(userId: string) {
  //   const [userRoles, err] = await tryit(
  //     this.db.query.userRoleTable.findMany({
  //       where: eq(userRoleTable.userId, userId),
  //       with: {
  //         role: {
  //           with: {
  //             rolePermissions: {
  //               with: {
  //                 permission: true,
  //               },
  //             },
  //           },
  //         },
  //       },
  //     }),
  //   );

  //   if (err)
  //     throw new InternalServerErrorException('An unexpected error occurred');

  //   const permissions = (userRoles ?? []).flatMap(
  //     (ur) => ur.role.rolePermissions,
  //   );

  //   const hasWildcard = permissions.some(
  //     (rp) =>
  //       rp.permission.action === Action.Manage &&
  //       rp.permission.subject === Subjects.All,
  //   );

  //   if (hasWildcard) {
  //     return PERMISSION_CATALOG.filter(
  //       (p) => !(p.action === Action.Manage && p.subject === Subjects.All),
  //     )
  //       .map((p) => ({
  //         id: `${p.name} ${p.action}`,
  //         name: p.name,
  //         action: p.action,
  //         subject: p.subject,
  //         description: p.description,
  //       }))
  //       .sort(
  //         (a, b) =>
  //           a.subject.localeCompare(b.subject) ||
  //           a.action.localeCompare(b.action),
  //       );
  //   }

  //   const seen = new Set<string>();
  //   return permissions
  //     .filter((rp) => {
  //       if (seen.has(rp.permission.id)) return false;
  //       seen.add(rp.permission.id);
  //       return true;
  //     })
  //     .map((rp) => ({
  //       id: rp.permission.id,
  //       name: rp.permission.name,
  //       action: rp.permission.action,
  //       subject: rp.permission.subject,
  //       description: rp.permission.description ?? undefined,
  //     }))
  //     .sort(
  //       (a, b) =>
  //         a.subject.localeCompare(b.subject) ||
  //         a.action.localeCompare(b.action),
  //     );
  // }

  async listPermissions(userId: string) {
    const [userRoles, err] = await tryit(
      this.db.query.userRoleTable.findMany({
        where: eq(userRoleTable.userId, userId),
        with: {
          role: {
            with: {
              rolePermissions: {
                with: {
                  permission: true,
                },
              },
            },
          },
        },
      }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');

    const permissions = (userRoles ?? []).flatMap(
      (ur) => ur.role.rolePermissions,
    );

    const hasWildcard = permissions.some(
      (rp) =>
        rp.permission.action === Action.Manage &&
        rp.permission.subject === Subjects.All,
    );

    if (hasWildcard) {
      const [allPerms, permErr] = await tryit(
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

      if (permErr)
        throw new InternalServerErrorException('An unexpected error occurred');

      return (allPerms ?? [])
        .filter(
          (p) => !(p.action === Action.Manage && p.subject === Subjects.All),
        )
        .map((p) => ({
          id: p.id, // Valid ID
          name: p.name,
          action: p.action,
          subject: p.subject,
          description: p.description ?? undefined, // Unified null/undefined handling
        }));

      // return (allPerms ?? []).filter(
      //   (p) => !(p.action === Action.Manage && p.subject === Subjects.All),
      // );
    }

    const seen = new Set<string>();
    return permissions
      .filter((rp) => {
        if (seen.has(rp.permission.id)) return false;
        seen.add(rp.permission.id);
        return true;
      })
      .map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        action: rp.permission.action,
        subject: rp.permission.subject,
        description: rp.permission.description ?? undefined,
      }))
      .sort(
        (a, b) =>
          a.subject.localeCompare(b.subject) ||
          a.action.localeCompare(b.action),
      );
  }

  async findAll(userId: string, parentId: string | null) {
    const scopeUserId = parentId ?? userId;

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

  async create(dto: CreateRoleDto, userId: string, parentId: string | null) {
    const slug = toSlug(dto.name);

    const primaryUserId = parentId ?? userId;

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
