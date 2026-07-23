import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { tryit } from '@collab-grid/common';
import bcrypt from 'bcryptjs';
import ms from 'ms';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import {
  permissionsTable,
  roleTable,
  rolePermissionTable,
  userRoleTable,
  packageTable,
  packagePermissionLimitTable,
  subscriptionTable,
  limitUsageTable,
  userTable,
} from '@/schemas';
import type { Action, PermissionTuple, Subjects } from '@/auth/permissions';
import { ValidateSocialUserDto } from '@/auth/dto/validate-social-user.dto';
import { RefreshAccessTokenDto } from '@/auth/dto/refresh-access-token.dto';
import { RegisterUserDto } from '@/auth/dto/register-user.dto';
import { LoginUserDto } from '@/auth/dto/login-user.dto';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { FREE_PACKAGE_SLUG, TENANT_ROLE_SLUG } from '@/auth/rbac.constants';
import { AuthTokens, JwtPayload, type Quota } from '@/auth/auth.types';
import { MailService } from '@/mail/mail.service';
import { REDIS } from '@/realtime/redis.module';

const SALT_ROUNDS = 10;

const RESET_TOKEN_BYTES = 32;

export function hashResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private async resolveSignupDefaults() {
    const [freePackage, pkgErr] = await tryit(
      this.db
        .select()
        .from(packageTable)
        .where(eq(packageTable.slug, FREE_PACKAGE_SLUG))
        .limit(1)
        .then((res) => res[0]),
    );

    const [tenantRole, roleErr] = await tryit(
      this.db
        .select()
        .from(roleTable)
        .where(eq(roleTable.slug, TENANT_ROLE_SLUG))
        .limit(1)
        .then((res) => res[0]),
    );

    if (pkgErr || roleErr) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    if (!freePackage || !tenantRole) {
      throw new InternalServerErrorException(
        'Default package or role is missing — run the database seed',
      );
    }

    return { freePackage, tenantRole };
  }

  private async createUserWithFreePlan(
    values: {
      name: string;
      email: string;
      provider: string;
      password?: string;
    },
    defaults: Awaited<ReturnType<AuthService['resolveSignupDefaults']>>,
  ) {
    const { freePackage, tenantRole } = defaults;

    const [user, txErr] = await tryit(
      this.db.transaction(async (tx) => {
        const created = await tx
          .insert(userTable)
          .values(values)
          .returning()
          .then((res) => res[0]);

        await tx
          .insert(userRoleTable)
          .values({ userId: created.id, roleId: tenantRole.id });

        await tx.insert(subscriptionTable).values({
          userId: created.id,
          packageId: freePackage.id,
          startDate: new Date(),
          endDate: null,
          paymentMethod: 'manual',
          amount: '0',
        });

        return created;
      }),
    );

    if (txErr || !user) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    return user;
  }

  async validateSocialUser(data: ValidateSocialUserDto) {
    const [existing, existingErr] = await tryit(
      this.db
        .select()
        .from(userTable)
        .where(eq(userTable.email, data.email))
        .limit(1)
        .then((res) => res[0]),
    );

    if (existingErr) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    let user = existing;

    if (!user) {
      const defaults = await this.resolveSignupDefaults();
      user = await this.createUserWithFreePlan(
        { name: data.username, email: data.email, provider: data.provider },
        defaults,
      );
    }

    const [tokens, tokensErr] = await tryit(
      this.generateTokens(
        user.id,
        user.email,
        user.primaryUserId,
        user.secondaryUserId,
      ),
    );

    if (tokensErr || !tokens) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    return {
      ...user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async registerUser(dto: RegisterUserDto) {
    const [existing, existingErr] = await tryit(
      this.db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.email, dto.email))
        .limit(1)
        .then((res) => res[0]),
    );

    if (existingErr) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const defaults = await this.resolveSignupDefaults();
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.createUserWithFreePlan(
      {
        name: dto.name,
        email: dto.email,
        password: passwordHash,
        provider: 'credentials',
      },
      defaults,
    );

    const [tokens, tokensErr] = await tryit(
      this.generateTokens(
        user.id,
        user.email,
        user.primaryUserId,
        user.secondaryUserId,
      ),
    );

    if (tokensErr || !tokens) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    return {
      ...user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async loginUser(dto: LoginUserDto) {
    const [user, userErr] = await tryit(
      this.db
        .select()
        .from(userTable)
        .where(eq(userTable.email, dto.email))
        .limit(1)
        .then((res) => res[0]),
    );

    if (userErr) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const [passwordMatches, compareErr] = await tryit(
      bcrypt.compare(dto.password, user.password),
    );

    if (compareErr) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const [tokens, tokensErr] = await tryit(
      this.generateTokens(
        user.id,
        user.email,
        user.primaryUserId,
        user.secondaryUserId,
      ),
    );

    if (tokensErr || !tokens) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    return {
      ...user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const [user, userErr] = await tryit(
      this.db
        .select()
        .from(userTable)
        .where(eq(userTable.email, dto.email))
        .limit(1)
        .then((res) => res[0]),
    );

    if (userErr) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    if (!user || !user.password) {
      return;
    }

    const rawToken = randomBytes(RESET_TOKEN_BYTES).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const expirationMs = ms(
      this.configService.getOrThrow<string>(
        'RESET_TOKEN_EXPIRATION',
      ) as ms.StringValue,
    );
    const expiresAt = new Date(Date.now() + expirationMs);

    const [, updateErr] = await tryit(
      this.db
        .update(userTable)
        .set({
          resetPasswordToken: tokenHash,
          resetPasswordExpiresAt: expiresAt,
        })
        .where(eq(userTable.id, user.id)),
    );

    if (updateErr) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    const resetUrl = `${this.configService.getOrThrow<string>(
      'RESET_PASSWORD_URL',
    )}?token=${rawToken}`;

    await this.mailService.sendPasswordResetEmail(
      user.email,
      user.name,
      resetUrl,
      Math.round(expirationMs / 60_000),
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = hashResetToken(dto.token);

    const [user, userErr] = await tryit(
      this.db
        .select()
        .from(userTable)
        .where(eq(userTable.resetPasswordToken, tokenHash))
        .limit(1)
        .then((res) => res[0]),
    );

    if (userErr) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    if (
      !user ||
      !user.resetPasswordExpiresAt ||
      user.resetPasswordExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const [, updateErr] = await tryit(
      this.db
        .update(userTable)
        .set({
          password: passwordHash,
          resetPasswordToken: null,
          resetPasswordExpiresAt: null,
          refreshToken: null,
        })
        .where(eq(userTable.id, user.id)),
    );

    if (updateErr) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async getMe(userId: string) {
    const [user, userErr] = await tryit(
      this.db
        .select()
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1)
        .then((res) => res[0]),
    );

    if (userErr) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    if (!user) {
      throw new UnauthorizedException('Unauthorized access');
    }

    return user;
  }

  // async getAccessContext(userId: string): Promise<{
  //   roles: string[];
  //   permissions: PermissionTuple[];
  // }> {
  //   const [rows, err] = await tryit(
  //     this.db
  //       .select({
  //         roleSlug: roleTable.slug,
  //         roleTitle: roleTable.title,
  //         action: permissionsTable.action,
  //         subject: permissionsTable.subject,
  //       })
  //       .from(userRoleTable)
  //       .innerJoin(roleTable, eq(userRoleTable.roleId, roleTable.id))
  //       .innerJoin(
  //         rolePermissionTable,
  //         eq(roleTable.id, rolePermissionTable.roleId),
  //       )
  //       .innerJoin(
  //         permissionsTable,
  //         eq(rolePermissionTable.permissionId, permissionsTable.id),
  //       )
  //       .where(eq(userRoleTable.userId, userId)),
  //   );

  //   if (err) {
  //     throw new InternalServerErrorException('An unexpected error occurred');
  //   }

  //   const rolesList = [...new Set(rows?.map((r) => r.roleTitle) ?? [])];

  //   const deduped = new Map<string, PermissionTuple>();
  //   for (const row of rows ?? []) {
  //     const key = `${row.action}:${row.subject}`;
  //     if (!deduped.has(key)) {
  //       deduped.set(key, {
  //         action: row.action as Action,
  //         subject: row.subject as Subjects,
  //       });
  //     }
  //   }

  //   return {
  //     roles: rolesList,
  //     permissions: [...deduped.values()],
  //   };
  // }

  async getAccessContext(userId: string): Promise<{
    roles: string[];
    permissions: PermissionTuple[];
  }> {
    const cacheKey = `user:access-context:${userId}`;
    const TTL_SECONDS = 900; // 1 hour (adjust as needed)

    // 1. Try to fetch from Redis
    try {
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (error) {
      // Graceful degradation: log the error and continue to DB if Redis fails
      console.error('Redis read error:', error);
    }

    // 2. Fetch from Database (Cache Miss)
    const [rows, err] = await tryit(
      this.db
        .select({
          roleSlug: roleTable.slug,
          roleTitle: roleTable.title,
          action: permissionsTable.action,
          subject: permissionsTable.subject,
        })
        .from(userRoleTable)
        .innerJoin(roleTable, eq(userRoleTable.roleId, roleTable.id))
        .innerJoin(
          rolePermissionTable,
          eq(roleTable.id, rolePermissionTable.roleId),
        )
        .innerJoin(
          permissionsTable,
          eq(rolePermissionTable.permissionId, permissionsTable.id),
        )
        .where(eq(userRoleTable.userId, userId)),
    );

    if (err) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    const rolesList = [...new Set(rows?.map((r) => r.roleTitle) ?? [])];

    const deduped = new Map<string, PermissionTuple>();
    for (const row of rows ?? []) {
      const key = `${row.action}:${row.subject}`;
      if (!deduped.has(key)) {
        deduped.set(key, {
          action: row.action as Action,
          subject: row.subject as Subjects,
        });
      }
    }

    const result = {
      roles: rolesList,
      permissions: [...deduped.values()],
    };

    // 3. Save to Redis with Expiration (EX)
    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', TTL_SECONDS);
    } catch (error) {
      console.error('Redis write error:', error);
    }

    return result;
  }

  async getUserQuotas(tenantId: string): Promise<{
    quotas: Quota[];
    plan: string;
  }> {
    const [rows, err] = await tryit(
      this.db
        .select({
          action: permissionsTable.action,
          subject: permissionsTable.subject,
          limit: packagePermissionLimitTable.limit,
          // SUM up usage across matching rows, defaulting to 0 if null
          totalUsed: sql<number>`COALESCE(SUM(${limitUsageTable.used}), 0)`.mapWith(Number),
        })
        .from(subscriptionTable)
        .innerJoin(
          packagePermissionLimitTable,
          eq(subscriptionTable.packageId, packagePermissionLimitTable.packageId)
        )
        .innerJoin(
          permissionsTable,
          eq(packagePermissionLimitTable.permissionId, permissionsTable.id)
        )
        // LEFT JOIN so we still return limits even if 0 usage exists yet
        .leftJoin(
          limitUsageTable,
          and(
            eq(packagePermissionLimitTable.id, limitUsageTable.packagePermissionLimitId),
            eq(limitUsageTable.userId, tenantId)
          )
        )
        .where(
          and(
            eq(subscriptionTable.userId, tenantId),
            or(
              isNull(subscriptionTable.endDate),
              gt(subscriptionTable.endDate, new Date())
            )
          )
        )
        .groupBy(
          permissionsTable.action,
          permissionsTable.subject,
          packagePermissionLimitTable.limit
        )
    );

    if (err) {
      throw new InternalServerErrorException(
        'Failed to resolve active subscriptions and quotas.'
      );
    }

    if (!rows || rows.length === 0) {
      return { quotas: [], plan: 'free' };
    }

    // Aggregate package limits if a user has multiple active plans
    const aggMap = new Map<
      string,
      { action: string; subject: string; granted: number | null; totalUsed: number }
    >();

    for (const row of rows) {
      const key = `${row.action}:${row.subject}`;
      const existing = aggMap.get(key);

      if (!existing) {
        aggMap.set(key, {
          action: row.action,
          subject: row.subject,
          granted: row.limit,
          totalUsed: row.totalUsed,
        });
      } else {
        // If any plan gives unlimited (-1 or null), mark unlimited
        if (existing.granted === null || existing.granted === -1) {
          existing.totalUsed += row.totalUsed;
        } else if (row.limit === null || row.limit === -1) {
          existing.granted = -1;
          existing.totalUsed += row.totalUsed;
        } else {
          existing.granted! += row.limit;
          existing.totalUsed += row.totalUsed;
        }
      }
    }

    const quotas: Quota[] = [];
    for (const [, agg] of aggMap) {
      const unlimited = agg.granted === null || agg.granted === -1;
      quotas.push({
        id: `${agg.action}:${agg.subject}`,
        action: agg.action,
        subject: agg.subject,
        granted: unlimited ? -1 : agg.granted!,
        remaining: unlimited ? -1 : Math.max(0, agg.granted! - agg.totalUsed),
        extra: 0,
      });
    }

    return { quotas, plan: 'active' };
  }


  async logout(userId: string): Promise<void> {
    const [, updateErr] = await tryit(
      this.db
        .update(userTable)
        .set({ refreshToken: null })
        .where(eq(userTable.id, userId)),
    );

    if (updateErr) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async refreshAccessToken(data: RefreshAccessTokenDto) {
    const [user, userErr] = await tryit(
      this.db
        .select()
        .from(userTable)
        .where(eq(userTable.refreshToken, data.token))
        .limit(1)
        .then((res) => res[0]),
    );

    if (userErr) {
      throw new InternalServerErrorException(userErr.message);
    }

    if (!user) {
      throw new UnauthorizedException('Unauthorized access');
    }

    const [tokens, tokensErr] = await tryit(
      this.generateTokens(
        user.id,
        user.email,
        user.primaryUserId,
        user.secondaryUserId,
      ),
    );

    if (tokensErr || !tokens) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    return {
      newAccessToken: tokens.accessToken,
      newRefreshToken: tokens.refreshToken,
    };
  }

  async generateTokens(
    id: string,
    email: string,
    primaryUserId: string | null,
    secondaryUserId: string | null,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { id, email, primaryUserId, secondaryUserId };

    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.getOrThrow<string>(
        'REFRESH_TOKEN_EXPIRATION',
      ) as ms.StringValue,
    });

    await tryit(
      this.db
        .update(userTable)
        .set({ refreshToken })
        .where(eq(userTable.id, id)),
    );

    return { accessToken, refreshToken };
  }

  isTokenExpired(token: string, secret: string): boolean {
    try {
      this.jwtService.verify(token, { secret, clockTolerance: 10 });
      return false;
    } catch {
      return true;
    }
  }
}
