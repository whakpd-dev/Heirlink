import { IsString, IsNotEmpty, IsOptional, MaxLength, ValidateIf } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  attachmentType?: string;
}
