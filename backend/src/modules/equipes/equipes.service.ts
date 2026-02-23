import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateEquipeDto } from './dto/create-equipe.dto';
import { UpdateStatutEquipeDto } from './dto/update-statut-equipe.dto';
import { Equipe, StatutConcours, StatutEquipe, Role } from '@prisma/client';
import type { JwtPayload } from '@/modules/auth/strategies/jwt.strategy';

@Injectable()
export class EquipesService {
  constructor(private prisma: PrismaService) {}

  async findByConcours(concoursId: string): Promise<Equipe[]> {
    const concours = await this.prisma.concours.findUnique({
      where: { id: concoursId },
      select: { modeConstitution: true },
    });

    return this.prisma.equipe.findMany({
      where: {
        concoursId,
        tour: concours?.modeConstitution === 'MELEE_DEMELEE' ? null : undefined,
      },
      include: { joueurs: { include: { joueur: true } } },
      orderBy: { numeroTirage: 'asc' },
    });
  }

  async findOne(id: string): Promise<Equipe> {
    const equipe = await this.prisma.equipe.findUnique({
      where: { id },
      include: { joueurs: { include: { joueur: true } }, concours: true },
    });
    if (!equipe) throw new NotFoundException(`Équipe ${id} introuvable`);
    return equipe;
  }

  async inscrire(dto: CreateEquipeDto, user: JwtPayload): Promise<Equipe> {
    const concours = await this.prisma.concours.findUnique({
      where: { id: dto.concoursId },
      include: { equipes: true },
    });
    if (!concours) throw new NotFoundException('Concours introuvable');
    
    const canRegisterLate = user.role === Role.SUPER_ADMIN || user.role === Role.ORGANISATEUR;
    
    if (concours.statut === StatutConcours.TERMINE) {
      throw new BadRequestException('Le concours est terminé');
    }
    if (concours.statut !== StatutConcours.INSCRIPTION && !canRegisterLate) {
      throw new BadRequestException('Les inscriptions sont fermées');
    }
    if (concours.maxParticipants && concours.equipes.length >= concours.maxParticipants) {
      throw new ConflictException('Nombre maximum de participants atteint');
    }

    for (const joueurId of dto.joueurIds) {
      const already = await this.prisma.equipeJoueur.findFirst({
        where: { joueurId, equipe: { concoursId: dto.concoursId } },
      });
      if (already) {
        throw new ConflictException(`Le joueur ${joueurId} est déjà inscrit à ce concours`);
      }
    }

    const maxTirage = await this.prisma.equipe.aggregate({
      where: { concoursId: dto.concoursId },
      _max: { numeroTirage: true },
    });
    const numeroTirage = (maxTirage._max.numeroTirage ?? 0) + 1;

    return this.prisma.equipe.create({
      data: {
        concoursId: dto.concoursId,
        nom: dto.nom,
        numeroTirage,
        statut: concours.statut === StatutConcours.EN_COURS ? StatutEquipe.PRESENTE : StatutEquipe.INSCRITE,
        joueurs: {
          create: dto.joueurIds.map((joueurId) => ({ joueurId })),
        },
      },
      include: { joueurs: { include: { joueur: true } } },
    });
  }

  async updateStatut(id: string, dto: UpdateStatutEquipeDto): Promise<Equipe> {
    await this.findOne(id);
    return this.prisma.equipe.update({
      where: { id },
      data: { statut: dto.statut },
      include: { joueurs: { include: { joueur: true } } },
    });
  }

  async remove(id: string): Promise<void> {
    const equipe = await this.findOne(id);
    const concours = await this.prisma.concours.findUnique({
      where: { id: equipe.concoursId },
    });
    if (concours?.statut !== StatutConcours.INSCRIPTION) {
      throw new BadRequestException('Impossible de désinscrire après le démarrage');
    }
    await this.prisma.equipe.delete({ where: { id } });
  }

  async forfait(id: string): Promise<Equipe> {
    return this.updateStatut(id, { statut: StatutEquipe.FORFAIT });
  }
}
