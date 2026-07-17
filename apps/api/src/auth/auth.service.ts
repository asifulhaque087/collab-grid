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
import { eq } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import {
  permissionsTable,
  roleTable,
  rolePermissionTable,
  userRoleTable,
  packageTable,
  subscriptionTable,
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
import { AuthTokens, JwtPayload } from '@/auth/auth.types';
import { MailService } from '@/mail/mail.service';

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
      this.generateTokens(user.id, user.email, user.parentId),
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
      this.generateTokens(user.id, user.email, user.parentId),
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
      this.generateTokens(user.id, user.email, user.parentId),
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

  async getAccessContext(userId: string): Promise<{
    roles: string[];
    permissions: PermissionTuple[];
  }> {
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

    return {
      roles: rolesList,
      permissions: [...deduped.values()],
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
      this.generateTokens(user.id, user.email, user.parentId),
    );

    if (tokensErr || !tokens) {
      throw new InternalServerErrorException('An unexpected error occurred');
    }

    return {
      newAccessToken: tokens.accessToken,
      newRefreshToken: tokens.refreshToken,
    };
  }

  async generateTokens(id: string, email: string, parentId: string | null): Promise<AuthTokens> {
    const payload: JwtPayload = { id, email, parentId };

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
