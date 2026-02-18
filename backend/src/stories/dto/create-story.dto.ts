import { IsString, IsIn, IsUrl } from 'class-validator';

export class CreateStoryDto {
  @IsUrl()
  mediaUrl: string;

  @IsString()
  @IsIn(['photo', 'video'], { message: 'type must be photo or video' })
  type: 'photo' | 'video';
}
