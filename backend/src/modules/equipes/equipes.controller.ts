import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EquipesService } from './equipes.service';
import { CreateEquipeDto } from './dto/create-equipe.dto';
import { UpdateStatutEquipeDto } from './dto/update-statut-equipe.dto';
import { Equipe } from '@prisma/client';

@Controller('equipes')
@UseGuards(AuthGuard('jwt'))
export class EquipesController {
  constructor(private equipesService: EquipesService) {}

  @Get('concours/:concoursId')
  findByConcours(@Param('concoursId') concoursId: string): Promise<Equipe[]> {
    return this.equipesService.findByConcours(concoursId);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Equipe> {
    return this.equipesService.findOne(id);
  }

  @Post()
  inscrire(@Body() dto: CreateEquipeDto): Promise<Equipe> {
    return this.equipesService.inscrire(dto);
  }

  @Patch(':id/statut')
  updateStatut(@Param('id') id: string, @Body() dto: UpdateStatutEquipeDto): Promise<Equipe> {
    return this.equipesService.updateStatut(id, dto);
  }

  @Post(':id/forfait')
  forfait(@Param('id') id: string): Promise<Equipe> {
    return this.equipesService.forfait(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.equipesService.remove(id);
  }
}
