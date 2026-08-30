import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { tryit } from '@loot-board/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import { packageTable, subscriptionTable } from '@/schemas';
import { FREE_PACKAGE_SLUG } from '@/auth/rbac.constants';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

const PACKAGE_MONTHLY_PRICE: Record<string, number> = {
  free: 0,
};

function addMonths(base: Date, months: number): Date {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

@Injectable()
export class SubscriptionService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(userId: string) {
    const [subscriptions, err] = await tryit(
      this.db.query.subscriptionTable.findMany({
        where: eq(subscriptionTable.userId, userId),
        with: { package: true },
        orderBy: desc(subscriptionTable.startDate),
      }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');

    return (subscriptions ?? []).map((s) => ({
      id: s.id,
      packageId: s.packageId,
      packageTitle: s.package.title,
      packageSlug: s.package.slug,
      startDate: s.startDate,
      endDate: s.endDate,
      paymentMethod: s.paymentMethod,
      amount: s.amount,
    }));
  }

  async subscribe(dto: CreateSubscriptionDto, userId: string) {
    const [pkg, pkgErr] = await tryit(
      this.db.query.packageTable.findFirst({
        where: eq(packageTable.slug, dto.packageSlug),
      }),
    );

    if (pkgErr)
      throw new InternalServerErrorException('An unexpected error occurred');
    if (!pkg) throw new NotFoundException('Package not found');

    if (pkg.slug === FREE_PACKAGE_SLUG) {
      const [existing] = await tryit(
        this.db
          .select({ id: subscriptionTable.id })
          .from(subscriptionTable)
          .where(
            and(
              eq(subscriptionTable.userId, userId),
              eq(subscriptionTable.packageId, pkg.id),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]),
      );

      if (existing) {
        throw new BadRequestException(
          'You are already subscribed to the Free package',
        );
      }
    }

    const now = new Date();
    const newExpiry = addMonths(now, dto.durationMonth);
    const monthlyPrice = PACKAGE_MONTHLY_PRICE[dto.packageSlug] ?? 0;
    const amount = (monthlyPrice * dto.durationMonth).toFixed(2);

    const [subscription, txErr] = await tryit(
      this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(subscriptionTable)
          .values({
            userId,
            packageId: pkg.id,
            startDate: now,
            endDate: newExpiry,
            paymentMethod: 'manual',
            amount,
          })
          .returning();

        return created;
      }),
    );

    if (txErr || !subscription)
      throw new InternalServerErrorException('An unexpected error occurred');

    return subscription;
  }
}
