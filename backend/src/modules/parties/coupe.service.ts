import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
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
    @Inject('REDIS_CLIENT') private redis: Redis,
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

      //Progression du tour 1 pour les équipes ayant un bye, et émission de l'événement de démarrage du tour
      const byeTeam = await this.prisma.equipe.findFirst({
        where: { concoursId: concoursId, nom: '__BYE__' },
      });
      const byeTeamId = byeTeam?.id ?? null;
      const byeMatches = parties.filter(
        (p) => p.equipeAId === byeTeamId || p.equipeBId === byeTeamId,
      );

      for (const byeMatch of byeMatches) {
        await this.progresserMatchBracket(byeMatch);
      }

      this.eventsGateway.emitTourDemarre(concoursId, 1);

      return parties;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async progresserMatchBracket(completedMatch: Partie): Promise<void> {
    // ====== VALIDATION ======
    if (
      !completedMatch.bracketRonde ||
      completedMatch.bracketPos === null ||
      completedMatch.bracketPos === undefined
    ) {
      return;
    }

    // Resolve the __BYE__ team id once for all checks below
    const byeTeam = await this.prisma.equipe.findFirst({
      where: { concoursId: completedMatch.concoursId, nom: '__BYE__' },
    });
    const byeTeamId = byeTeam?.id ?? null;

    // ====== BYE HANDLING ======
    // A bye match has the real team as equipeA and the __BYE__ fake team as equipeB
    const isByeMatch = byeTeamId !== null && (completedMatch.equipeBId === byeTeamId || completedMatch.equipeAId === byeTeamId);
    let loserId: string;
    let winnerId: string;
    if (isByeMatch) {
      winnerId = completedMatch.equipeBId === byeTeamId ? completedMatch.equipeAId : completedMatch.equipeBId;
      loserId = completedMatch.equipeBId === byeTeamId ? completedMatch.equipeBId : completedMatch.equipeAId;
    }
    else {

      // ====== DETERMINE WINNER/LOSER ======
      winnerId =
        (completedMatch.scoreA ?? 0) > (completedMatch.scoreB ?? 0)
          ? completedMatch.equipeAId
          : completedMatch.equipeBId;

      loserId =
        winnerId === completedMatch.equipeAId ? completedMatch.equipeBId : completedMatch.equipeAId;
    }
    // ====== CONSOLANTE HANDLING (ROUND 1 LOSERS ONLY) ======
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

    // ====== FINALS: NO FURTHER PROGRESSION ======
    // bracketRonde 6 is the finals round (Grande Finale + Petite Finale).
    // Completing either final ends the tournament; no new match must be created.
    if (completedMatch.bracketRonde === 6) {
      console.log(
        `[BRACKET] Finals match completed at R6 P${completedMatch.bracketPos} — tournament ends here.`,
      );
      return;
    }

    // ====== CALCULATE NEXT MATCH POSITION ======
    const nextBracketRonde = completedMatch.bracketRonde + 1;
    const nextBracketPos = Math.floor(completedMatch.bracketPos / 2);
    const isTeamA = completedMatch.bracketPos % 2 === 0;

    console.log(
      `[BRACKET] Progressing winner: type=${completedMatch.type}, ` +
        `currentRonde=${completedMatch.bracketRonde}, nextRonde=${nextBracketRonde}, ` +
        `nextPos=${nextBracketPos}, isTeamA=${isTeamA}, winnerId=${winnerId}, loserId=${loserId}`,
    );

    // ====== PROGRESS WINNER TO NEXT ROUND ======
    await this.createOrUpdateNextMatch(
      completedMatch.concoursId,
      completedMatch.type!,
      nextBracketRonde,
      nextBracketPos,
      winnerId,
      isTeamA,
    );

    // ====== PETITE FINALE (3RD PLACE MATCH) ======
    // Only progress losers from semi-finals (bracketRonde = 5) to Petite Finale
    if (completedMatch.bracketRonde === 5) {
      console.log(
        `[BRACKET] Semi-final completed, progressing loser to Petite Finale: ` +
          `loserId=${loserId}, nextRonde=${nextBracketRonde}, position=1`,
      );

      await this.createOrUpdateNextMatch(
        completedMatch.concoursId,
        completedMatch.type!,
        nextBracketRonde,
        1,
        loserId,
        isTeamA,
      );
    }
  }

  private async creerBracketPrincipal(concoursId: string): Promise<Partie[]> {
    const equipes = await this.prisma.equipe.findMany({
      where: {
        concoursId,
        statut: { in: [StatutEquipe.INSCRITE, StatutEquipe.PRESENTE] },
        nom: { notIn: ['__BYE__', '__TBD__'] },
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
        const byeTeamId = await this.getOrCreateByeTeam(concoursId);

        let realTeamId = slotA.equipeId ?? slotB.equipeId;
        if (!realTeamId) realTeamId = byeTeamId;

        const byePartie = await this.prisma.partie.create({
          data: {
            concoursId,
            tour: 1,
            equipeAId: realTeamId,
            equipeBId: byeTeamId,
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

    const tour1MainMatches = await this.prisma.partie.findMany({
      where: {
        concoursId,
        tour: 1,
        type: TypePartie.COUPE_PRINCIPALE,
      },
    });

    if (tour1MainMatches.length === 0) {
      console.log('[BRACKET] No Round 1 Main matches found, skipping Consolante creation');
      return;
    }

    const expectedGames = tour1MainMatches.length / 2;

    console.log(
      `[BRACKET] Consolante: ${expectedGames} games`,
    );

    const tbdTeamId = await this.getOrCreateTbdTeam(concoursId);

    const terrains = await this.prisma.terrain.findMany({
      where: { concoursId },
      orderBy: { numero: 'asc' },
    });

    if (terrains.length === 0) {
      console.log('[BRACKET] No terrains available for Consolante');
      return;
    }

    const bracketRonde = this.calculateConsolanteBracketRonde(expectedGames);

    console.log(`[BRACKET] Creating ${expectedGames} Consolante matches at round ${bracketRonde}`);

    const createdMatches: Partie[] = [];
    for (let matchIndex = 0; matchIndex < expectedGames; matchIndex++) {
      const partie = await this.prisma.partie.create({
        data: {
          concoursId,
          tour: 1,
          equipeAId: tbdTeamId,
          equipeBId: tbdTeamId,
          statut: StatutPartie.A_MONTER,
          type: TypePartie.COUPE_CONSOLANTE,
          bracketRonde,
          bracketPos: matchIndex,
          terrainId: null,
        },
      });
      createdMatches.push(partie);
      console.log(`[BRACKET] Created Consolante A_MONTER match at R${bracketRonde} P${matchIndex}`);
    
    }

    console.log(`[BRACKET] ✅ Created ${createdMatches.length} Consolante A_MONTER matches`);
  }

  private async addLoserToConsolante(
    concoursId: string,
    loserId: string,
    mainBracketPos: number,
  ): Promise<void> {
    console.log(`[BRACKET] Adding loser ${loserId} from Main P${mainBracketPos} to Consolante`);

    const consolantePos = Math.floor(mainBracketPos / 2);
    const isTeamA = mainBracketPos % 2 === 0;

    const tbdTeam = await this.prisma.equipe.findFirst({
      where: { concoursId, nom: '__TBD__' },
    });

    if (!tbdTeam) {
      console.error('[BRACKET] TBD team not found!');
      return;
    }

    const consolanteMatches = await this.prisma.partie.findMany({
      where: {
        concoursId,
        type: TypePartie.COUPE_CONSOLANTE,
        tour: 1,
      },
      orderBy: { bracketPos: 'asc' },
    });

    if (consolanteMatches.length === 0) {
      console.error('[BRACKET] No Consolante matches found!');
      return;
    }

    const targetMatch = consolanteMatches.find((m) => m.bracketPos === consolantePos);

    if (!targetMatch) {
      console.error(`[BRACKET] Consolante match not found at position ${consolantePos}`);
      return;
    }

    console.log(
      `[BRACKET] Found Consolante match R${targetMatch.bracketRonde} P${consolantePos}, assigning to team${isTeamA ? 'A' : 'B'}`,
    );

    const updateData: any = {};

    if (isTeamA && targetMatch.equipeAId === tbdTeam.id) {
      updateData.equipeAId = loserId;
    } else if (!isTeamA && targetMatch.equipeBId === tbdTeam.id) {
      updateData.equipeBId = loserId;
    } else {
      console.log(`[BRACKET] Team slot already filled, skipping`);
      return;
    }

    await this.prisma.partie.update({
      where: { id: targetMatch.id },
      data: updateData,
    });

    console.log(`[BRACKET] Updated Consolante match with loser ${loserId}`);

    const updatedMatch = await this.prisma.partie.findUnique({
      where: { id: targetMatch.id },
    });

    if (!updatedMatch) return;

    const bothTeamsAssigned =
      updatedMatch.equipeAId !== tbdTeam.id && updatedMatch.equipeBId !== tbdTeam.id;

    if (!bothTeamsAssigned) {
      console.log(`[BRACKET] Consolante match still waiting for other team`);
      return;
    }

    // A consolante bye occurs when one of the two losers was itself a bye winner —
    // i.e. the loser slot got filled with the __BYE__ team id
    const consolanteByeTeam = await this.prisma.equipe.findFirst({
      where: { concoursId, nom: '__BYE__' },
    });
    const isBye =
      consolanteByeTeam !== null &&
      (updatedMatch.equipeAId === consolanteByeTeam.id ||
        updatedMatch.equipeBId === consolanteByeTeam.id);

    if (isBye) {
      await this.prisma.partie.update({
        where: { id: updatedMatch.id },
        data: {
          scoreA: 13,
          scoreB: 0,
          statut: StatutPartie.TERMINEE,
          heureFin: new Date(),
        },
      });
      console.log(
        `[BRACKET] ✅ Consolante bye match auto-completed at R${updatedMatch.bracketRonde} P${consolantePos}`,
      );

      await this.progresserMatchBracket(updatedMatch);
    } else {
      await this.assignTerrainToMatch(updatedMatch.id, concoursId);
      await this.prisma.partie.update({
        where: { id: updatedMatch.id },
        data: { 
          statut: StatutPartie.A_JOUER,
          tour: 1
        },
      });
      console.log(
        `[BRACKET] ✅ Consolante match R${updatedMatch.bracketRonde} P${consolantePos} ready to play`,
      );

      this.eventsGateway.emitScoreValide(concoursId, updatedMatch);
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

    let existingMatch = await this.prisma.partie.findFirst({
      where: {
        concoursId,
        type,
        bracketRonde: nextBracketRonde,
        bracketPos: nextBracketPos,
      },
    });

    // If the match doesn't exist, create it
    if(!existingMatch) {
      console.log(`[BRACKET] No existing match, creating placeholder with TBD teams`);

      const tbdTeamId = await this.getOrCreateTbdTeam(concoursId);

      existingMatch = await this.prisma.partie.create({
        data: {
          concoursId,
          type,
          bracketRonde: nextBracketRonde,
          bracketPos: nextBracketPos,
          equipeAId: tbdTeamId,
          equipeBId: tbdTeamId,
          statut: StatutPartie.A_MONTER,
          tour: Math.ceil(nextBracketRonde / 2),
        },
      });
    }

    console.log(`[BRACKET] Match already exists, updating...`, {
      currentA: existingMatch.equipeAId,
      currentB: existingMatch.equipeBId,
    });

    const updateData: any = {};
    // assign winner to the correct slot (A or B) based on isTeamA
    if (isTeamA) {
      updateData.equipeAId = winnerId;
    } else {
      updateData.equipeBId = winnerId;
    }

    if (Object.keys(updateData).length > 0) {
      console.log(`[BRACKET] Updating with:`, updateData);
      await this.prisma.partie.update({
        where: { id: existingMatch.id },
        data: updateData,
      });
    }

    // Check if the match is now ready to be played (both teams assigned, neither TBD nor BYE)
    const tbdTeam = await this.prisma.equipe.findFirst({
      where: { concoursId, nom: '__TBD__' },
    });
    const byeTeam = await this.prisma.equipe.findFirst({
      where: { concoursId, nom: '__BYE__' },
    });

    const updatedMatch = await this.prisma.partie.findUnique({
      where: { id: existingMatch.id },
    });

    if (updatedMatch) {
      const isRealTeamA =
        updatedMatch.equipeAId !== tbdTeam?.id && updatedMatch.equipeAId !== byeTeam?.id;
      const isRealTeamB =
        updatedMatch.equipeBId !== tbdTeam?.id && updatedMatch.equipeBId !== byeTeam?.id;

      if (isRealTeamA && isRealTeamB && !updatedMatch.terrainId && updatedMatch.statut === StatutPartie.A_MONTER) {
        console.log(`[BRACKET] Both teams ready, assigning terrain and marking A_JOUER`);
        await this.assignTerrainToMatch(updatedMatch.id, concoursId);
        await this.prisma.partie.update({
          where: { id: updatedMatch.id },
          data: { statut: StatutPartie.A_JOUER },
        });
      }
    }
  }

  // ============================================================================
  // DEPRECATED: createOrUpdateFinale (commented out for potential rollback)
  // This function has been replaced by the simplified progression logic in
  // progresserMatchBracket which uses createOrUpdateNextMatch for all rounds.
  // ============================================================================
  /*
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
  */
  // ============================================================================

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
    if (matchCount === 1) return 6;
    if (matchCount === 2) return 5;
    if (matchCount === 4) return 4;
    if (matchCount === 8) return 3;
    if (matchCount === 16) return 2;
    return 1;
  }

  private nextPowerOfTwo(n: number): number {
    let power = 1;
    while (power < n) {
      power *= 2;
    }
    return power;
  }

  private async getOrCreateByeTeam(concoursId: string): Promise<string> {
    return this.getOrCreatePlaceholderTeam(concoursId, '__BYE__');
  }

  async getOrCreateByeTeamPublic(concoursId: string): Promise<string> {
    return this.getOrCreatePlaceholderTeam(concoursId, '__BYE__');
  }

  private async getOrCreatePlaceholderTeam(concoursId: string, nom: string): Promise<string> {
    const existing = await this.prisma.equipe.findFirst({
      where: { concoursId, nom, statut: StatutEquipe.INSCRITE },
    });
    if (existing) return existing.id;
    const team = await this.prisma.equipe.create({
      data: { concoursId, nom, statut: StatutEquipe.INSCRITE, tour: null },
    });
    console.log(`[BRACKET] Created ${nom} placeholder team: ${team.id}`);
    return team.id;
  }

  private async getOrCreateTbdTeam(concoursId: string): Promise<string> {
    return this.getOrCreatePlaceholderTeam(concoursId, '__TBD__');
  }
}
