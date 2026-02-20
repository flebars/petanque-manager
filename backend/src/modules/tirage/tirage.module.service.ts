import { Injectable } from '@nestjs/common';
import {
  tirageMelee,
  generateBracket,
  generatePoolAssignments,
  generateRoundRobin,
  EquipeInfo,
  TirageResult,
  BracketSlot,
} from './tirage.service';

@Injectable()
export class TirageService {
  melee(
    equipes: EquipeInfo[],
    tour: number,
    options?: { eviterMemeClub?: boolean },
  ): TirageResult {
    const seed = `${Date.now()}-${Math.random()}`;
    return tirageMelee(equipes, tour, seed, options);
  }

  bracket(equipeIds: string[]): BracketSlot[] {
    const seed = `${Date.now()}-${Math.random()}`;
    return generateBracket(equipeIds, seed);
  }

  pools(equipeIds: string[], taillePoule: number): string[][] {
    const seed = `${Date.now()}-${Math.random()}`;
    return generatePoolAssignments(equipeIds, taillePoule, seed);
  }

  roundRobin(equipeIds: string[]): Array<[string, string]> {
    return generateRoundRobin(equipeIds);
  }
}
