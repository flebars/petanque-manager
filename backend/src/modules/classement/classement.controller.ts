import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ClassementService } from './classement.service';
import { Classement, ClassementJoueur } from '@prisma/client';

@Controller('classement')
export class ClassementController {
  constructor(private classementService: ClassementService) {}

  @Get('concours/:concoursId')
  findByConcours(@Param('concoursId') concoursId: string): Promise<Classement[] | ClassementJoueur[]> {
    return this.classementService.findByConcours(concoursId);
  }
}
