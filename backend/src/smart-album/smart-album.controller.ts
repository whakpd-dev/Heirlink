import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SmartAlbumService } from './smart-album.service';
import { UploadMediaDto } from './dto/upload-media.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('smart-album')
@UseGuards(JwtAuthGuard)
export class SmartAlbumController {
  constructor(private readonly smartAlbumService: SmartAlbumService) {}

  @Post('upload')
  @HttpCode(HttpStatus.ACCEPTED)
  upload(
    @Body() dto: UploadMediaDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.smartAlbumService.createJob(req.user.id, dto);
  }

  @Get('jobs/:jobId')
  getJob(
    @Param('jobId') jobId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.smartAlbumService.getJob(jobId, req.user.id);
  }

  @Get('items')
  getItems(
    @Request() req: { user: { id: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.smartAlbumService.getItems(req.user.id, pageNum, limitNum);
  }

  @Get('items/:id')
  getItem(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.smartAlbumService.getItem(id, req.user.id);
  }
}
