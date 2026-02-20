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
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPostDto: CreatePostDto, @Request() req) {
    return this.postsService.create(req.user.id, createPostDto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Request() req?: { user?: { id: string } },
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.postsService.findAll(pageNum, limitNum, req?.user?.id, cursor);
  }

  @Get('saved')
  @UseGuards(JwtAuthGuard)
  getSaved(
    @Request() req: { user: { id: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.postsService.getSavedPosts(req.user.id, pageNum, limitNum, cursor);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  getFeed(
    @Request() req: { user: { id: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.postsService.findFeed(req.user.id, pageNum, limitNum, cursor);
  }

  @Get('user/:userId')
  findByUser(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 30;
    return this.postsService.findByUser(userId, pageNum, limitNum, cursor);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @Request() req: { user?: { id: string } },
  ) {
    return this.postsService.findOne(id, req.user?.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdatePostDto, @Request() req: { user: { id: string } }) {
    return this.postsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req) {
    return this.postsService.delete(id, req.user.id);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  like(@Param('id') id: string, @Request() req) {
    return this.postsService.like(id, req.user.id);
  }

  @Post(':id/save')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  save(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.postsService.save(id, req.user.id);
  }

  @Delete(':id/save')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  unsave(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.postsService.unsave(id, req.user.id);
  }
}
