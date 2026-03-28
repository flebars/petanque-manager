import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PartiesService } from './parties.service';
import { SaisirScoreDto } from './dto/saisir-score.dto';
import { LitigeDto } from './dto/litige.dto';
import { Partie, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { JwtPayload } from '@/modules/auth/strategies/jwt.strategy';
import { PrismaService } from '@/prisma/prisma.service';

@Controller('parties')
@UseGuards(AuthGuard('jwt'), RolesGuard)
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
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR, Role.ARBITRE)
  demarrer(@Param('id') id: string): Promise<Partie> {
    return this.partiesService.demarrer(id);
  }

  @Patch(':id/score')
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR, Role.ARBITRE)
  saisirScore(@Param('id') id: string, @Body() dto: SaisirScoreDto): Promise<Partie> {
    return this.partiesService.saisirScore(id, dto);
  }

  @Patch(':id/modifier-score')
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR, Role.ARBITRE)
  modifierScore(
    @Param('id') id: string,
    @Body() dto: SaisirScoreDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<Partie> {
    return this.partiesService.modifierScore(id, dto, user);
  }

  @Post(':id/forfait/:equipeId')
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR, Role.ARBITRE)
  forfaitAvantMatch(
    @Param('id') id: string,
    @Param('equipeId') equipeId: string,
  ): Promise<Partie> {
    return this.partiesService.forfaitAvantMatch(id, equipeId);
  }

  @Post(':id/forfait-encours')
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR, Role.ARBITRE)
  forfaitEnCours(@Param('id') id: string): Promise<Partie> {
    return this.partiesService.forfaitEnCours(id);
  }

  @Post(':id/litige')
  signalerLitige(@Param('id') id: string, @Body() dto: LitigeDto): Promise<Partie> {
    return this.partiesService.signalerLitige(id, dto);
  }

  @Patch(':id/litige/resoudre')
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR, Role.ARBITRE)
  resoudreLitige(@Param('id') id: string, @Body() dto: SaisirScoreDto): Promise<Partie> {
    return this.partiesService.resoudreLitige(id, dto);
  }

  @Post('concours/:concoursId/tour/:tour/lancer')
  async lancerTourMelee(
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
