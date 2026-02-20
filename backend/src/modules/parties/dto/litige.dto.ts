import { IsString, IsOptional } from 'class-validator';

export class LitigeDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
