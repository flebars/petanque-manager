import {
  IsString, IsEnum, IsInt, IsOptional, IsDateString, IsBoolean, Min, Max,
} from 'class-validator';
import { FormatConcours, TypeEquipe, ModeConstitution } from '@prisma/client';

export class CreateConcoursDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  lieu?: string;

  @IsEnum(FormatConcours)
  format: FormatConcours;

  @IsEnum(TypeEquipe)
  typeEquipe: TypeEquipe;

  @IsEnum(ModeConstitution)
  modeConstitution: ModeConstitution;

  @IsInt()
  @Min(1)
  nbTerrains: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  maxParticipants?: number;

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  nbTours?: number;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(5)
  taillePoule?: number;

  @IsOptional()
  @IsBoolean()
  consolante?: boolean;
}
