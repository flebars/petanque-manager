import { IsEnum } from 'class-validator';
import { StatutEquipe } from '@prisma/client';

export class UpdateStatutEquipeDto {
  @IsEnum(StatutEquipe)
  statut: StatutEquipe;
}
