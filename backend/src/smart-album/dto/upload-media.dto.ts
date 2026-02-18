import { IsString, IsOptional, IsUrl, MaxLength } from 'class-validator';

export class UploadMediaDto {
  @IsString()
  @IsUrl()
  @MaxLength(2048)
  mediaUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string; // 'analyze' | 'restore' | 'animate' — по умолчанию analyze
}
