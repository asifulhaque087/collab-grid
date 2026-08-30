import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne, or } from 'drizzle-orm';
import { tryit } from '@loot-board/common';
import bcrypt from 'bcryptjs';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import { userTable, userRoleTable } from '@/schemas';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UserService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(userId: string, primaryUserId: string | null) {
    const scopeUserId = primaryUserId ?? userId;

    const [users, err] = await tryit(
      this.db.query.userTable.findMany({
        where: and(
          ne(userTable.id, userId),
          or(
            eq(userTable.primaryUserId, scopeUserId),
            eq(userTable.id, scopeUserId),
          ),
        ),
        with: {
          userRoles: { with: { role: true } },
        },
      }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');

    return (users ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      provider: u.provider,
      roles: u.userRoles.map((ur) => ({
        id: ur.role.id,
        title: ur.role.title,
        slug: ur.role.slug,
      })),
    }));
  }

  async create(
    dto: CreateUserDto,
    userId: string,
    primaryUserId: string | null,
  ) {
    const scopeUserId = primaryUserId ?? userId;
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const [user, txErr] = await tryit(
      this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(userTable)
          .values({
            name: dto.name,
            email: dto.email,
            password: passwordHash,
            provider: 'credentials',
            primaryUserId: scopeUserId,
          })
          .returning();

        if (dto.roleIds.length > 0) {
          await tx.insert(userRoleTable).values(
            dto.roleIds.map((roleId) => ({
              userId: created.id,
              roleId,
            })),
          );
        }

        return created;
      }),
    );

    if (txErr || !user)
      throw new InternalServerErrorException('An unexpected error occurred');

    return this.findById(user.id);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);

    const updateData: Record<string, unknown> = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.email) updateData.email = dto.email;
    if (dto.password)
      updateData.password = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const [, txErr] = await tryit(
      this.db.transaction(async (tx) => {
        if (Object.keys(updateData).length > 0) {
          await tx
            .update(userTable)
            .set(updateData)
            .where(eq(userTable.id, id));
        }

        if (dto.roleIds !== undefined) {
          await tx.delete(userRoleTable).where(eq(userRoleTable.userId, id));

          if (dto.roleIds.length > 0) {
            await tx.insert(userRoleTable).values(
              dto.roleIds.map((roleId) => ({
                userId: id,
                roleId,
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
      this.db.delete(userTable).where(eq(userTable.id, id)),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');
  }

  private async findById(id: string) {
    const [user, err] = await tryit(
      this.db.query.userTable.findFirst({
        where: eq(userTable.id, id),
        with: {
          userRoles: { with: { role: true } },
        },
      }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      provider: user.provider,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        title: ur.role.title,
        slug: ur.role.slug,
      })),
    };
  }
}
