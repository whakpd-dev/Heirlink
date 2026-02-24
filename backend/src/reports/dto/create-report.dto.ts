import { IsString, IsIn, MinLength, MaxLength } from 'class-validator';

export class CreateReportDto {
  @IsString()
  @IsIn(['post', 'album_item', 'user', 'comment'])
  targetType: string;

  @IsString()
  @MinLength(1)
  targetId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
