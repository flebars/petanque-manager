import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsDateString,
  IsBoolean,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsEmail,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FormatConcours, TypeEquipe, ModeConstitution, Genre, Categorie } from '@prisma/client';

export class ImportPlayerDto {
  @IsEmail()
  email: string;

  @IsString()
  nom: string;

  @IsString()
  prenom: string;

  @IsEnum(Genre)
  genre: Genre;

  @IsOptional()
  @IsDateString()
  dateNaissance?: string;

  @IsOptional()
  @IsString()
  licenceFfpjp?: string;

  @IsOptional()
  @IsString()
  club?: string;

  @IsEnum(Categorie)
  categorie: Categorie;
}

export class ImportTeamDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  playerEmails: string[];
}

export class TournamentParamsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
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

export class ImportTournamentConfigDto {
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
  @ValidateNested()
  @Type(() => TournamentParamsDto)
  params?: TournamentParamsDto;
}

export class ImportConcoursDto {
  @IsString()
  version: string;

  @IsOptional()
  @IsDateString()
  exportedAt?: string;

  @ValidateNested()
  @Type(() => ImportTournamentConfigDto)
  tournament: ImportTournamentConfigDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportPlayerDto)
  players: ImportPlayerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTeamDto)
  teams?: ImportTeamDto[];
}
