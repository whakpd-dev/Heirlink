import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;
}
