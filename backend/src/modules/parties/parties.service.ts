import {
  Injectable, NotFoundException, BadRequestException, Inject,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SaisirScoreDto } from './dto/saisir-score.dto';
import { LitigeDto } from './dto/litige.dto';
import { Partie, StatutPartie, StatutEquipe, TypePartie, ModeConstitution, TypeEquipe } from '@prisma/client';
import { ClassementService } from '@/modules/classement/classement.service';
import { EventsGateway } from '@/modules/gateway/events.gateway';
import { Redis } from 'ioredis';

const DRAW_LOCK_TTL = 30;

const TAILLE_EQUIPE: Record<TypeEquipe, number> = {
  TETE_A_TETE: 1,
  DOUBLETTE: 2,
  TRIPLETTE: 3,
};

@Injectable()
export class PartiesService {
  constructor(
    private prisma: PrismaService,
    private classementService: ClassementService,
    private eventsGateway: EventsGateway,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  findByConcours(concoursId: string): Promise<Partie[]> {
    return this.prisma.partie.findMany({
      where: { concoursId },
      include: {
        equipeA: { include: { joueurs: { include: { joueur: true } } } },
        equipeB: { include: { joueurs: { include: { joueur: true } } } },
        terrain: true,
      },
      orderBy: [{ tour: 'asc' }, { bracketRonde: 'asc' }, { bracketPos: 'asc' }],
    });
  }

  async findOne(id: string): Promise<Partie> {
    const partie = await this.prisma.partie.findUnique({
      where: { id },
      include: {
        equipeA: true,
        equipeB: true,
        terrain: true,
        concours: true,
      },
    });
    if (!partie) throw new NotFoundException(`Partie ${id} introuvable`);
    return partie;
  }

  async demarrer(id: string): Promise<Partie> {
    const partie = await this.findOne(id);
    if (partie.statut !== StatutPartie.A_JOUER) {
      throw new BadRequestException('La partie ne peut pas être démarrée');
    }
    return this.prisma.partie.update({
      where: { id },
      data: { statut: StatutPartie.EN_COURS, heureDebut: new Date() },
    });
  }

  async saisirScore(id: string, dto: SaisirScoreDto): Promise<Partie> {
    const partie = await this.findOne(id);
    if (
      partie.statut !== StatutPartie.EN_COURS &&
      partie.statut !== StatutPartie.A_JOUER
    ) {
      throw new BadRequestException('Score non modifiable dans cet état');
    }

    const { scoreA, scoreB } = dto;
    if (scoreA !== 13 && scoreB !== 13) {
      throw new BadRequestException('Le gagnant doit avoir exactement 13 points');
    }
    if (scoreA === 13 && scoreB === 13) {
      throw new BadRequestException('Les deux équipes ne peuvent pas avoir 13 points');
    }
    if (scoreA < 0 || scoreB < 0 || scoreA > 13 || scoreB > 13) {
      throw new BadRequestException('Score invalide');
    }

    const updated = await this.prisma.partie.update({
      where: { id },
      data: {
        scoreA,
        scoreB,
        statut: StatutPartie.TERMINEE,
        heureFin: new Date(),
      },
    });

    await this.classementService.recalculer(partie.concoursId);
    this.eventsGateway.emitScoreValide(partie.concoursId, updated);

    return updated;
  }

  async forfaitAvantMatch(id: string, equipeForFaitId: string): Promise<Partie> {
    const partie = await this.findOne(id);
    if (partie.statut !== StatutPartie.A_JOUER) {
      throw new BadRequestException('Forfait avant match impossible dans cet état');
    }

    const isEquipeA = partie.equipeAId === equipeForFaitId;
    const isEquipeB = partie.equipeBId === equipeForFaitId;
    if (!isEquipeA && !isEquipeB) {
      throw new BadRequestException('L\'équipe ne participe pas à cette partie');
    }

    const scoreA = isEquipeA ? 0 : 13;
    const scoreB = isEquipeB ? 0 : 13;

    await this.prisma.equipe.update({
      where: { id: equipeForFaitId },
      data: { statut: StatutEquipe.FORFAIT },
    });

    const updated = await this.prisma.partie.update({
      where: { id },
      data: { scoreA, scoreB, statut: StatutPartie.FORFAIT, heureFin: new Date() },
    });

    await this.classementService.recalculer(partie.concoursId);
    this.eventsGateway.emitScoreValide(partie.concoursId, updated);

    return updated;
  }

  async forfaitEnCours(id: string): Promise<Partie> {
    const partie = await this.findOne(id);
    if (partie.statut !== StatutPartie.EN_COURS) {
      throw new BadRequestException('La partie n\'est pas en cours');
    }

    const updated = await this.prisma.partie.update({
      where: { id },
      data: { statut: StatutPartie.FORFAIT, heureFin: new Date() },
    });

    await this.classementService.recalculer(partie.concoursId);
    return updated;
  }

  async signalerLitige(id: string, dto: LitigeDto): Promise<Partie> {
    const partie = await this.findOne(id);
    if (partie.statut !== StatutPartie.EN_COURS) {
      throw new BadRequestException('La partie n\'est pas en cours');
    }
    return this.prisma.partie.update({
      where: { id },
      data: { statut: StatutPartie.LITIGE, notes: dto.notes },
    });
  }

  async resoudreLitige(id: string, dto: SaisirScoreDto): Promise<Partie> {
    const partie = await this.findOne(id);
    if (partie.statut !== StatutPartie.LITIGE) {
      throw new BadRequestException('La partie n\'est pas en litige');
    }
    return this.saisirScore(id, dto);
  }

  async lancerTourMelee(concoursId: string, tour: number): Promise<Partie[]> {
    const lockKey = `draw:lock:${concoursId}:${tour}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', DRAW_LOCK_TTL, 'NX');
    if (!locked) throw new BadRequestException('Tirage déjà en cours');

    try {
      const concours = await this.prisma.concours.findUnique({
        where: { id: concoursId },
        include: {
          equipes: {
            where: { statut: { notIn: [StatutEquipe.FORFAIT, StatutEquipe.DISQUALIFIEE] } },
            include: { joueurs: { include: { joueur: true } } },
          },
          terrains: true,
          parties: { where: { statut: StatutPartie.TERMINEE } },
          classements: true,
        },
      });
      if (!concours) throw new NotFoundException('Concours introuvable');

      const { tirageMelee: tirageFn, constituerEquipesMelee: constituerFn } = await import(
        '@/modules/tirage/tirage.service'
      );

      // MELEE_DEMELEE : à partir du tour 2, dissoudre les équipes actives
      // (sans parties terminées — elles n'en ont pas encore à ce stade du tirage)
      // et reformer de nouvelles équipes aléatoires avant le tirage.
      if (concours.modeConstitution === ModeConstitution.MELEE_DEMELEE && tour > 1) {
        const joueurIds = concours.equipes.flatMap((e) =>
          e.joueurs.map((ej) => ej.joueurId),
        );
        const taille = TAILLE_EQUIPE[concours.typeEquipe as TypeEquipe];
        const seed = `${concoursId}-${tour}-${Date.now()}`;
        const groupes = constituerFn(joueurIds, taille, seed);

        // Supprimer uniquement les équipes qui n'ont aucune partie référencée
        // (les équipes du tour précédent sont conservées pour l'historique des scores).
        const equipesAvecParties = await this.prisma.partie.findMany({
          where: {
            concoursId,
            OR: [
              { equipeAId: { in: concours.equipes.map((e) => e.id) } },
              { equipeBId: { in: concours.equipes.map((e) => e.id) } },
            ],
          },
          select: { equipeAId: true, equipeBId: true },
        });
        const idsAvecParties = new Set([
          ...equipesAvecParties.map((p) => p.equipeAId),
          ...equipesAvecParties.map((p) => p.equipeBId),
        ]);
        const idsSansParties = concours.equipes
          .map((e) => e.id)
          .filter((id) => !idsAvecParties.has(id));

        await this.prisma.$transaction(async (tx) => {
          if (idsSansParties.length > 0) {
            await tx.equipe.deleteMany({ where: { id: { in: idsSansParties } } });
          }

          for (let i = 0; i < groupes.length; i++) {
            await tx.equipe.create({
              data: {
                concoursId,
                numeroTirage: i + 1,
                statut: 'PRESENTE',
                joueurs: {
                  create: groupes[i].map((joueurId) => ({ joueurId })),
                },
              },
            });
          }
        });

        // Recharger le concours avec les nouvelles équipes
        const updated = await this.prisma.concours.findUnique({
          where: { id: concoursId },
          include: {
            equipes: {
              where: { statut: { notIn: [StatutEquipe.FORFAIT, StatutEquipe.DISQUALIFIEE] } },
              include: { joueurs: { include: { joueur: true } } },
            },
            terrains: true,
            parties: { where: { statut: StatutPartie.TERMINEE } },
            classements: true,
          },
        });
        if (!updated) throw new NotFoundException('Concours introuvable après re-constitution');
        Object.assign(concours, updated);
      }

      const equipeInfos = concours.equipes.map((e) => {
        const cl = concours.classements.find((c) => c.equipeId === e.id);
        const adversaires = concours.parties
          .filter((p) => p.equipeAId === e.id || p.equipeBId === e.id)
          .map((p) => (p.equipeAId === e.id ? p.equipeBId : p.equipeAId));
        return {
          id: e.id,
          club: e.joueurs[0]?.joueur.club ?? null,
          victoires: cl?.victoires ?? 0,
          adversairesDejaRencontres: adversaires,
        };
      });

      const seed = `${Date.now()}-${Math.random()}`;
      const result = tirageFn(equipeInfos, tour, seed, { eviterMemeClub: tour <= 2 });

      await this.prisma.tirageLog.create({
        data: {
          concoursId,
          tour,
          seed,
          contraintes: { eviterMemeClub: tour <= 2 },
          appariements: result.appariements,
        },
      });

      const terrains = concours.terrains;
      const parties: Partie[] = [];

      for (let i = 0; i < result.appariements.length; i++) {
        const app = result.appariements[i];
        if (app.isBye) {
          const byePartie = await this.prisma.partie.create({
            data: {
              concoursId,
              tour,
              equipeAId: app.equipeAId,
              equipeBId: app.equipeAId,
              scoreA: 13,
              scoreB: 0,
              statut: StatutPartie.TERMINEE,
              type: TypePartie.MELEE,
              heureFin: new Date(),
            },
          });
          parties.push(byePartie);
        } else {
          const terrain = terrains[i % terrains.length];
          const partie = await this.prisma.partie.create({
            data: {
              concoursId,
              tour,
              equipeAId: app.equipeAId,
              equipeBId: app.equipeBId,
              terrainId: terrain?.id,
              type: TypePartie.MELEE,
              statut: StatutPartie.A_JOUER,
            },
          });
          parties.push(partie);
        }
      }

      if (result.byeEquipeId) {
        await this.classementService.recalculer(concoursId);
      }

      this.eventsGateway.emitTourDemarre(concoursId, tour);
      return parties;
    } finally {
      await this.redis.del(lockKey);
    }
  }
}
