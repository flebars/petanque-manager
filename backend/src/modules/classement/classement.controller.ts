import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ClassementService } from './classement.service';
import { Classement } from '@prisma/client';

@Controller('classement')
export class ClassementController {
  constructor(private classementService: ClassementService) {}

  @Get('concours/:concoursId')
  findByConcours(@Param('concoursId') concoursId: string): Promise<Classement[]> {
    return this.classementService.findByConcours(concoursId);
  }
}
