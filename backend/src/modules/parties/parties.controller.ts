import {
  Controller, Get, Post, Patch, Param, Body, UseGuards, Query, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PartiesService } from './parties.service';
import { SaisirScoreDto } from './dto/saisir-score.dto';
import { LitigeDto } from './dto/litige.dto';
import { Partie, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtPayload } from '@/modules/auth/strategies/jwt.strategy';
import { PrismaService } from '@/prisma/prisma.service';

@Controller('parties')
@UseGuards(AuthGuard('jwt'))
export class PartiesController {
  constructor(
    private partiesService: PartiesService,
    private prisma: PrismaService,
  ) {}

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

  @Post('concours/:concoursId/tour/:tour/lancer-coupe')
  async lancerTourCoupe(
    @Param('concoursId') concoursId: string,
    @Param('tour') tour: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<Partie[]> {
    const concours = await this.prisma.concours.findUnique({
      where: { id: concoursId },
    });

    if (!concours) {
      throw new NotFoundException('Concours introuvable');
    }

    if (concours.organisateurId !== user.sub && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Seul l\'organisateur peut lancer un tour');
    }

    return this.partiesService.lancerTourCoupe(concoursId, parseInt(tour, 10));
  }

  @Post('concours/:concoursId/lancer-poules')
  async lancerPoules(
    @Param('concoursId') concoursId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    const concours = await this.prisma.concours.findUnique({
      where: { id: concoursId },
    });

    if (!concours) {
      throw new NotFoundException('Concours introuvable');
    }

    if (concours.organisateurId !== user.sub && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Seul l\'organisateur peut lancer les poules');
    }

    return this.partiesService.lancerPoules(concoursId);
  }

  @Post('concours/:concoursId/lancer-phase-finale')
  async lancerPhaseFinale(
    @Param('concoursId') concoursId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<Partie[]> {
    const concours = await this.prisma.concours.findUnique({
      where: { id: concoursId },
    });

    if (!concours) {
      throw new NotFoundException('Concours introuvable');
    }

    if (concours.organisateurId !== user.sub && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Seul l\'organisateur peut lancer la phase finale');
    }

    return this.partiesService.lancerPhaseFinale(concoursId);
  }
}
