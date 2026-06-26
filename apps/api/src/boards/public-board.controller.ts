import { Controller, Get, Param } from '@nestjs/common';
import { BoardService } from './board.service';

// Unauthenticated board access for the public end-user route (/b/[slug]).
// Kept separate from BoardController so it isn't subject to that controller's
// auth/permission/quota guards. Only published boards are returned.
@Controller('boards')
export class PublicBoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get('public/:slug')
  findPublic(@Param('slug') slug: string) {
    return this.boardService.findPublicBySlug(slug);
  }
}
