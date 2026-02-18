import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MediaDto {
  @IsString()
  url: string;

  @IsString()
  type: 'photo' | 'video';

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}

export class CreatePostDto {
  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaDto)
  media: MediaDto[];
}
