import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class GenerateImageDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  n?: number;

  @IsOptional()
  @IsString()
  aspect_ratio?: string; // e.g. "1:1", "16:9", "9:16"

  /** If provided — edit/style-transfer an existing image */
  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  response_format?: string; // "url" | "b64_json"
}
