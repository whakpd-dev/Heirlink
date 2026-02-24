import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @Transform(({ value }) => {
    const parsed = value !== undefined && value !== '' ? Number(value) : 3000;
    return Number.isNaN(parsed) ? 3000 : parsed;
  })
  @IsNumber()
  @Min(1)
  PORT?: number = 3000;

  @IsOptional()
  @Transform(({ value }) => value ?? 'development')
  @IsString()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string = 'development';

  @IsOptional()
  @IsString()
  UPLOAD_DIR?: string;

  @IsOptional()
  @IsString()
  PUBLIC_URL?: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  @IsOptional()
  @IsString()
  AI_SERVICE_URL?: string;
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((err) => {
        const constraints = err.constraints
          ? Object.values(err.constraints).join(', ')
          : 'invalid';
        return `${err.property}: ${constraints}`;
      })
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validatedConfig as unknown as Record<string, unknown>;
}
