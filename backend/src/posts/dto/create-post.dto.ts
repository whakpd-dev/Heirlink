import { IsString, IsOptional, IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class MediaDto {
  @IsString()
  url!: string;

  @IsString()
  @IsIn(['photo', 'video'])
  type!: 'photo' | 'video';

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  mentionedUserIds?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MediaDto)
  media!: MediaDto[];
}
