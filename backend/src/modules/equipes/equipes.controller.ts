import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EquipesService } from './equipes.service';
import { CreateEquipeDto } from './dto/create-equipe.dto';
import { UpdateStatutEquipeDto } from './dto/update-statut-equipe.dto';
import { Equipe, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { JwtPayload } from '@/modules/auth/strategies/jwt.strategy';

@Controller('equipes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
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
  inscrire(@Body() dto: CreateEquipeDto, @CurrentUser() user: JwtPayload): Promise<Equipe> {
    return this.equipesService.inscrire(dto, user);
  }

  @Patch(':id/statut')
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR, Role.ARBITRE)
  updateStatut(@Param('id') id: string, @Body() dto: UpdateStatutEquipeDto): Promise<Equipe> {
    return this.equipesService.updateStatut(id, dto);
  }

  @Post(':id/forfait')
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR, Role.ARBITRE)
  forfait(@Param('id') id: string): Promise<Equipe> {
    return this.equipesService.forfait(id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR)
  remove(@Param('id') id: string): Promise<void> {
    return this.equipesService.remove(id);
  }
}
