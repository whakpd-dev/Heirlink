import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import {
  HttpExceptionFilter,
  AllExceptionsFilter,
} from '../src/common/filters/http-exception.filter';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHello: () => 'HeirLink API is running!',
            getHealth: () =>
              Promise.resolve({
                status: 'ok',
                timestamp: new Date().toISOString(),
                db: 'up',
                ai: 'skipped',
              }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter(), new AllExceptionsFilter());

    await app.init();
  }, 10000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /api returns hello message', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect((res) => {
        expect(res.text).toContain('HeirLink');
      });
  });

  it('GET /api/health returns status and db', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('db');
    expect(['ok', 'degraded']).toContain(res.body.status);
    expect(['up', 'down']).toContain(res.body.db);
  });
});
