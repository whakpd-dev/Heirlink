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
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AlbumsService } from './albums.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Controller('albums')
@UseGuards(JwtAuthGuard)
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateAlbumDto) {
    return this.albumsService.create(req.user.id, dto);
  }

  @Get('my')
  getMyAlbums(@Req() req: any) {
    return this.albumsService.findMyAlbums(req.user.id);
  }

  @Get('user/:userId')
  getUserAlbums(@Param('userId') userId: string, @Req() req: any) {
    return this.albumsService.findUserAlbums(userId, req.user.id);
  }

  @Get(':id')
  getAlbum(@Param('id') id: string, @Req() req: any) {
    return this.albumsService.findOne(id, req.user.id);
  }

  @Get(':id/items')
  getItems(
    @Param('id') id: string,
    @Req() req: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.albumsService.getItems(id, req.user.id, cursor, limit ? parseInt(limit, 10) : 20);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Req() req: any, @Body() dto: UpdateAlbumDto) {
    return this.albumsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.albumsService.remove(id, req.user.id);
  }

  @Post(':id/items')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  addItem(
    @Param('id') id: string,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption?: string,
  ) {
    return this.albumsService.addItem(id, req.user.id, file, caption);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: any,
  ) {
    return this.albumsService.removeItem(id, itemId, req.user.id);
  }

  @Get(':id/members')
  getMembers(@Param('id') id: string, @Req() req: any) {
    return this.albumsService.getMembers(id, req.user.id);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Req() req: any, @Body() dto: AddMemberDto) {
    return this.albumsService.addMember(id, req.user.id, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.albumsService.removeMember(id, userId, req.user.id);
  }
}
