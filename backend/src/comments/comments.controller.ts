import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('posts')
export class PostCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get(':postId/comments')
  findByPostId(
    @Param('postId') postId: string,
    @Query('page', new DefaultValuePipe('1'), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe('20'), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ) {
    const limitClamped = Math.min(Math.max(limit, 1), 100);
    return this.commentsService.findByPostId(postId, page, limitClamped, cursor);
  }

  @Post(':postId/comments')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.commentsService.create(postId, req.user.id, dto);
  }
}

@Controller('comments')
export class CommentController {
  constructor(private readonly commentsService: CommentsService) {}

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.commentsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    await this.commentsService.remove(id, req.user.id);
  }
}
