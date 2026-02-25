import { IsOptional, IsString, IsUrl, IsBoolean, MaxLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'displayName must be at most 50 characters' })
  displayName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,30}$/, {
    message: 'Username can only contain latin letters, numbers and underscores (3-30 chars)',
  })
  username?: string;

  @IsOptional()
  @IsUrl({}, { message: 'avatarUrl must be a valid URL' })
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'bio must be at most 150 characters' })
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'website must be at most 100 characters' })
  website?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
