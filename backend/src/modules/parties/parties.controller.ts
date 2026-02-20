import {
  Controller, Get, Post, Patch, Param, Body, UseGuards, Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PartiesService } from './parties.service';
import { SaisirScoreDto } from './dto/saisir-score.dto';
import { LitigeDto } from './dto/litige.dto';
import { Partie } from '@prisma/client';

@Controller('parties')
@UseGuards(AuthGuard('jwt'))
export class PartiesController {
  constructor(private partiesService: PartiesService) {}

  @Get()
  findByConcours(@Query('concoursId') concoursId: string): Promise<Partie[]> {
    return this.partiesService.findByConcours(concoursId);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Partie> {
    return this.partiesService.findOne(id);
  }

  @Post(':id/demarrer')
  demarrer(@Param('id') id: string): Promise<Partie> {
    return this.partiesService.demarrer(id);
  }

  @Patch(':id/score')
  saisirScore(@Param('id') id: string, @Body() dto: SaisirScoreDto): Promise<Partie> {
    return this.partiesService.saisirScore(id, dto);
  }

  @Post(':id/forfait/:equipeId')
  forfaitAvantMatch(
    @Param('id') id: string,
    @Param('equipeId') equipeId: string,
  ): Promise<Partie> {
    return this.partiesService.forfaitAvantMatch(id, equipeId);
  }

  @Post(':id/forfait-encours')
  forfaitEnCours(@Param('id') id: string): Promise<Partie> {
    return this.partiesService.forfaitEnCours(id);
  }

  @Post(':id/litige')
  signalerLitige(@Param('id') id: string, @Body() dto: LitigeDto): Promise<Partie> {
    return this.partiesService.signalerLitige(id, dto);
  }

  @Patch(':id/litige/resoudre')
  resoudreLitige(@Param('id') id: string, @Body() dto: SaisirScoreDto): Promise<Partie> {
    return this.partiesService.resoudreLitige(id, dto);
  }

  @Post('concours/:concoursId/tour/:tour/lancer')
  lancerTourMelee(
    @Param('concoursId') concoursId: string,
    @Param('tour') tour: string,
  ): Promise<Partie[]> {
    return this.partiesService.lancerTourMelee(concoursId, parseInt(tour, 10));
  }
}
