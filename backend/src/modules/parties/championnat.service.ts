import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EventsGateway } from '@/modules/gateway/events.gateway';
import { 
  StatutPartie, 
  TypePartie, 
  StatutEquipe, 
  FormatConcours, 
  Partie,
  Concours
} from '@prisma/client';
import Redis from 'ioredis';
import { 
  generatePoolAssignments, 
  generateRoundRobin,
  generateBracket,
  nextPowerOfTwo,
  calculatePoolRankings,
  PoolMatchData,
  RankingEntry,
} from '@/modules/tirage/tirage.service';
import { CoupeService } from './coupe.service';

const DRAW_LOCK_TTL = 30;

@Injectable()
export class ChampionnatService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    @Inject(forwardRef(() => CoupeService))
    private coupeService: CoupeService,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  async lancerPoules(concoursId: string): Promise<void> {
    const lockKey = `draw:lock:${concoursId}:championnat:poules`;
    const locked = await this.redis.set(lockKey, '1', 'EX', DRAW_LOCK_TTL, 'NX');
    if (!locked) throw new BadRequestException('Tirage des poules déjà en cours');

    try {
      const concours = await this.prisma.concours.findUnique({
        where: { id: concoursId },
        include: {
          equipes: {
            where: { statut: { in: [StatutEquipe.INSCRITE, StatutEquipe.PRESENTE] } }
          }
        }
      });

      if (!concours) throw new NotFoundException('Concours introuvable');
      if (concours.format !== FormatConcours.CHAMPIONNAT) {
        throw new BadRequestException("Ce concours n'est pas en format CHAMPIONNAT");
      }

      const equipeIds = concours.equipes.map(e => e.id);
      if (equipeIds.length < 2) {
        throw new BadRequestException("Pas assez d'équipes pour créer des poules");
      }

      const params = (concours.params as any) || {};
      const taillePoule = params.taillePoule || 4;
      const seed = `championnat-poules-${Date.now()}`;
      
      const poolAssignments = generatePoolAssignments(equipeIds, taillePoule, seed);

      await this.prisma.$transaction(async (tx) => {
        const terrains = await tx.terrain.findMany({
          where: { concoursId },
          orderBy: { numero: 'asc' }
        });

        let terrainIdx = 0;

        for (let i = 0; i < poolAssignments.length; i++) {
          const poolTeams = poolAssignments[i];
          const poule = await tx.poule.create({
            data: {
              concoursId,
              numero: i + 1,
              statut: 'EN_COURS',
              equipes: {
                create: poolTeams.map(equipeId => ({ equipeId }))
              }
            }
          });

          const matches = generateRoundRobin(poolTeams);
          for (const [equipeAId, equipeBId] of matches) {
            const terrain = terrains[terrainIdx % terrains.length];
            await tx.partie.create({
              data: {
                concoursId,
                pouleId: poule.id,
                equipeAId,
                equipeBId,
                terrainId: terrain?.id,
                type: TypePartie.CHAMPIONNAT_POULE,
                statut: StatutPartie.A_JOUER,
                tour: 1 // Phase de poule considérée comme tour 1
              }
            });
            terrainIdx++;
          }
        }
      });

      this.eventsGateway.emitTourDemarre(concoursId, 1);
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async lancerPhaseFinale(concoursId: string): Promise<Partie[]> {
    const lockKey = `draw:lock:${concoursId}:championnat:finale`;
    const locked = await this.redis.set(lockKey, '1', 'EX', DRAW_LOCK_TTL, 'NX');
    if (!locked) throw new BadRequestException('Lancement de la phase finale déjà en cours');

    try {
      const concours = await this.prisma.concours.findUnique({
        where: { id: concoursId },
        include: {
          poules: {
            include: {
              parties: true,
              equipes: {
                include: {
                  equipe: true
                }
              }
            }
          }
        }
      });

      if (!concours) throw new NotFoundException('Concours introuvable');
      
      // Vérifier que toutes les parties de poules sont terminées
      const allPoolMatches = await this.prisma.partie.findMany({
        where: { 
          concoursId, 
          type: TypePartie.CHAMPIONNAT_POULE 
        }
      });

      const unfinished = allPoolMatches.filter(p => 
        p.statut !== StatutPartie.TERMINEE && p.statut !== StatutPartie.FORFAIT
      );

      if (unfinished.length > 0) {
        throw new BadRequestException('Certaines parties de poules ne sont pas encore terminées');
      }

      // Calculer les qualifiés (Top 2 de chaque poule) avec classement global
      const allRankings: RankingEntry[] = [];
      
      for (const poule of concours.poules) {
        const poolRankings = await this.getPoolRankings(concoursId, poule.id);
        allRankings.push(...poolRankings.slice(0, 2));
      }

      if (allRankings.length < 2) {
        throw new BadRequestException("Pas assez d'équipes qualifiées pour la phase finale");
      }

      // Trier globalement par victoires → quotient → points marqués
      allRankings.sort((a, b) => {
        if (a.victoires !== b.victoires) return b.victoires - a.victoires;
        if (a.quotient !== b.quotient) return b.quotient - a.quotient;
        return b.pointsMarques - a.pointsMarques;
      });

      const qualifiedEquipeIds = allRankings.map(r => r.equipeId);

      // Créer le bracket avec ordre préservé (byes pour les mieux classés)
      const seed = `championnat-finale-${Date.now()}`;
      const slots = generateBracket(qualifiedEquipeIds, seed, true);
      
      const terrains = await this.prisma.terrain.findMany({
        where: { concoursId },
        orderBy: { numero: 'asc' }
      });

      const parties: Partie[] = [];
      const matchCount = Math.floor(slots.length / 2);
      const bracketRonde = this.calculateBracketRonde(matchCount);
      const byeTeamId = await this.getOrCreateByeTeam(concoursId);

      await this.prisma.$transaction(async (tx) => {
        // Marquer les poules comme terminées
        await tx.poule.updateMany({
          where: { concoursId },
          data: { statut: 'TERMINE' }
        });

        for (let i = 0; i < slots.length; i += 2) {
          const slotA = slots[i];
          const slotB = slots[i + 1];
          const matchIndex = Math.floor(i / 2);

          if (slotA.isBye || slotB.isBye) {
            let realTeamId = slotA.equipeId ?? slotB.equipeId;
            if (!realTeamId) realTeamId = byeTeamId;

            const byePartie = await tx.partie.create({
              data: {
                concoursId,
                tour: 2, // Phase finale commence au tour 2
                equipeAId: realTeamId,
                equipeBId: byeTeamId,
                scoreA: 13,
                scoreB: 0,
                statut: StatutPartie.TERMINEE,
                type: TypePartie.CHAMPIONNAT_FINALE,
                bracketRonde,
                bracketPos: matchIndex,
                terrainId: terrains[matchIndex % terrains.length]?.id,
                heureFin: new Date(),
              },
            });
            parties.push(byePartie);
          } else if (slotA.equipeId && slotB.equipeId) {
            const partie = await tx.partie.create({
              data: {
                concoursId,
                tour: 2,
                equipeAId: slotA.equipeId,
                equipeBId: slotB.equipeId,
                statut: StatutPartie.A_JOUER,
                type: TypePartie.CHAMPIONNAT_FINALE,
                bracketRonde,
                bracketPos: matchIndex,
                terrainId: terrains[matchIndex % terrains.length]?.id,
              },
            });
            parties.push(partie);
          }
        }
      });

      // Gérer la progression automatique pour les byes
      for (const p of parties) {
        if (p.statut === StatutPartie.TERMINEE) {
          await this.coupeService.progresserMatchBracket(p);
        }
      }

      this.eventsGateway.emitTourDemarre(concoursId, 2);
      return parties;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private async getPoolRankings(concoursId: string, pouleId: string): Promise<RankingEntry[]> {
    const parties = await this.prisma.partie.findMany({
      where: { 
        pouleId, 
        statut: { in: [StatutPartie.TERMINEE, StatutPartie.FORFAIT] } 
      }
    });

    const matchData: PoolMatchData[] = parties.map(p => ({
      equipeAId: p.equipeAId,
      equipeBId: p.equipeBId,
      scoreA: p.scoreA,
      scoreB: p.scoreB,
    }));

    return calculatePoolRankings(matchData);
  }

  private calculateBracketRonde(matchCount: number): number {
    if (matchCount === 1) return 6;
    if (matchCount === 2) return 5;
    if (matchCount === 4) return 4;
    if (matchCount === 8) return 3;
    if (matchCount === 16) return 2;
    return 1;
  }

  private async getOrCreateByeTeam(concoursId: string): Promise<string> {
    const existing = await this.prisma.equipe.findFirst({
      where: { concoursId, nom: '__BYE__', statut: StatutEquipe.INSCRITE },
    });
    if (existing) return existing.id;
    const team = await this.prisma.equipe.create({
      data: { concoursId, nom: '__BYE__', statut: StatutEquipe.INSCRITE, tour: null },
    });
    return team.id;
  }
}
