import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { tryit } from '@loot-board/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import { boardTable, smartWidgetTable } from '@/schemas';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

const DEFAULT_WIDGET_SIZE = 190;

interface ParsedCsvRow {
  name: string;
  sku: string;
  price?: string;
  quantity: number;
  photo: string;
}

@Injectable()
export class InventoryService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private async assertBoardOwned(
    boardId: string,
    tenantId: string,
  ): Promise<void> {
    const [rows, err] = await tryit(
      this.db
        .select({ id: boardTable.id })
        .from(boardTable)
        .where(
          and(
            eq(boardTable.id, boardId),
            eq(boardTable.primaryUserId, tenantId),
          ),
        ),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');
    if (!rows?.length) throw new NotFoundException('Board not found');
  }

  async findAll(userId: string, boardId?: string, parentId?: string | null) {
    const primaryUserId = parentId ?? userId;

    const where = boardId
      ? and(
          eq(smartWidgetTable.primaryUserId, primaryUserId),
          eq(smartWidgetTable.boardId, boardId),
        )
      : eq(smartWidgetTable.primaryUserId, primaryUserId);

    const [items, err] = await tryit(
      this.db.query.smartWidgetTable.findMany({
        where,
        with: { board: { columns: { id: true, name: true } } },
        orderBy: (w, { desc }) => [desc(w.createdAt)],
      }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');

    return (items ?? []).map((i) => this.serialize(i));
  }

  async create(
    dto: CreateInventoryDto,
    userId: string,
    parentId: string | null,
  ) {
    const primaryUserId = parentId ?? userId;

    if (dto.boardId) await this.assertBoardOwned(dto.boardId, primaryUserId);

    const [rows, err] = await tryit(
      this.db
        .insert(smartWidgetTable)
        .values({
          primaryUserId,
          secondaryUserId: userId,
          boardId: dto.boardId ?? null,
          name: dto.name,
          sku: dto.sku,
          quantity: dto.quantity,
          price: dto.price ?? null,
          photo: dto.photo ?? null,
          width: dto.width ?? DEFAULT_WIDGET_SIZE,
          height: dto.height ?? DEFAULT_WIDGET_SIZE,
        })
        .returning(),
    );

    if (err || !rows?.[0])
      throw new InternalServerErrorException('An unexpected error occurred');

    return this.findById(rows[0].id, primaryUserId);
  }

  async update(
    id: string,
    dto: UpdateInventoryDto,
    userId: string,
    parentId: string | null,
  ) {
    const primaryUserId = parentId ?? userId;
    await this.findById(id, primaryUserId);

    if (dto.boardId) await this.assertBoardOwned(dto.boardId, primaryUserId);

    const [, err] = await tryit(
      this.db
        .update(smartWidgetTable)
        .set({
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
          ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          ...(dto.photo !== undefined ? { photo: dto.photo } : {}),
          ...(dto.boardId !== undefined ? { boardId: dto.boardId } : {}),
          ...(dto.width !== undefined ? { width: dto.width } : {}),
          ...(dto.height !== undefined ? { height: dto.height } : {}),
          updatedAt: new Date(),
        })
        .where(eq(smartWidgetTable.id, id)),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');

    return this.findById(id, primaryUserId);
  }

  async remove(id: string, userId: string, parentId: string | null) {
    const primaryUserId = parentId ?? userId;
    await this.findById(id, primaryUserId);

    const [, err] = await tryit(
      this.db.delete(smartWidgetTable).where(eq(smartWidgetTable.id, id)),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');
  }

  async importCsv(
    buffer: Buffer,
    userId: string,
    parentId: string | null,
    boardId?: string,
  ) {
    const primaryUserId = parentId ?? userId;
    if (boardId) await this.assertBoardOwned(boardId, primaryUserId);

    const rows = this.parseCsv(buffer.toString('utf-8'));
    if (rows.length === 0) {
      throw new BadRequestException('CSV file has no valid rows.');
    }

    const [inserted, err] = await tryit(
      this.db
        .insert(smartWidgetTable)
        .values(
          rows.map((row) => ({
            primaryUserId,
            secondaryUserId: userId,
            boardId: boardId ?? null,
            name: row.name,
            sku: row.sku,
            quantity: row.quantity,
            price: row.price ?? null,
            photo: row.photo,
            width: DEFAULT_WIDGET_SIZE,
            height: DEFAULT_WIDGET_SIZE,
          })),
        )
        .returning({ id: smartWidgetTable.id }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');

    return { imported: inserted?.length ?? 0 };
  }

  private parseCsv(content: string): ParsedCsvRow[] {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return [];

    const first = lines[0].toLowerCase();
    const startIdx = first.includes('sku') || first.includes('name') ? 1 : 0;

    const rows: ParsedCsvRow[] = [];
    for (const line of lines.slice(startIdx)) {
      const cells = line.split(',').map((c) => c.trim());
      const [name, sku, price, quantity, photo] = cells;
      if (!name || !sku) continue;

      const qty = Number.parseInt(quantity ?? '', 10);
      rows.push({
        name,
        sku,
        price: price && !Number.isNaN(Number(price)) ? price : undefined,
        quantity: Number.isNaN(qty) ? 0 : qty,
        photo: photo,
      });
    }

    return rows;
  }

  private async findById(id: string, primaryUserId: string) {
    const [item, err] = await tryit(
      this.db.query.smartWidgetTable.findFirst({
        where: and(
          eq(smartWidgetTable.id, id),
          eq(smartWidgetTable.primaryUserId, primaryUserId),
        ),
        with: { board: { columns: { id: true, name: true } } },
      }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');
    if (!item) throw new NotFoundException('Inventory item not found');

    return this.serialize(item);
  }

  private serialize(item: {
    id: string;
    sku: string;
    name: string;
    quantity: number;
    price: string | null;
    photo: string | null;
    posX: string | null;
    posY: string | null;
    width: number;
    height: number;
    createdAt: Date;
    board: { id: string; name: string } | null;
  }) {
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      photo: item.photo,
      posX: item.posX,
      posY: item.posY,
      width: item.width,
      height: item.height,
      boardId: item.board?.id ?? null,
      boardName: item.board?.name ?? null,
      createdAt: item.createdAt,
    };
  }
}
