import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateStoryDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.storiesService.create(req.user.id, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyStories(@Request() req: { user: { id: string } }) {
    return this.storiesService.getMyStories(req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getFeed(@Request() req: { user: { id: string } }) {
    return this.storiesService.getFeed(req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    await this.storiesService.remove(id, req.user.id);
  }
}
