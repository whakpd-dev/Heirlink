import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  HttpExceptionFilter,
  AllExceptionsFilter,
} from './common/filters/http-exception.filter';
import { randomUUID } from 'crypto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter(), new AllExceptionsFilter());

  const logger = new Logger('HTTP');
  app.use((req, res, next) => {
    const start = Date.now();
    const requestId = randomUUID();
    res.setHeader('x-request-id', requestId);
    res.on('finish', () => {
      const ms = Date.now() - start;
      logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms rid=${requestId}`,
      );
    });
    next();
  });

  const isProduction = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: process.env.FRONTEND_URL || (isProduction ? false : '*'),
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('HeirLink API')
    .setDescription('Social photo/video platform with AI features')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Backend server running on http://localhost:${port}/api`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
