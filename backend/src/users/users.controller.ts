import {
  Controller,
  Get,
  Patch,
  Post,
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
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AppGateway } from '../gateway/app.gateway';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly gateway: AppGateway,
  ) {}

  /**
   * Текущий пользователь (как GET /auth/me). Должен быть до GET /:id.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Request() req: { user: { id: string } }) {
    return this.usersService.getMeProfile(req.user.id);
  }

  /**
   * Обновление своего профиля (avatarUrl, bio). Должен быть до GET /:id.
   */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @Body() dto: UpdateProfileDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.usersService.updateMe(req.user.id, dto);
  }

  /**
   * Предложения подписаться: пользователи, на которых подписаны ваши подписки; иначе топ по подписчикам.
   */
  @Get('suggestions')
  @UseGuards(JwtAuthGuard)
  getSuggestions(
    @Request() req: { user: { id: string } },
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const limitClamped = Math.min(Math.max(limitNum, 1), 50);
    return this.usersService.getSuggestions(req.user.id, limitClamped);
  }

  /**
   * Подписаться на пользователя.
   */
  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  follow(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.usersService.follow(req.user.id, id);
  }

  /**
   * Отписаться от пользователя.
   */
  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  unfollow(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.usersService.unfollow(req.user.id, id);
  }

  /**
   * Список подписчиков пользователя.
   */
  @Get(':id/followers')
  getFollowers(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe('1'), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe('20'), ParseIntPipe) limit: number,
  ) {
    const limitClamped = Math.min(Math.max(limit, 1), 100);
    return this.usersService.getFollowers(id, page, limitClamped);
  }

  /**
   * Список подписок пользователя.
   */
  @Get(':id/following')
  getFollowing(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe('1'), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe('20'), ParseIntPipe) limit: number,
  ) {
    const limitClamped = Math.min(Math.max(limit, 1), 100);
    return this.usersService.getFollowing(id, page, limitClamped);
  }

  /**
   * Публичный профиль пользователя. Без токена — без isFollowing/isViewer.
   * С токеном — добавляются isFollowing и isViewer.
   */
  @Get(':id/online')
  @UseGuards(JwtAuthGuard)
  getOnlineStatus(@Param('id') id: string) {
    return { userId: id, online: this.gateway.isUserOnline(id) };
  }

  @Post(':id/block')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  blockUser(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.usersService.blockUser(req.user.id, id);
  }

  @Delete(':id/block')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  unblockUser(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.usersService.unblockUser(req.user.id, id);
  }

  @Get('me/blocked')
  @UseGuards(JwtAuthGuard)
  getBlockedUsers(@Request() req: { user: { id: string } }) {
    return this.usersService.getBlockedUsers(req.user.id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  getById(
    @Param('id') id: string,
    @Request() req: { user?: { id: string } },
  ) {
    return this.usersService.getById(id, req.user?.id);
  }
}
