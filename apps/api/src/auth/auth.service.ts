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
import { eq, or } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import {
  groupPermissionTable,
  // groupPermissionTable,
  groupTable,
  permissionsTable,
  userGroupTable,
  userPlanSnapshotTable,
  userTable,
} from '@/schemas';
import type { Action, PermissionTuple, Subjects } from '@/auth/permissions';
import { ValidateSocialUserDto } from '@/auth/dto/validate-social-user.dto';
import { RefreshAccessTokenDto } from '@/auth/dto/refresh-access-token.dto';
import { RegisterUserDto } from '@/auth/dto/register-user.dto';
import { LoginUserDto } from '@/auth/dto/login-user.dto';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { FREE_PLAN_SLUG, TENANT_ROLE_SLUG } from '@/auth/rbac.constants';
import { AuthTokens } from '@/auth/auth.types';
import { MailService } from '@/mail/mail.service';

const SALT_ROUNDS = 10;

const RESET_TOKEN_BYTES = 32;

export function hashResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export const UNLIMITED_QUOTA = -1;

export function buildQuotaRows(
  userId: string,
  planPerms: {
    groupId: string;
    permissionId: string;
    totalOperation: number | null;
    permission: {
      id: string;
      name: string;
      description: string | null;
      action: string;
      subject: string;
    };
  }[],
): {
  userId: string;
  action: string;
  subject: string;
  granted: number | null;
  remaining: number | null;
  extra: number;
}[] {
  return planPerms.map((perm) => {
    // const amount = parseQuotaValue(perm.totalOperation);

    return {
      userId,
      action: perm.permission.action,
      subject: perm.permission.subject,
      granted: perm.totalOperation,
      remaining: perm.totalOperation,
      extra: 0,
    };
  });
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  private async resolveSignupDefaults() {
    const [freePlan, planErr] = await tryit(
      this.db
        .select()
        .from(groupTable)
        .where(eq(groupTable.slug, FREE_PLAN_SLUG))
        .limit(1)
        .then((res) => res[0]),
    );

    const [tenantRole, roleErr] = await tryit(
      this.db
        .select()
        .from(groupTable)
        .where(eq(groupTable.slug, TENANT_ROLE_SLUG))
        .limit(1)
        .then((res) => res[0]),
    );

    if (planErr || roleErr) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    if (!freePlan || !tenantRole) {
      throw new InternalServerErrorException(
        'Default plan or role is missing — run the database seed',
      );
    }

    const [planPerms, permsErr] = await tryit(
      this.db.query.groupPermissionTable.findMany({
        // where: eq(groupPermissionTable.groupId, freePlan.id),
        where: or(
          eq(groupPermissionTable.groupId, freePlan.id),
          eq(groupPermissionTable.groupId, tenantRole.id),
        ),
        with: {
          permission: true,
        },
      }),
    );

    // const [planPerms, permsErr] = await tryit(
    //   this.db
    //     .select()
    //     .from(groupPermissionTable)
    //     .where(eq(groupPermissionTable.groupId, freePlan.id)),
    // );

    if (permsErr || !planPerms) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    return { freePlan, tenantRole, planPerms };
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
    const { freePlan, tenantRole, planPerms } = defaults;

    const [user, txErr] = await tryit(
      this.db.transaction(async (tx) => {
        const created = await tx
          .insert(userTable)
          .values({ ...values, plan: freePlan.title })
          .returning()
          .then((res) => res[0]);

        await tx
          .insert(userGroupTable)
          .values({ userId: created.id, groupId: tenantRole.id });

        const quotaRows = buildQuotaRows(created.id, planPerms);

        if (quotaRows.length > 0) {
          await tx.insert(userPlanSnapshotTable).values(quotaRows);
        }

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

    // let user: typeof userTable.$inferSelect;
    let user = existing;

    if (!user) {
      const defaults = await this.resolveSignupDefaults();
      user = await this.createUserWithFreePlan(
        { name: data.username, email: data.email, provider: data.provider },
        defaults,
      );
    }

    // user = existing;

    const [tokens, tokensErr] = await tryit(
      this.generateTokens(user.id, user.email),
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
    // Reject a duplicate email up front for a clean 409.
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
      this.generateTokens(user.id, user.email),
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
      this.generateTokens(user.id, user.email),
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

    // No such account, or an OAuth-only user with no password to reset — stop
    // silently so the response can't be used to probe for registered emails.
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

  async getAccessContext(userId: string): Promise<{
    roles: string[];
    permissions: PermissionTuple[];
    // quotas: (typeof userPlanSnapshotTable.$inferSelect)[];
    quotas: Omit<typeof userPlanSnapshotTable.$inferSelect, 'userId'>[];
  }> {
    const [rolePerms, rolePermsErr] = await tryit(
      this.db
        .select({
          roleId: groupTable.id,
          roleSlug: groupTable.slug,
          roleTitle: groupTable.title,

          action: permissionsTable.action,
          subject: permissionsTable.subject,
          totalOperation: groupPermissionTable.totalOperation,
        })
        .from(userGroupTable)
        .innerJoin(groupTable, eq(userGroupTable.groupId, groupTable.id))
        .innerJoin(
          groupPermissionTable,
          eq(userGroupTable.groupId, groupPermissionTable.groupId),
        )
        .innerJoin(
          permissionsTable,
          eq(groupPermissionTable.permissionId, permissionsTable.id),
        )
        .where(eq(userGroupTable.userId, userId)),
    );

    // Directly map the database response into two flat arrays
    const rolesList = rolePerms ? rolePerms.map((row) => row.roleTitle) : [];

    const permissionsList = rolePerms
      ? rolePerms.map((row) => ({
          action: row.action as Action,
          subject: row.subject as Subjects,
        }))
      : [];

    const [snapshotRows, snapshotErr] = await tryit(
      this.db
        .select({
          id: userPlanSnapshotTable.id,
          action: userPlanSnapshotTable.action,
          subject: userPlanSnapshotTable.subject,
          granted: userPlanSnapshotTable.granted,
          remaining: userPlanSnapshotTable.remaining,
          extra: userPlanSnapshotTable.extra,
        })
        .from(userPlanSnapshotTable)
        .where(eq(userPlanSnapshotTable.userId, userId)),
    );

    if (rolePermsErr || snapshotErr) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    return {
      roles: rolesList,
      permissions: permissionsList,
      quotas: snapshotRows,
    };
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
      this.generateTokens(user.id, user.email),
    );

    if (tokensErr || !tokens) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    return {
      newAccessToken: tokens.accessToken,
      newRefreshToken: tokens.refreshToken,
    };
  }

  async generateTokens(id: string, email: string): Promise<AuthTokens> {
    const payload = { id, email };

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

  getCookieSettings(accessToken: string, refreshToken: string) {
    const accessTokenExp = this.configService.getOrThrow<string>(
      'ACCESS_TOKEN_EXPIRATION',
    );
    const refreshTokenExp = this.configService.getOrThrow<string>(
      'REFRESH_TOKEN_EXPIRATION',
    );

    return {
      access: {
        name: 'accessToken',
        value: accessToken,
        options: {
          httpOnly: true,
          secure: false,
          maxAge: ms(accessTokenExp as ms.StringValue),
        },
      },
      refresh: {
        name: 'refreshToken',
        value: refreshToken,
        options: {
          httpOnly: true,
          secure: false,
          maxAge: ms(refreshTokenExp as ms.StringValue),
        },
      },
    };
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
