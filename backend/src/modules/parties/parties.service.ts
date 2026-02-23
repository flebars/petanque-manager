import {
  Injectable, NotFoundException, BadRequestException, Inject,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SaisirScoreDto } from './dto/saisir-score.dto';
import { LitigeDto } from './dto/litige.dto';
import { Partie, StatutPartie, StatutEquipe, TypePartie, ModeConstitution, TypeEquipe, FormatConcours } from '@prisma/client';
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

    console.log('[DEBUG] Checking progression:', {
      format: partie.concours?.format,
      type: updated.type,
      bracketRonde: updated.bracketRonde,
      bracketPos: updated.bracketPos,
    });

    if (partie.concours?.format === FormatConcours.COUPE && 
        (updated.type === TypePartie.COUPE_PRINCIPALE || updated.type === TypePartie.COUPE_CONSOLANTE)) {
      console.log('[DEBUG] Calling progresserMatchBracket');
      await this.progresserMatchBracket(updated);
    } else {
      console.log('[DEBUG] Not progressing - conditions not met');
    }

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

    if (partie.concours?.format === FormatConcours.COUPE && 
        (updated.type === TypePartie.COUPE_PRINCIPALE || updated.type === TypePartie.COUPE_CONSOLANTE)) {
      await this.progresserMatchBracket(updated);
    }

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

  async lancerTourCoupe(concoursId: string, tour: number): Promise<Partie[]> {
    const lockKey = `draw:lock:${concoursId}:coupe`;
    const locked = await this.redis.set(lockKey, '1', 'EX', DRAW_LOCK_TTL, 'NX');
    if (!locked) throw new BadRequestException('Tirage déjà en cours');

    try {
      const concours = await this.prisma.concours.findUnique({
        where: { id: concoursId },
      });

      if (!concours) throw new NotFoundException('Concours introuvable');
      if (concours.format !== 'COUPE') {
        throw new BadRequestException('Ce concours n\'est pas en format COUPE');
      }
      if (concours.statut !== 'EN_COURS') {
        throw new BadRequestException('Le concours doit être démarré avant de lancer le bracket');
      }

      const existingMatches = await this.prisma.partie.findMany({
        where: { concoursId },
      });

      if (existingMatches.length > 0) {
        throw new BadRequestException('Le tableau principal a déjà été lancé');
      }

      const parties = await this.creerBracketPrincipal(concoursId);

      await this.prisma.tirageLog.create({
        data: {
          concoursId,
          tour: 1,
          seed: `coupe-${Date.now()}`,
          contraintes: { format: 'COUPE', consolante: (concours.params as any).consolante },
          appariements: parties.map((p) => ({
            equipeAId: p.equipeAId,
            equipeBId: p.equipeBId,
            type: p.type,
            bracketRonde: p.bracketRonde,
          })),
        },
      });

      const consolanteEnabled = (concours.params as any).consolante === true;
      if (consolanteEnabled) {
        await this.creerBracketConsolanteInitial(concoursId);
      }

      this.eventsGateway.emitTourDemarre(concoursId, 1);

      return parties;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private async creerBracketPrincipal(concoursId: string): Promise<Partie[]> {
    const equipes = await this.prisma.equipe.findMany({
      where: {
        concoursId,
        statut: { in: [StatutEquipe.INSCRITE, StatutEquipe.PRESENTE] },
      },
    });

    if (equipes.length < 2) {
      throw new BadRequestException('Pas assez d\'équipes inscrites (minimum 2)');
    }

    const { generateBracket } = await import('@/modules/tirage/tirage.service');
    const equipeIds = equipes.map((e) => e.id);
    const seed = `coupe-main-${Date.now()}`;
    const slots = generateBracket(equipeIds, seed);

    const terrains = await this.prisma.terrain.findMany({
      where: { concoursId },
      orderBy: { numero: 'asc' },
    });

    if (terrains.length === 0) {
      throw new BadRequestException('Aucun terrain disponible');
    }

    const parties: Partie[] = [];
    const matchCount = Math.floor(slots.length / 2);
    const bracketRonde = this.calculateBracketRonde(matchCount);

    let matchIndex = 0;
    for (let i = 0; i < slots.length; i += 2) {
      const slotA = slots[i];
      const slotB = slots[i + 1];

      if (slotA.isBye || slotB.isBye) {
        const realTeamId = slotA.equipeId ?? slotB.equipeId;
        if (!realTeamId) continue;

        const byePartie = await this.prisma.partie.create({
          data: {
            concoursId,
            tour: 1,
            equipeAId: realTeamId,
            equipeBId: realTeamId,
            scoreA: 13,
            scoreB: 0,
            statut: StatutPartie.TERMINEE,
            type: TypePartie.COUPE_PRINCIPALE,
            bracketRonde,
            bracketPos: matchIndex,
            terrainId: terrains[parties.length % terrains.length].id,
            heureFin: new Date(),
          },
        });
        parties.push(byePartie);
      } else {
        const partie = await this.prisma.partie.create({
          data: {
            concoursId,
            tour: 1,
            equipeAId: slotA.equipeId!,
            equipeBId: slotB.equipeId!,
            statut: StatutPartie.A_JOUER,
            type: TypePartie.COUPE_PRINCIPALE,
            bracketRonde,
            bracketPos: matchIndex,
            terrainId: terrains[parties.length % terrains.length].id,
          },
        });
        parties.push(partie);
      }
      matchIndex++;
    }

    return parties;
  }

  private async creerBracketConsolante(concoursId: string): Promise<Partie[]> {
    const tour1Parties = await this.prisma.partie.findMany({
      where: {
        concoursId,
        tour: 1,
        type: TypePartie.COUPE_PRINCIPALE,
        statut: { in: [StatutPartie.TERMINEE, StatutPartie.FORFAIT] },
      },
    });

    if (tour1Parties.length === 0) {
      throw new BadRequestException('Aucune partie du tour 1 n\'est terminée');
    }

    const loserIds: string[] = [];
    for (const partie of tour1Parties) {
      if (partie.equipeAId === partie.equipeBId) continue;

      const loser = (partie.scoreA ?? 0) < (partie.scoreB ?? 0)
        ? partie.equipeAId
        : partie.equipeBId;
      loserIds.push(loser);
    }

    if (loserIds.length < 2) {
      throw new BadRequestException('Pas assez de perdants pour créer la consolante');
    }

    const { generateBracket } = await import('@/modules/tirage/tirage.service');
    const seed = `coupe-consolante-${Date.now()}`;
    const slots = generateBracket(loserIds, seed);

    const terrains = await this.prisma.terrain.findMany({
      where: { concoursId },
      orderBy: { numero: 'asc' },
    });

    const parties: Partie[] = [];
    const matchCount = Math.floor(slots.length / 2);
    const bracketRonde = this.calculateBracketRonde(matchCount);

    for (let i = 0; i < slots.length; i += 2) {
      const slotA = slots[i];
      const slotB = slots[i + 1];

      if (slotA.isBye || slotB.isBye) {
        const realTeamId = slotA.equipeId ?? slotB.equipeId;
        if (!realTeamId) continue;

        const byePartie = await this.prisma.partie.create({
          data: {
            concoursId,
            tour: 2,
            equipeAId: realTeamId,
            equipeBId: realTeamId,
            scoreA: 13,
            scoreB: 0,
            statut: StatutPartie.TERMINEE,
            type: TypePartie.COUPE_CONSOLANTE,
            bracketRonde,
            bracketPos: i,
            terrainId: terrains[parties.length % terrains.length].id,
            heureFin: new Date(),
          },
        });
        parties.push(byePartie);
      } else {
        const partie = await this.prisma.partie.create({
          data: {
            concoursId,
            tour: 2,
            equipeAId: slotA.equipeId!,
            equipeBId: slotB.equipeId!,
            statut: StatutPartie.A_JOUER,
            type: TypePartie.COUPE_CONSOLANTE,
            bracketRonde,
            bracketPos: i,
            terrainId: terrains[parties.length % terrains.length].id,
          },
        });
        parties.push(partie);
      }
    }

    return parties;
  }

  private async creerBracketConsolanteInitial(concoursId: string): Promise<void> {
    // Empty method - consolante structure will be created dynamically
    // as Tour 1 matches complete
  }

  private calculateBracketRonde(matchCount: number): number {
    // Bracket round numbering for elimination tournaments
    // Finales: Grande + Petite (2 matches total) = bracketRonde 6
    if (matchCount === 1) return 6;
    // Demi-finales (2 matches) = bracketRonde 5
    if (matchCount === 2) return 5;
    // Quarts de finale (4 matches) = bracketRonde 4
    if (matchCount === 4) return 4;
    // Huitièmes de finale (8 matches) = bracketRonde 3
    if (matchCount === 8) return 3;
    // Seizièmes de finale (16 matches) = bracketRonde 2
    if (matchCount === 16) return 2;
    // Trente-deuxièmes de finale (32+ matches) = bracketRonde 1
    return 1;
  }

  private async progresserMatchBracket(completedMatch: Partie): Promise<void> {
    if (!completedMatch.bracketRonde || completedMatch.bracketPos === null || completedMatch.bracketPos === undefined) {
      return;
    }

    if (completedMatch.equipeAId === completedMatch.equipeBId) {
      return;
    }

    const winnerId = (completedMatch.scoreA ?? 0) > (completedMatch.scoreB ?? 0)
      ? completedMatch.equipeAId
      : completedMatch.equipeBId;

    const loserId = winnerId === completedMatch.equipeAId 
      ? completedMatch.equipeBId 
      : completedMatch.equipeAId;

    if (completedMatch.type === TypePartie.COUPE_PRINCIPALE && completedMatch.tour === 1) {
      const concours = await this.prisma.concours.findUnique({
        where: { id: completedMatch.concoursId },
      });

      const consolanteEnabled = (concours?.params as any)?.consolante === true;
      if (consolanteEnabled) {
        await this.addLoserToConsolante(completedMatch.concoursId, loserId, completedMatch.bracketPos);
      }
    }

    const nextBracketRonde = completedMatch.bracketRonde + 1;
    const nextBracketPos = Math.floor(completedMatch.bracketPos / 2);
    const isTeamA = completedMatch.bracketPos % 2 === 0;

    if (completedMatch.bracketRonde === 5) {
      await this.createOrUpdateFinale(
        completedMatch.concoursId,
        completedMatch.type!,
        winnerId,
        loserId,
        isTeamA,
      );
      return;
    }

    await this.createOrUpdateNextMatch(
      completedMatch.concoursId,
      completedMatch.type!,
      nextBracketRonde,
      nextBracketPos,
      winnerId,
      isTeamA,
    );
  }

  private async addLoserToConsolante(concoursId: string, loserId: string, mainBracketPos: number): Promise<void> {
    const allTour1Matches = await this.prisma.partie.findMany({
      where: {
        concoursId,
        tour: 1,
        type: TypePartie.COUPE_PRINCIPALE,
      },
    });

    const completedMatches = allTour1Matches.filter(
      m => m.statut === StatutPartie.TERMINEE || m.statut === StatutPartie.FORFAIT
    );

    const nonByeMatches = allTour1Matches.filter(m => m.equipeAId !== m.equipeBId);

    if (completedMatches.length < 2) {
      return;
    }

    const losers: Array<{ id: string; pos: number }> = [];
    for (const match of completedMatches) {
      if (match.equipeAId === match.equipeBId) continue;

      const loser = (match.scoreA ?? 0) < (match.scoreB ?? 0)
        ? match.equipeAId
        : match.equipeBId;
      losers.push({ id: loser, pos: match.bracketPos ?? 0 });
    }

    if (losers.length < 2) {
      return;
    }

    const { generateBracket } = await import('@/modules/tirage/tirage.service');
    const loserIds = losers.map(l => l.id);
    const slots = generateBracket(loserIds, `consolante-${Date.now()}`);

    const matchCount = Math.floor(slots.length / 2);
    const bracketRonde = this.calculateBracketRonde(matchCount);

    const existingConsolanteMatches = await this.prisma.partie.findMany({
      where: {
        concoursId,
        type: TypePartie.COUPE_CONSOLANTE,
      },
    });

    const terrains = await this.prisma.terrain.findMany({
      where: { concoursId },
      orderBy: { numero: 'asc' },
    });

    const createdMatches = [];
    let matchIndex = 0;
    for (let i = 0; i < slots.length; i += 2) {
      const slotA = slots[i];
      const slotB = slots[i + 1];

      if (slotA.isBye || slotB.isBye) {
        const realTeamId = slotA.equipeId ?? slotB.equipeId;
        if (!realTeamId) continue;

        const byeMatch = await this.prisma.partie.create({
          data: {
            concoursId,
            tour: 1,
            equipeAId: realTeamId,
            equipeBId: realTeamId,
            scoreA: 13,
            scoreB: 0,
            statut: StatutPartie.TERMINEE,
            type: TypePartie.COUPE_CONSOLANTE,
            bracketRonde,
            bracketPos: matchIndex,
            terrainId: terrains[createdMatches.length % terrains.length]?.id,
            heureFin: new Date(),
          },
        });
        createdMatches.push(byeMatch);
      } else if (slotA.equipeId && slotB.equipeId) {
        const existingMatch = existingConsolanteMatches.find(
          m => m.bracketPos === matchIndex && m.bracketRonde === bracketRonde
        );

        if (!existingMatch) {
          const match = await this.prisma.partie.create({
            data: {
              concoursId,
              tour: 1,
              equipeAId: slotA.equipeId,
              equipeBId: slotB.equipeId,
              statut: StatutPartie.A_JOUER,
              type: TypePartie.COUPE_CONSOLANTE,
              bracketRonde,
              bracketPos: matchIndex,
              terrainId: terrains[createdMatches.length % terrains.length]?.id,
            },
          });
          createdMatches.push(match);
        }
      }
      matchIndex++;
    }
  }

  private async createOrUpdateNextMatch(
    concoursId: string,
    type: TypePartie,
    nextBracketRonde: number,
    nextBracketPos: number,
    winnerId: string,
    isTeamA: boolean,
  ): Promise<void> {
    console.log(`[BRACKET] Creating/updating next match - Round ${nextBracketRonde}, Pos ${nextBracketPos}, Winner: ${winnerId}, isTeamA: ${isTeamA}`);
    
    const existingMatch = await this.prisma.partie.findFirst({
      where: {
        concoursId,
        type,
        bracketRonde: nextBracketRonde,
        bracketPos: nextBracketPos,
      },
    });

    if (existingMatch) {
      console.log(`[BRACKET] Match already exists, updating...`, { 
        currentA: existingMatch.equipeAId, 
        currentB: existingMatch.equipeBId 
      });
      
      const updateData: any = {};
      
      if (isTeamA && existingMatch.equipeAId !== winnerId) {
        updateData.equipeAId = winnerId;
      } else if (!isTeamA && existingMatch.equipeBId !== winnerId) {
        updateData.equipeBId = winnerId;
      }

      if (Object.keys(updateData).length > 0) {
        console.log(`[BRACKET] Updating with:`, updateData);
        await this.prisma.partie.update({
          where: { id: existingMatch.id },
          data: updateData,
        });
      }

      const updatedMatch = await this.prisma.partie.findUnique({
        where: { id: existingMatch.id },
      });

      if (updatedMatch && updatedMatch.equipeAId && updatedMatch.equipeBId && 
          updatedMatch.equipeAId !== updatedMatch.equipeBId && !updatedMatch.terrainId) {
        console.log(`[BRACKET] Both teams ready, assigning terrain`);
        await this.assignTerrainToMatch(updatedMatch.id, concoursId);
      }
    } else {
      console.log(`[BRACKET] No existing match, creating placeholder with one team`);
      
      const newMatch = await this.prisma.partie.create({
        data: {
          concoursId,
          type,
          bracketRonde: nextBracketRonde,
          bracketPos: nextBracketPos,
          equipeAId: winnerId,
          equipeBId: winnerId,
          statut: StatutPartie.A_JOUER,
          tour: Math.ceil(nextBracketRonde / 2),
        },
      });

      console.log(`[BRACKET] Placeholder match created with ID: ${newMatch.id}`);
    }
  }

  private async createOrUpdateFinale(
    concoursId: string,
    type: TypePartie,
    winnerId: string,
    loserId: string,
    isFirstDemiFinale: boolean,
  ): Promise<void> {
    const demiFinales = await this.prisma.partie.findMany({
      where: {
        concoursId,
        type,
        bracketRonde: 5,
        statut: { in: [StatutPartie.TERMINEE, StatutPartie.FORFAIT] },
      },
    });

    if (demiFinales.length === 2) {
      const winners = demiFinales.map(m => 
        (m.scoreA ?? 0) > (m.scoreB ?? 0) ? m.equipeAId : m.equipeBId
      );
      const losers = demiFinales.map(m => 
        (m.scoreA ?? 0) < (m.scoreB ?? 0) ? m.equipeAId : m.equipeBId
      );

      const grandeFinale = await this.prisma.partie.findFirst({
        where: { concoursId, type, bracketRonde: 6, bracketPos: 0 },
      });

      if (!grandeFinale) {
        const newGrandeFinale = await this.prisma.partie.create({
          data: {
            concoursId,
            type,
            bracketRonde: 6,
            bracketPos: 0,
            equipeAId: winners[0],
            equipeBId: winners[1],
            statut: StatutPartie.A_JOUER,
            tour: 3,
          },
        });
        await this.assignTerrainToMatch(newGrandeFinale.id, concoursId);
      }

      const petiteFinale = await this.prisma.partie.findFirst({
        where: { concoursId, type, bracketRonde: 6, bracketPos: 1 },
      });

      if (!petiteFinale) {
        const newPetiteFinale = await this.prisma.partie.create({
          data: {
            concoursId,
            type,
            bracketRonde: 6,
            bracketPos: 1,
            equipeAId: losers[0],
            equipeBId: losers[1],
            statut: StatutPartie.A_JOUER,
            tour: 3,
          },
        });
        await this.assignTerrainToMatch(newPetiteFinale.id, concoursId);
      }
    }
  }

  private async assignTerrainToMatch(partieId: string, concoursId: string): Promise<void> {
    const allMatches = await this.prisma.partie.findMany({
      where: {
        concoursId,
        statut: { in: [StatutPartie.A_JOUER, StatutPartie.EN_COURS] },
      },
      include: { terrain: true },
    });

    const terrains = await this.prisma.terrain.findMany({
      where: { concoursId },
      orderBy: { numero: 'asc' },
    });

    if (terrains.length === 0) {
      return;
    }

    const occupiedTerrainIds = new Set(
      allMatches
        .filter(m => m.id !== partieId && m.terrainId)
        .map(m => m.terrainId!)
    );

    const availableTerrain = terrains.find(t => !occupiedTerrainIds.has(t.id));

    if (availableTerrain) {
      await this.prisma.partie.update({
        where: { id: partieId },
        data: { terrainId: availableTerrain.id },
      });
    } else {
      const leastUsedTerrain = terrains[0];
      await this.prisma.partie.update({
        where: { id: partieId },
        data: { terrainId: leastUsedTerrain.id },
      });
    }
  }
}
