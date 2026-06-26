import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { tryit } from '@collab-grid/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import { boardTable, userTable } from '@/schemas';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

@Injectable()
export class BoardService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // Boards belong to the tenant. For tenant sub-users (parentId set), the
  // board ownership rolls up to the parent tenant.
  private async resolveTenantId(userId: string): Promise<string> {
    const [rows, err] = await tryit(
      this.db
        .select({ parentId: userTable.parentId })
        .from(userTable)
        .where(eq(userTable.id, userId)),
    );

    if (err || !rows?.length) {
      throw new InternalServerErrorException('Failed to resolve user record.');
    }

    return rows[0].parentId ?? userId;
  }

  // Generates a slug from the name, appending a short suffix on collision so
  // shareable board URLs stay unique.
  private async uniqueSlug(name: string): Promise<string> {
    const base = toSlug(name) || 'board';
    let slug = base;

    for (let i = 0; i < 5; i++) {
      const [existing, err] = await tryit(
        this.db
          .select({ id: boardTable.id })
          .from(boardTable)
          .where(eq(boardTable.slug, slug)),
      );

      if (err) throw new InternalServerErrorException('An unexpected error occurred');
      if (!existing?.length) return slug;

      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    return `${base}-${Date.now().toString(36)}`;
  }

  async findAll(userId: string) {
    const tenantId = await this.resolveTenantId(userId);

    const [boards, err] = await tryit(
      this.db.query.boardTable.findMany({
        where: eq(boardTable.tenantId, tenantId),
        with: { smartWidgets: { columns: { id: true } } },
        orderBy: (b, { desc }) => [desc(b.createdAt)],
      }),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');

    return (boards ?? []).map((b) => this.serialize(b));
  }

  async create(dto: CreateBoardDto, userId: string) {
    const tenantId = await this.resolveTenantId(userId);
    const slug = await this.uniqueSlug(dto.name);

    const [board, err] = await tryit(
      this.db
        .insert(boardTable)
        .values({
          tenantId,
          name: dto.name,
          slug,
          access: dto.access,
          maxWidth: dto.maxWidth ?? 10000,
          maxHeight: dto.maxHeight ?? 10000,
        })
        .returning(),
    );

    if (err || !board?.[0]) throw new InternalServerErrorException('An unexpected error occurred');

    return this.findById(board[0].id, userId);
  }

  async update(id: string, dto: UpdateBoardDto, userId: string) {
    await this.findById(id, userId);

    const [, err] = await tryit(
      this.db
        .update(boardTable)
        .set({
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.access !== undefined ? { access: dto.access } : {}),
          ...(dto.maxWidth !== undefined ? { maxWidth: dto.maxWidth } : {}),
          ...(dto.maxHeight !== undefined ? { maxHeight: dto.maxHeight } : {}),
          updatedAt: new Date(),
        })
        .where(eq(boardTable.id, id)),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');

    return this.findById(id, userId);
  }

  async remove(id: string, userId: string) {
    await this.findById(id, userId);

    const [, err] = await tryit(
      this.db.delete(boardTable).where(eq(boardTable.id, id)),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');
  }

  // Resolves a board by its shareable slug. The canvas editor loads a board by
  // slug (the URL), so it needs the board id to scope inventory + new widgets.
  async findBySlug(slug: string, userId: string) {
    const tenantId = await this.resolveTenantId(userId);

    const [board, err] = await tryit(
      this.db.query.boardTable.findFirst({
        where: and(eq(boardTable.slug, slug), eq(boardTable.tenantId, tenantId)),
        with: { smartWidgets: { columns: { id: true } } },
      }),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');
    if (!board) throw new NotFoundException('Board not found');

    return this.serialize(board);
  }

  // Resolves a board for the public end-user route. No auth/tenant scope — only
  // published (access: 'public') boards are returned; everything else 404s so a
  // restricted board's slug can't be opened anonymously.
  async findPublicBySlug(slug: string) {
    const [board, err] = await tryit(
      this.db.query.boardTable.findFirst({
        where: eq(boardTable.slug, slug),
        with: { smartWidgets: { columns: { id: true } } },
      }),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');
    if (!board || board.access !== 'public') {
      throw new NotFoundException('Board not found or not published');
    }

    return this.serialize(board);
  }

  private async findById(id: string, userId: string) {
    const tenantId = await this.resolveTenantId(userId);

    const [board, err] = await tryit(
      this.db.query.boardTable.findFirst({
        where: and(eq(boardTable.id, id), eq(boardTable.tenantId, tenantId)),
        with: { smartWidgets: { columns: { id: true } } },
      }),
    );

    if (err) throw new InternalServerErrorException('An unexpected error occurred');
    if (!board) throw new NotFoundException('Board not found');

    return this.serialize(board);
  }

  private serialize(board: {
    id: string;
    slug: string;
    name: string;
    access: 'restricted' | 'public';
    maxWidth: number | null;
    maxHeight: number | null;
    createdAt: Date;
    smartWidgets: { id: string }[];
  }) {
    return {
      id: board.id,
      slug: board.slug,
      name: board.name,
      access: board.access,
      maxWidth: board.maxWidth,
      maxHeight: board.maxHeight,
      createdAt: board.createdAt,
      widgetCount: board.smartWidgets.length,
    };
  }
}
