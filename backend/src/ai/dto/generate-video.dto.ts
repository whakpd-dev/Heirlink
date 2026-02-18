import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class GenerateVideoDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  model?: string;

  /** Image URL for image-to-video */
  @IsOptional()
  @IsString()
  image_url?: string;

  /** Video URL for video editing */
  @IsOptional()
  @IsString()
  video_url?: string;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(10)
  duration?: number;

  @IsOptional()
  @IsString()
  aspect_ratio?: string; // e.g. "16:9", "9:16", "1:1"

  @IsOptional()
  @IsString()
  resolution?: string; // e.g. "720p", "1080p"
}
