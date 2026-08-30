import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { tryit } from '@loot-board/common';
import { DRIZZLE, DrizzleDB } from '@/drizzle/drizzle.module';
import { boardTable } from '@/schemas';
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

      if (err)
        throw new InternalServerErrorException('An unexpected error occurred');
      if (!existing?.length) return slug;

      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    return `${base}-${Date.now().toString(36)}`;
  }

  async findAll(userId: string, parentId: string | null) {
    const primaryUserId = parentId ?? userId;

    const [boards, err] = await tryit(
      this.db.query.boardTable.findMany({
        where: eq(boardTable.primaryUserId, primaryUserId),
        with: { smartWidgets: { columns: { id: true } } },
        orderBy: (b, { desc }) => [desc(b.createdAt)],
      }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');

    return (boards ?? []).map((b) => this.serialize(b));
  }

  async create(dto: CreateBoardDto, userId: string, parentId: string | null) {
    const primaryUserId = parentId ?? userId;
    const slug = await this.uniqueSlug(dto.name);

    const [board, err] = await tryit(
      this.db
        .insert(boardTable)
        .values({
          primaryUserId,
          secondaryUserId: userId,
          name: dto.name,
          slug,
          access: dto.access,
          maxWidth: dto.maxWidth ?? 10000,
          maxHeight: dto.maxHeight ?? 10000,
        })
        .returning(),
    );

    if (err || !board?.[0])
      throw new InternalServerErrorException('An unexpected error occurred');

    return this.findById(board[0].id, primaryUserId);
  }

  async update(
    id: string,
    dto: UpdateBoardDto,
    userId: string,
    parentId: string | null,
  ) {
    const primaryUserId = parentId ?? userId;
    await this.findById(id, primaryUserId);

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

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');

    return this.findById(id, primaryUserId);
  }

  async remove(id: string, userId: string, parentId: string | null) {
    const primaryUserId = parentId ?? userId;
    await this.findById(id, primaryUserId);

    const [, err] = await tryit(
      this.db.delete(boardTable).where(eq(boardTable.id, id)),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');
  }

  async findBySlug(slug: string, userId: string, parentId: string | null) {
    const primaryUserId = parentId ?? userId;

    const [board, err] = await tryit(
      this.db.query.boardTable.findFirst({
        where: and(
          eq(boardTable.slug, slug),
          eq(boardTable.primaryUserId, primaryUserId),
        ),
        with: { smartWidgets: { columns: { id: true } } },
      }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');
    if (!board) throw new NotFoundException('Board not found');

    return this.serialize(board);
  }

  async findPublicBySlug(slug: string) {
    const [board, err] = await tryit(
      this.db.query.boardTable.findFirst({
        where: eq(boardTable.slug, slug),
        with: { smartWidgets: { columns: { id: true } } },
      }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');
    if (!board || board.access !== 'public') {
      throw new NotFoundException('Board not found or not published');
    }

    return this.serialize(board);
  }

  private async findById(id: string, primaryUserId: string) {
    const [board, err] = await tryit(
      this.db.query.boardTable.findFirst({
        where: and(
          eq(boardTable.id, id),
          eq(boardTable.primaryUserId, primaryUserId),
        ),
        with: { smartWidgets: { columns: { id: true } } },
      }),
    );

    if (err)
      throw new InternalServerErrorException('An unexpected error occurred');
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
