import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService, UploadType } from './upload.service';
import * as path from 'path';
import * as fs from 'fs';

const UPLOAD_TYPES: UploadType[] = ['posts', 'avatars', 'stories', 'albums'];

@Controller()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('type') typeQuery?: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }
    const type: UploadType = (typeQuery as UploadType) ?? 'posts';
    if (!UPLOAD_TYPES.includes(type)) {
      throw new BadRequestException(`Invalid type. Allowed: ${UPLOAD_TYPES.join(', ')}`);
    }
    this.uploadService.validateFile(file.mimetype, file.size, type, file.buffer);
    return this.uploadService.saveFile(file, type);
  }

  @Get('uploads/:type/:filename')
  serve(
    @Param('type') type: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    if (!UPLOAD_TYPES.includes(type as UploadType)) {
      throw new BadRequestException('Invalid type');
    }
    if (filename.includes('..') || filename.includes(path.sep)) {
      throw new BadRequestException('Invalid filename');
    }
    const relativePath = path.join(type, filename);
    const fullPath = this.uploadService.streamPath(relativePath);
    if (!fullPath || !fs.existsSync(fullPath)) {
      res.status(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    res.sendFile(fullPath);
  }
}
