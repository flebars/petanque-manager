import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { Genre, Role } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  nom: string;

  @IsString()
  prenom: string;

  @IsEnum(Genre)
  genre: Genre;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
