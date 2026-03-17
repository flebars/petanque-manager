import {
  IsEmail, IsString, IsEnum, IsOptional, IsDateString,
} from 'class-validator';
import { Genre, Categorie } from '@prisma/client';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  @IsOptional()
  @IsEnum(Genre)
  genre?: Genre;

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
