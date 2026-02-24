import { IsString, MinLength } from 'class-validator';

export class ClearDataDto {
  @IsString()
  confirmText: string;

  @IsString()
  @MinLength(6)
  password: string;
}
