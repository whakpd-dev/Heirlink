import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UploadService, UploadType } from './upload.service';
import { BadRequestException } from '@nestjs/common';

describe('UploadService', () => {
  let service: UploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const env: Record<string, string> = {
                UPLOAD_DIR: '/tmp/test-uploads',
                PUBLIC_URL: 'https://api.test.com',
              };
              return env[key] ?? null;
            },
          },
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  describe('validateFile', () => {
    it('should accept valid image MIME types', () => {
      expect(() =>
        service.validateFile('image/jpeg', 1024 * 1024, 'posts' as UploadType),
      ).not.toThrow();
    });

    it('should accept valid video MIME types', () => {
      expect(() =>
        service.validateFile('video/mp4', 10 * 1024 * 1024, 'posts' as UploadType),
      ).not.toThrow();
    });

    it('should reject oversized files', () => {
      expect(() =>
        service.validateFile('image/jpeg', 100 * 1024 * 1024, 'posts' as UploadType),
      ).toThrow(BadRequestException);
    });

    it('should reject invalid MIME types', () => {
      expect(() =>
        service.validateFile('application/pdf', 1024, 'posts' as UploadType),
      ).toThrow(BadRequestException);
    });

    it('should validate magic bytes when buffer is provided', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x00, 0x00, 0x00]);
      expect(() =>
        service.validateFile('image/jpeg', 1024, 'posts' as UploadType, jpegBuffer),
      ).not.toThrow();
    });

    it('should reject mismatched magic bytes', () => {
      const badBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(() =>
        service.validateFile('image/jpeg', 1024, 'posts' as UploadType, badBuffer),
      ).toThrow(BadRequestException);
    });
  });
});
