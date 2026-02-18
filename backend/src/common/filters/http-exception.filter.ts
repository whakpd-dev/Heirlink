import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

function getMessage(exception: HttpException): string {
  const res = exception.getResponse();
  if (typeof res === 'string') return res;
  const body = res as Record<string, unknown>;
  const msg = body.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string') return msg;
  return exception.message;
}

/**
 * Единый формат ответа об ошибке для HTTP-исключений.
 * В production не раскрываем stack и лишние детали.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const errorResponse = {
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message: getMessage(exception),
    };

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} ${status}`, exception.stack);
    }

    response.status(status).json(errorResponse);
  }
}

/**
 * Перехват необработанных исключений (Prisma, TypeError и т.д.).
 * Возвращаем 500 без раскрытия внутренних деталей в production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const errorResponse = {
        statusCode: status,
        error: HttpStatus[status] ?? 'Error',
        message: getMessage(exception),
      };
      if (status >= 500) {
        this.logger.error(`${request.method} ${request.url} ${status}`, exception.stack);
      }
      response.status(status).json(errorResponse);
      return;
    }

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    this.logger.error(
      `${request.method} ${request.url} ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json({
      statusCode: status,
      error: 'Internal Server Error',
      message,
    });
  }
}
