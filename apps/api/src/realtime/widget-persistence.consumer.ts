import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { tryit } from '@collab-grid/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import { smartWidgetTable } from '@/schemas';
import { RabbitmqService } from './rabbitmq.service';

// Consumes durable widget-position messages and writes the new coordinates to
// Postgres, board-scoped so a stray widgetId can't update another board's row.
@Injectable()
export class WidgetPersistenceConsumer implements OnModuleInit {
  constructor(
    private readonly rabbit: RabbitmqService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async onModuleInit() {
    await this.rabbit.consume(async (msg) => {
      await tryit(
        this.db
          .update(smartWidgetTable)
          .set({
            posX: String(msg.x),
            posY: String(msg.y),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(smartWidgetTable.id, msg.widgetId),
              eq(smartWidgetTable.boardId, msg.boardId),
            ),
          ),
      );
    });
  }
}
