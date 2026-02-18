import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @MinLength(1, { message: 'Comment text cannot be empty' })
  @MaxLength(1000, { message: 'Comment text must be at most 1000 characters' })
  text: string;
}
