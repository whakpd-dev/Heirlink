import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

export type UploadType = 'posts' | 'avatars' | 'stories';

@Injectable()
export class UploadService {
  private readonly uploadDir: string;
  private readonly baseUrl: string;
  private readonly s3: S3Client | null;
  private readonly s3Bucket: string | null;
  private readonly s3PublicUrl: string | null;

  constructor(private config: ConfigService) {
    this.uploadDir = this.config.get<string>('UPLOAD_DIR') ?? path.join(process.cwd(), 'upload');
    const publicUrl = this.config.get<string>('PUBLIC_URL') ?? 'http://localhost:3000';
    this.baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
    const bucket = this.config.get<string>('S3_BUCKET') ?? null;
    const region = this.config.get<string>('S3_REGION') ?? null;
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID') ?? null;
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY') ?? null;
    const endpoint = this.config.get<string>('S3_ENDPOINT') ?? undefined;
    this.s3Bucket = bucket;
    this.s3PublicUrl = this.config.get<string>('S3_PUBLIC_URL') ?? null;
    if (bucket && region && accessKeyId && secretAccessKey) {
      this.s3 = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
        endpoint,
        forcePathStyle: !!endpoint,
      });
    } else {
      this.s3 = null;
    }
  }

  getUploadPath(relativePath: string): string {
    return path.join(this.uploadDir, relativePath);
  }

  getPublicUrl(relativePath: string): string {
    if (this.s3Bucket) {
      const base =
        this.s3PublicUrl ??
        `https://${this.s3Bucket}.s3.${this.config.get<string>('S3_REGION')}.amazonaws.com`;
      return `${base.replace(/\/$/, '')}/${relativePath.replace(path.sep, '/')}`;
    }
    return `${this.baseUrl}/api/uploads/${relativePath.replace(path.sep, '/')}`;
  }

  validateFile(mimetype: string, size: number, type: UploadType): void {
    const allowed = type === 'avatars' ? ALLOWED_IMAGE_MIMES : [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES];
    if (!allowed.includes(mimetype)) {
      throw new BadRequestException(`Invalid file type. Allowed: ${allowed.join(', ')}`);
    }
    const maxSize = ALLOWED_VIDEO_MIMES.includes(mimetype) ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (size > maxSize) {
      throw new BadRequestException(`File too large. Max size: ${maxSize / 1024 / 1024} MB`);
    }
  }

  async saveFile(
    file: Express.Multer.File,
    type: UploadType,
  ): Promise<{ url: string; relativePath: string; mimetype: string }> {
    const ext = path.extname(file.originalname) || this.getExtFromMime(file.mimetype);
    const filename = `${randomUUID()}${ext}`;
    const relPath = path.join(type, filename);
    const fullPath = path.join(this.uploadDir, relPath);

    const dir = path.dirname(fullPath);
    const buffer = file.buffer ?? (file as any).buffer;
    if (!buffer && !(file as any).path) {
      throw new BadRequestException('Invalid file data');
    }

    if (this.s3 && this.s3Bucket) {
      const key = relPath.replace(path.sep, '/');
      const body = buffer ?? fs.readFileSync((file as any).path);
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
          Body: body,
          ContentType: file.mimetype,
        }),
      );
    } else {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (buffer) {
        fs.writeFileSync(fullPath, buffer);
      } else if ((file as any).path && fs.existsSync((file as any).path)) {
        fs.renameSync((file as any).path, fullPath);
      }
    }

    const url = this.getPublicUrl(relPath);
    return { url, relativePath: relPath, mimetype: file.mimetype };
  }

  private getExtFromMime(mimetype: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
    };
    return map[mimetype] ?? '.bin';
  }

  streamPath(relativePath: string): string {
    const full = path.join(this.uploadDir, relativePath);
    if (!path.normalize(full).startsWith(path.normalize(this.uploadDir))) {
      throw new BadRequestException('Invalid path');
    }
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return '';
    }
    return full;
  }
}
