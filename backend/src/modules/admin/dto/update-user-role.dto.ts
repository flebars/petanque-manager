import { IsEnum, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserRoleDto {
  @IsEnum(Role)
  newRole: Role;

  @IsString()
  @MinLength(6)
  password: string;
}
