import {
  IsEmail, IsString, IsEnum, IsOptional, IsDateString,
} from 'class-validator';
import { Genre, Categorie } from '@prisma/client';

export class CreateJoueurDto {
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

  @IsOptional()
  @IsEnum(Categorie)
  categorie?: Categorie;
}
