import { IsString, IsOptional, IsDateString, IsInt, Min } from 'class-validator';

export class UpdateConcoursDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  nbTerrains?: number;
}
