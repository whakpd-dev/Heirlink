import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  notifyLikes?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyComments?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyFollows?: boolean;
}
