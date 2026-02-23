import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EventsGateway } from '@/modules/gateway/events.gateway';
import { Partie, StatutPartie, TypePartie, StatutEquipe, FormatConcours } from '@prisma/client';
import Redis from 'ioredis';

const DRAW_LOCK_TTL = 30;

@Injectable()
export class CoupeService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private redis: Redis,
  ) {}

  async lancerTourCoupe(concoursId: string, tour: number): Promise<Partie[]> {
    const lockKey = `draw:lock:${concoursId}:coupe`;
    const locked = await this.redis.set(lockKey, '1', 'EX', DRAW_LOCK_TTL, 'NX');
    if (!locked) throw new BadRequestException('Tirage déjà en cours');

    try {
      const concours = await this.prisma.concours.findUnique({
        where: { id: concoursId },
      });

      if (!concours) throw new NotFoundException('Concours introuvable');
      if (concours.format !== FormatConcours.COUPE) {
        throw new BadRequestException("Ce concours n'est pas en format COUPE");
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
          })) as any,
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

  async progresserMatchBracket(completedMatch: Partie): Promise<void> {
    if (
      !completedMatch.bracketRonde ||
      completedMatch.bracketPos === null ||
      completedMatch.bracketPos === undefined
    ) {
      return;
    }

    if (completedMatch.equipeAId === completedMatch.equipeBId) {
      return;
    }

    const winnerId =
      (completedMatch.scoreA ?? 0) > (completedMatch.scoreB ?? 0)
        ? completedMatch.equipeAId
        : completedMatch.equipeBId;

    const loserId =
      winnerId === completedMatch.equipeAId ? completedMatch.equipeBId : completedMatch.equipeAId;

    if (completedMatch.type === TypePartie.COUPE_PRINCIPALE && completedMatch.tour === 1) {
      const concours = await this.prisma.concours.findUnique({
        where: { id: completedMatch.concoursId },
      });

      const consolanteEnabled = (concours?.params as any)?.consolante === true;
      if (consolanteEnabled) {
        try {
          await this.addLoserToConsolante(
            completedMatch.concoursId,
            loserId,
            completedMatch.bracketPos,
          );
          console.log(`[BRACKET] Consolante update completed for pos ${completedMatch.bracketPos}`);
        } catch (error) {
          console.error(`[BRACKET] Error adding to consolante:`, error);
        }
      }
    }

    const nextBracketRonde = completedMatch.bracketRonde + 1;
    const nextBracketPos = Math.floor(completedMatch.bracketPos / 2);
    const isTeamA = completedMatch.bracketPos % 2 === 0;

    console.log(
      `[BRACKET] About to progress to next round: type=${completedMatch.type}, bracketRonde=${completedMatch.bracketRonde}, nextPos=${nextBracketPos}, isTeamA=${isTeamA}`,
    );

    const completedMatchesAtThisRound = await this.prisma.partie.findMany({
      where: {
        concoursId: completedMatch.concoursId,
        type: completedMatch.type,
        bracketRonde: completedMatch.bracketRonde,
        statut: { in: [StatutPartie.TERMINEE, StatutPartie.FORFAIT] },
      },
    });

    if (completedMatchesAtThisRound.length === 2) {
      console.log(
        `[BRACKET] Detected Semi-Finals completion at round ${completedMatch.bracketRonde} for type ${completedMatch.type}`,
      );
      await this.createOrUpdateFinale(
        completedMatch.concoursId,
        completedMatch.type!,
        winnerId,
        loserId,
        isTeamA,
        completedMatch.bracketRonde,
      );
      return;
    }

    const finalsRound = completedMatch.bracketRonde + 1;
    const existingFinalsMatches = await this.prisma.partie.findMany({
      where: {
        concoursId: completedMatch.concoursId,
        type: completedMatch.type,
        bracketRonde: finalsRound,
      },
    });

    if (existingFinalsMatches.length >= 2) {
      console.log(`[BRACKET] Finals completed - no further progression`);
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

  private async creerBracketPrincipal(concoursId: string): Promise<Partie[]> {
    const equipes = await this.prisma.equipe.findMany({
      where: {
        concoursId,
        statut: { in: [StatutEquipe.INSCRITE, StatutEquipe.PRESENTE] },
      },
    });

    if (equipes.length < 2) {
      throw new BadRequestException("Pas assez d'équipes inscrites (minimum 2)");
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
            terrainId: terrains[matchIndex % terrains.length]?.id,
            heureFin: new Date(),
          },
        });
        parties.push(byePartie);
      } else if (slotA.equipeId && slotB.equipeId) {
        const partie = await this.prisma.partie.create({
          data: {
            concoursId,
            tour: 1,
            equipeAId: slotA.equipeId,
            equipeBId: slotB.equipeId,
            statut: StatutPartie.A_JOUER,
            type: TypePartie.COUPE_PRINCIPALE,
            bracketRonde,
            bracketPos: matchIndex,
            terrainId: terrains[matchIndex % terrains.length]?.id,
          },
        });
        parties.push(partie);
      }
      matchIndex++;
    }

    return parties;
  }

  private async creerBracketConsolanteInitial(concoursId: string): Promise<void> {
    console.log(`[BRACKET] Creating initial Consolante bracket structure for ${concoursId}`);
  }

  private async addLoserToConsolante(
    concoursId: string,
    loserId: string,
    mainBracketPos: number,
  ): Promise<void> {
    const allTour1Matches = await this.prisma.partie.findMany({
      where: {
        concoursId,
        tour: 1,
        type: TypePartie.COUPE_PRINCIPALE,
      },
      orderBy: { bracketPos: 'asc' },
    });

    const completedMatches = allTour1Matches.filter(
      (m) => m.statut === StatutPartie.TERMINEE || m.statut === StatutPartie.FORFAIT,
    );
    const losers = completedMatches
      .map((m) => {
        if (m.equipeAId === m.equipeBId) return null;
        return (m.scoreA ?? 0) > (m.scoreB ?? 0) ? m.equipeBId : m.equipeAId;
      })
      .filter((id) => id !== null) as string[];

    if (losers.length < 2) {
      console.log(`[BRACKET] Only ${losers.length} losers so far, waiting for more matches`);
      return;
    }

    const loserPositions = completedMatches
      .filter((m) => m.equipeAId !== m.equipeBId)
      .map((m) => ({
        loserId: (m.scoreA ?? 0) > (m.scoreB ?? 0) ? m.equipeBId : m.equipeAId,
        bracketPos: m.bracketPos ?? 0,
      }))
      .sort((a, b) => a.bracketPos - b.bracketPos);

    const slots: Array<{ equipeId: string | null; isBye: boolean }> = [];
    const targetSize = this.nextPowerOfTwo(losers.length);

    for (let i = 0; i < targetSize; i++) {
      if (i < loserPositions.length) {
        slots.push({ equipeId: loserPositions[i].loserId, isBye: false });
      } else {
        slots.push({ equipeId: null, isBye: true });
      }
    }

    const terrains = await this.prisma.terrain.findMany({
      where: { concoursId },
      orderBy: { numero: 'asc' },
    });

    if (terrains.length === 0) {
      console.log('[BRACKET] No terrains available for Consolante');
      return;
    }

    const matchCount = Math.floor(slots.length / 2);
    const bracketRonde = this.calculateConsolanteBracketRonde(matchCount);

    const existingConsolanteMatches = await this.prisma.partie.findMany({
      where: {
        concoursId,
        type: TypePartie.COUPE_CONSOLANTE,
        bracketRonde,
      },
      orderBy: { bracketPos: 'asc' },
    });

    let matchIndex = 0;
    for (let i = 0; i < slots.length; i += 2) {
      const slotA = slots[i];
      const slotB = slots[i + 1];

      const existingMatch = existingConsolanteMatches.find((m) => m.bracketPos === matchIndex);

      if (slotA.isBye || slotB.isBye) {
        const realTeamId = slotA.equipeId ?? slotB.equipeId;
        if (!realTeamId) {
          matchIndex++;
          continue;
        }

        if (!existingMatch) {
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
              terrainId: terrains[matchIndex % terrains.length]?.id,
              heureFin: new Date(),
            },
          });
          console.log(
            `[BRACKET] Created consolante bye match at R${bracketRonde} P${matchIndex}`,
          );
        }
      } else if (slotA.equipeId && slotB.equipeId) {
        if (existingMatch) {
          const updateData: any = {};
          if (existingMatch.equipeAId === existingMatch.equipeBId) {
            if (
              slotA.equipeId !== existingMatch.equipeAId ||
              slotB.equipeId !== existingMatch.equipeBId
            ) {
              updateData.equipeAId = slotA.equipeId;
              updateData.equipeBId = slotB.equipeId;
            }
          } else {
            if (existingMatch.equipeAId !== slotA.equipeId) {
              updateData.equipeAId = slotA.equipeId;
            }
            if (existingMatch.equipeBId !== slotB.equipeId) {
              updateData.equipeBId = slotB.equipeId;
            }
          }

          if (Object.keys(updateData).length > 0) {
            await this.prisma.partie.update({
              where: { id: existingMatch.id },
              data: updateData,
            });
            console.log(`[BRACKET] Updated consolante match R${bracketRonde} P${matchIndex}`);

            const updated = await this.prisma.partie.findUnique({
              where: { id: existingMatch.id },
            });
            if (updated && updated.equipeAId !== updated.equipeBId && !updated.terrainId) {
              await this.assignTerrainToMatch(updated.id, concoursId);
            }
          }
        } else {
          const newMatch = await this.prisma.partie.create({
            data: {
              concoursId,
              tour: 1,
              equipeAId: slotA.equipeId,
              equipeBId: slotB.equipeId,
              statut: StatutPartie.A_JOUER,
              type: TypePartie.COUPE_CONSOLANTE,
              bracketRonde,
              bracketPos: matchIndex,
              terrainId: terrains[matchIndex % terrains.length]?.id,
            },
          });
          console.log(`[BRACKET] Created consolante match R${bracketRonde} P${matchIndex}`);

          if (newMatch.equipeAId !== newMatch.equipeBId) {
            await this.assignTerrainToMatch(newMatch.id, concoursId);
          }
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
    console.log(
      `[BRACKET] Creating/updating next match - Round ${nextBracketRonde}, Pos ${nextBracketPos}, Winner: ${winnerId}, isTeamA: ${isTeamA}`,
    );

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
        currentB: existingMatch.equipeBId,
      });

      const updateData: any = {};

      if (existingMatch.equipeAId === existingMatch.equipeBId) {
        if (isTeamA) {
          updateData.equipeAId = winnerId;
        } else {
          updateData.equipeBId = winnerId;
        }
      } else {
        if (isTeamA && existingMatch.equipeAId !== winnerId) {
          updateData.equipeAId = winnerId;
        } else if (!isTeamA && existingMatch.equipeBId !== winnerId) {
          updateData.equipeBId = winnerId;
        }
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

      if (
        updatedMatch &&
        updatedMatch.equipeAId &&
        updatedMatch.equipeBId &&
        updatedMatch.equipeAId !== updatedMatch.equipeBId &&
        !updatedMatch.terrainId
      ) {
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
    semiFinalRonde: number,
  ): Promise<void> {
    const demiFinales = await this.prisma.partie.findMany({
      where: {
        concoursId,
        type,
        bracketRonde: semiFinalRonde,
        statut: { in: [StatutPartie.TERMINEE, StatutPartie.FORFAIT] },
      },
    });

    if (demiFinales.length === 2) {
      const winners = demiFinales.map((m) =>
        (m.scoreA ?? 0) > (m.scoreB ?? 0) ? m.equipeAId : m.equipeBId,
      );
      const losers = demiFinales.map((m) =>
        (m.scoreA ?? 0) < (m.scoreB ?? 0) ? m.equipeAId : m.equipeBId,
      );

      const finaleRonde = semiFinalRonde + 1;
      console.log(`[BRACKET] Creating finales at round ${finaleRonde} for type ${type}`);
      console.log(`[BRACKET] Winners:`, winners);
      console.log(`[BRACKET] Losers:`, losers);

      const grandeFinale = await this.prisma.partie.findFirst({
        where: { concoursId, type, bracketRonde: finaleRonde, bracketPos: 0 },
      });

      if (!grandeFinale) {
        const newGrandeFinale = await this.prisma.partie.create({
          data: {
            concoursId,
            type,
            bracketRonde: finaleRonde,
            bracketPos: 0,
            equipeAId: winners[0],
            equipeBId: winners[1],
            statut: StatutPartie.A_JOUER,
            tour: 3,
          },
        });
        await this.assignTerrainToMatch(newGrandeFinale.id, concoursId);
        console.log(`[BRACKET] Created Grande Finale at R${finaleRonde} P0`);
      } else {
        console.log(`[BRACKET] Grande Finale already exists at R${finaleRonde} P0`);
      }

      console.log(`[BRACKET] Checking for Petite Finale at R${finaleRonde} P1...`);
      const petiteFinale = await this.prisma.partie.findFirst({
        where: { concoursId, type, bracketRonde: finaleRonde, bracketPos: 1 },
      });

      if (!petiteFinale) {
        console.log(`[BRACKET] Petite Finale not found, creating with losers:`, losers);
        const newPetiteFinale = await this.prisma.partie.create({
          data: {
            concoursId,
            type,
            bracketRonde: finaleRonde,
            bracketPos: 1,
            equipeAId: losers[0],
            equipeBId: losers[1],
            statut: StatutPartie.A_JOUER,
            tour: 3,
          },
        });
        await this.assignTerrainToMatch(newPetiteFinale.id, concoursId);
        console.log(`[BRACKET] ✅ Created Petite Finale at R${finaleRonde} P1`);
      } else {
        console.log(`[BRACKET] Petite Finale already exists at R${finaleRonde} P1`);
      }
    } else {
      console.log(
        `[BRACKET] Only ${demiFinales.length} Semi-Finals completed, need 2 to create Finals`,
      );
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
      allMatches.filter((m) => m.id !== partieId && m.terrainId).map((m) => m.terrainId!),
    );

    const availableTerrain = terrains.find((t) => !occupiedTerrainIds.has(t.id));

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

  private calculateBracketRonde(matchCount: number): number {
    if (matchCount === 1) return 6;
    if (matchCount === 2) return 5;
    if (matchCount === 4) return 4;
    if (matchCount === 8) return 3;
    if (matchCount === 16) return 2;
    return 1;
  }

  private calculateConsolanteBracketRonde(matchCount: number): number {
    return 5;
  }

  private nextPowerOfTwo(n: number): number {
    let power = 1;
    while (power < n) {
      power *= 2;
    }
    return power;
  }
}
