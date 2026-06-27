import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { tryit } from '@collab-grid/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import {
  boardTable,
  orderItemTable,
  orderTable,
  smartWidgetTable,
} from '@/schemas';
import { RealtimeService } from '@/realtime/realtime.service';
import { RealtimeGateway } from '@/realtime/realtime.gateway';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrderService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly realtime: RealtimeService,
    private readonly gateway: RealtimeGateway,
  ) {}

  async create(dto: CreateOrderDto): Promise<{ orderId: string; duplicate: boolean }> {
    // Idempotency: a repeated submit with the same key returns the original
    // order instead of creating/charging a second one.
    const [existing] = await this.db
      .select({ id: orderTable.id })
      .from(orderTable)
      .where(eq(orderTable.idempotencyKey, dto.idempotencyKey));
    if (existing) return { orderId: existing.id, duplicate: true };

    const [board] = await this.db
      .select({ id: boardTable.id })
      .from(boardTable)
      .where(eq(boardTable.id, dto.boardId));
    if (!board) throw new NotFoundException('Board not found.');

    // Load the widgets being purchased and verify the buyer actually holds a
    // live lock on each (enforces ownership + the 5-minute window).
    const widgets = await this.db
      .select()
      .from(smartWidgetTable)
      .where(
        and(
          eq(smartWidgetTable.boardId, dto.boardId),
          inArray(smartWidgetTable.id, dto.widgetIds),
        ),
      );
    if (widgets.length !== dto.widgetIds.length) {
      throw new BadRequestException('Some items are no longer available.');
    }
    for (const widget of widgets) {
      const held = await this.realtime.userHoldsLock(
        dto.boardId,
        widget.id,
        dto.buyerUserId,
      );
      if (!held) {
        throw new BadRequestException(
          'Reservation expired — please lock the items again.',
        );
      }
    }

    // Server-side total (never trust a client-sent amount).
    const total = widgets.reduce((sum, w) => sum + Number(w.price ?? 0), 0);

    const [order, err] = await tryit(
      this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(orderTable)
          .values({
            idempotencyKey: dto.idempotencyKey,
            boardId: dto.boardId,
            buyerUserId: dto.buyerUserId,
            buyerName: dto.buyerName,
            email: dto.email,
            phone: dto.phone,
            address: dto.address,
            city: dto.city,
            postalCode: dto.postalCode,
            country: dto.country,
            amountTotal: total.toFixed(2),
            paymentMethod: 'card',
            cardLast4: dto.cardLast4,
            status: 'paid',
          })
          .returning();

        await tx.insert(orderItemTable).values(
          widgets.map((w) => ({
            orderId: created.id,
            widgetId: w.id,
            name: w.name,
            sku: w.sku,
            price: Number(w.price ?? 0).toFixed(2),
            quantity: w.quantity,
          })),
        );
        return created;
      }),
    );

    // A unique-violation here means a concurrent request used the same key —
    // treat it as the duplicate it is.
    if (err) {
      const [dup] = await this.db
        .select({ id: orderTable.id })
        .from(orderTable)
        .where(eq(orderTable.idempotencyKey, dto.idempotencyKey));
      if (dup) return { orderId: dup.id, duplicate: true };
      throw new InternalServerErrorException('Failed to create order.');
    }

    // Payment captured — finalize the purchase: remove the sold widgets, clear
    // their locks, and broadcast widget:purchased to everyone on the board.
    await this.gateway.completePurchase(
      dto.boardId,
      dto.widgetIds,
      dto.buyerUserId,
    );

    return { orderId: order.id, duplicate: false };
  }

  async findOne(id: string) {
    const order = await this.db.query.orderTable.findFirst({
      where: eq(orderTable.id, id),
      with: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }
}
