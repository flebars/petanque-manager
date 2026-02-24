import {
  Injectable, NotFoundException, BadRequestException, Inject,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SaisirScoreDto } from './dto/saisir-score.dto';
import { LitigeDto } from './dto/litige.dto';
import { Partie, StatutPartie, StatutEquipe, TypePartie, ModeConstitution, TypeEquipe, FormatConcours } from '@prisma/client';
import { ClassementService } from '@/modules/classement/classement.service';
import { EventsGateway } from '@/modules/gateway/events.gateway';
import { CoupeService } from './coupe.service';
import { ChampionnatService } from './championnat.service';
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
    private coupeService: CoupeService,
    private championnatService: ChampionnatService,
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
    if (partie.statut === StatutPartie.A_MONTER) {
      throw new BadRequestException('Cette partie est en attente de ses participants');
    }
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
    if (partie.statut === StatutPartie.A_MONTER) {
      throw new BadRequestException('Cette partie est en attente de ses participants');
    }
    if (partie.statut !== StatutPartie.EN_COURS) {
      throw new BadRequestException('Le score ne peut être saisi que sur une partie en cours');
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

    const concours = await this.prisma.concours.findUnique({
      where: { id: partie.concoursId },
    });

    console.log('[DEBUG] Checking progression:', {
      format: concours?.format,
      type: updated.type,
      bracketRonde: updated.bracketRonde,
      bracketPos: updated.bracketPos,
    });

    if ((concours?.format === FormatConcours.COUPE || concours?.format === FormatConcours.CHAMPIONNAT) && 
        (updated.type === TypePartie.COUPE_PRINCIPALE || 
         updated.type === TypePartie.COUPE_CONSOLANTE || 
         updated.type === TypePartie.CHAMPIONNAT_FINALE)) {
      console.log('[DEBUG] Delegating to CoupeService.progresserMatchBracket');
      await this.coupeService.progresserMatchBracket(updated);
    } else {
      console.log('[DEBUG] Not progressing - conditions not met');
    }

    return updated;
  }

  async forfaitAvantMatch(id: string, equipeForFaitId: string): Promise<Partie> {
    const partie = await this.findOne(id);
    if (partie.statut === StatutPartie.A_MONTER) {
      throw new BadRequestException('Cette partie est en attente de ses participants');
    }
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

    const concours = await this.prisma.concours.findUnique({
      where: { id: partie.concoursId },
    });

    if ((concours?.format === FormatConcours.COUPE || concours?.format === FormatConcours.CHAMPIONNAT) && 
        (updated.type === TypePartie.COUPE_PRINCIPALE || 
         updated.type === TypePartie.COUPE_CONSOLANTE || 
         updated.type === TypePartie.CHAMPIONNAT_FINALE)) {
      await this.coupeService.progresserMatchBracket(updated);
    }

    return updated;
  }

  async forfaitEnCours(id: string): Promise<Partie> {
    const partie = await this.findOne(id);
    if (partie.statut === StatutPartie.A_MONTER) {
      throw new BadRequestException('Cette partie est en attente de ses participants');
    }
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
    if (partie.statut === StatutPartie.A_MONTER) {
      throw new BadRequestException('Cette partie est en attente de ses participants');
    }
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
          terrains: true,
          parties: { where: { statut: StatutPartie.TERMINEE } },
          classements: true,
        },
      });
      if (!concours) throw new NotFoundException('Concours introuvable');
      if (concours.statut !== 'EN_COURS') {
        throw new BadRequestException('Le concours doit être démarré avant de lancer un tour');
      }

      const { tirageMelee: tirageFn, constituerEquipesMelee: constituerFn } = await import(
        '@/modules/tirage/tirage.service'
      );

      // MELEE_DEMELEE : à partir du tour 2, dissoudre les équipes actives et reformer
      // de nouvelles équipes aléatoires en respectant le classement des joueurs.
      if (concours.modeConstitution === ModeConstitution.MELEE_DEMELEE && tour > 1) {
        // Récupérer tous les joueurs inscrits (équipes de base avec tour = null)
        const equipesBase = await this.prisma.equipe.findMany({
          where: { 
            concoursId, 
            tour: null,
            statut: { notIn: [StatutEquipe.FORFAIT, StatutEquipe.DISQUALIFIEE] },
          },
          include: { joueurs: true },
        });

        const tousJoueurIds = new Set<string>();
        for (const equipe of equipesBase) {
          for (const ej of equipe.joueurs) {
            tousJoueurIds.add(ej.joueurId);
          }
        }

        // Récupérer le classement des joueurs (agrégé sur tous les tours précédents)
        const classementJoueurs = await this.prisma.classementJoueur.findMany({
          where: { concoursId },
          orderBy: [{ victoires: 'desc' }, { quotient: 'desc' }, { pointsMarques: 'desc' }],
        });

        // Créer une map pour trouver rapidement les stats d'un joueur
        const statsMap = new Map(classementJoueurs.map((cj) => [cj.joueurId, cj]));

        // Trier tous les joueurs (y compris les nouveaux sans stats) par leur classement
        const joueurIdsTries = Array.from(tousJoueurIds).sort((a, b) => {
          const statsA = statsMap.get(a);
          const statsB = statsMap.get(b);
          
          if (!statsA && !statsB) return 0;
          if (!statsA) return 1;
          if (!statsB) return -1;
          
          if (statsA.victoires !== statsB.victoires) {
            return statsB.victoires - statsA.victoires;
          }
          if (statsA.quotient !== statsB.quotient) {
            return statsB.quotient - statsA.quotient;
          }
          return statsB.pointsMarques - statsA.pointsMarques;
        });

        const taille = TAILLE_EQUIPE[concours.typeEquipe as TypeEquipe];
        const seed = `${concoursId}-${tour}-${Date.now()}`;
        const groupes = constituerFn(joueurIdsTries, taille, seed);

        // Pour MELEE_DEMELEE, supprimer uniquement les équipes du tour précédent sans parties
        // Les équipes avec parties sont conservées pour l'historique
        await this.prisma.equipe.deleteMany({
          where: {
            concoursId,
            tour: tour - 1,
            partiesA: { none: {} },
            partiesB: { none: {} },
          },
        });

        // Créer les nouvelles équipes pour ce tour
        await this.prisma.$transaction(async (tx) => {
          for (let i = 0; i < groupes.length; i++) {
            await tx.equipe.create({
              data: {
                concoursId,
                numeroTirage: i + 1,
                tour,
                statut: 'PRESENTE',
                joueurs: {
                  create: groupes[i].map((joueurId) => ({ joueurId })),
                },
              },
            });
          }
        });
      }

      // Charger les équipes du tour actuel
      const equipesTour = await this.prisma.equipe.findMany({
        where: {
          concoursId,
          tour: concours.modeConstitution === ModeConstitution.MELEE_DEMELEE ? tour : undefined,
          statut: { notIn: [StatutEquipe.FORFAIT, StatutEquipe.DISQUALIFIEE] },
        },
        include: { joueurs: { include: { joueur: true } } },
      });

      const equipeInfos = equipesTour.map((e) => {
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
          appariements: result.appariements as any,
        },
      });

      const terrains = concours.terrains;
      const parties: Partie[] = [];

      for (let i = 0; i < result.appariements.length; i++) {
        const app = result.appariements[i];
        if (app.isBye) {
          const byeTeamId = await this.coupeService.getOrCreateByeTeamPublic(concoursId);
          const byePartie = await this.prisma.partie.create({
            data: {
              concoursId,
              tour,
              equipeAId: app.equipeAId,
              equipeBId: byeTeamId,
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

  async lancerTourCoupe(concoursId: string, tour: number): Promise<Partie[]> {
    return this.coupeService.lancerTourCoupe(concoursId, tour);
  }

  async lancerPoules(concoursId: string): Promise<void> {
    return this.championnatService.lancerPoules(concoursId);
  }

  async lancerPhaseFinale(concoursId: string): Promise<Partie[]> {
    return this.championnatService.lancerPhaseFinale(concoursId);
  }
}
