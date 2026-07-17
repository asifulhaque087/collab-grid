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
  packageTable,
  packagePermissionLimitTable,
  permissionsTable,
  roleTable,
  rolePermissionTable,
} from '@/schemas';
import { TENANT_ROLE_SLUG } from '@/auth/rbac.constants';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

const UNLIMITED_QUOTA = -1;

const PACKAGE_MONTHLY_PRICE: Record<string, number> = {
  free: 0,
};

const QUOTA_FEATURE_TEXT: Record<string, string> = {
  Board: 'boards',
  Group: 'custom roles per tenant',
  SmartWidget: 'widgets per board',
};

const QUOTA_FEATURE_ORDER = ['Board', 'Group', 'SmartWidget'];

@Injectable()
export class PackageService {
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
        .innerJoin(
          rolePermissionTable,
          eq(rolePermissionTable.permissionId, permissionsTable.id),
        )
        .innerJoin(roleTable, eq(roleTable.id, rolePermissionTable.roleId))
        .where(eq(roleTable.slug, TENANT_ROLE_SLUG))
        .orderBy(permissionsTable.subject, permissionsTable.action),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');
    return perms ?? [];
  }

  async findAll() {
    const [packages, err] = await tryit(
      this.db.query.packageTable.findMany({
        with: {
          packagePermissionLimits: { with: { permission: true } },
          subscriptions: true,
        },
      }),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');

    return (packages ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      primaryUserId: p.primaryUserId,
      secondaryUserId: p.secondaryUserId,
      isSystem: !p.primaryUserId,
      subscriberCount: p.subscriptions.length,
      permissions: p.packagePermissionLimits.map((ppl) => ({
        id: ppl.permission.id,
        name: ppl.permission.name,
        action: ppl.permission.action,
        subject: ppl.permission.subject,
        limit: ppl.limit,
      })),
    }));
  }

  async findPublicPackages() {
    const [packages, err] = await tryit(
      this.db.query.packageTable.findMany({
        with: { packagePermissionLimits: { with: { permission: true } } },
      }),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');

    return (packages ?? [])
      .map((p) => {
        const monthlyPrice = PACKAGE_MONTHLY_PRICE[p.slug] ?? 0;

        const features = p.packagePermissionLimits
          .filter(
            (ppl) =>
              ppl.limit !== null &&
              QUOTA_FEATURE_TEXT[ppl.permission.subject],
          )
          .sort(
            (a, b) =>
              QUOTA_FEATURE_ORDER.indexOf(a.permission.subject) -
              QUOTA_FEATURE_ORDER.indexOf(b.permission.subject),
          )
          .map((ppl) => ({
            value:
              ppl.limit === UNLIMITED_QUOTA
                ? 'Unlimited'
                : String(ppl.limit),
            text: QUOTA_FEATURE_TEXT[ppl.permission.subject],
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

  async create(dto: CreatePackageDto, userId: string) {
    const slug = toSlug(dto.name);

    const [pkg, txErr] = await tryit(
      this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(packageTable)
          .values({
            slug,
            title: dto.name,
            primaryUserId: userId,
            secondaryUserId: null,
          })
          .returning();

        if (dto.permissions.length > 0) {
          await tx.insert(packagePermissionLimitTable).values(
            dto.permissions.map((p) => ({
              packageId: created.id,
              permissionId: p.permissionId,
              limit: p.limit,
            })),
          );
        }

        return created;
      }),
    );

    if (txErr || !pkg) throw new InternalServerErrorException('An unexpected error occurred');

    return this.findById(pkg.id);
  }

  async update(id: string, dto: UpdatePackageDto) {
    const pkg = await this.findById(id);

    const [, txErr] = await tryit(
      this.db.transaction(async (tx) => {
        if (dto.name) {
          await tx
            .update(packageTable)
            .set(
              pkg.isSystem
                ? { title: dto.name }
                : { slug: toSlug(dto.name), title: dto.name },
            )
            .where(eq(packageTable.id, id));
        }

        if (dto.permissions !== undefined) {
          await tx
            .delete(packagePermissionLimitTable)
            .where(eq(packagePermissionLimitTable.packageId, id));

          if (dto.permissions.length > 0) {
            await tx.insert(packagePermissionLimitTable).values(
              dto.permissions.map((p) => ({
                packageId: id,
                permissionId: p.permissionId,
                limit: p.limit,
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
    const pkg = await this.findById(id);

    if (pkg.isSystem) {
      throw new ForbiddenException('System packages cannot be deleted');
    }

    const [, err] = await tryit(
      this.db.delete(packageTable).where(eq(packageTable.id, id)),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');
  }

  private async findById(id: string) {
    const [pkg, err] = await tryit(
      this.db.query.packageTable.findFirst({
        where: eq(packageTable.id, id),
        with: {
          packagePermissionLimits: { with: { permission: true } },
          subscriptions: true,
        },
      }),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');
    if (!pkg) throw new NotFoundException('Package not found');

    return {
      id: pkg.id,
      slug: pkg.slug,
      title: pkg.title,
      primaryUserId: pkg.primaryUserId,
      secondaryUserId: pkg.secondaryUserId,
      isSystem: !pkg.primaryUserId,
      subscriberCount: pkg.subscriptions.length,
      permissions: pkg.packagePermissionLimits.map((ppl) => ({
        id: ppl.permission.id,
        name: ppl.permission.name,
        action: ppl.permission.action,
        subject: ppl.permission.subject,
        limit: ppl.limit,
      })),
    };
  }
}
