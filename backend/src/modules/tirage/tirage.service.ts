export interface EquipeInfo {
  id: string;
  club?: string | null;
  victoires: number;
  adversairesDejaRencontres: string[];
}

export interface Appariement {
  equipeAId: string;
  equipeBId: string;
  isBye?: boolean;
}

export interface TirageResult {
  appariements: Appariement[];
  seed: string;
  byeEquipeId?: string;
}

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seededRng(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
    h |= 0;
  }
  return (): number => {
    h ^= h >>> 13;
    h ^= h << 17;
    h ^= h >>> 5;
    return ((h >>> 0) / 0xffffffff);
  };
}

function haveAlreadyMet(a: string, b: string, equipes: Map<string, EquipeInfo>): boolean {
  const ea = equipes.get(a);
  return ea?.adversairesDejaRencontres.includes(b) ?? false;
}

function tryPair(
  ids: string[],
  equipes: Map<string, EquipeInfo>,
  eviterMemeClub: boolean,
  tour: number,
): Appariement[] | null {
  if (ids.length === 0) return [];
  if (ids.length % 2 !== 0) return null;

  const [first, ...rest] = ids;
  for (let i = 0; i < rest.length; i++) {
    const second = rest[i];
    const alreadyMet = haveAlreadyMet(first, second, equipes);
    const sameClub =
      eviterMemeClub &&
      tour <= 2 &&
      equipes.get(first)?.club &&
      equipes.get(first)?.club === equipes.get(second)?.club;

    if (!alreadyMet && !sameClub) {
      const remaining = rest.filter((_, idx) => idx !== i);
      const subResult = tryPair(remaining, equipes, eviterMemeClub, tour);
      if (subResult !== null) {
        return [{ equipeAId: first, equipeBId: second }, ...subResult];
      }
    }
  }

  for (let i = 0; i < rest.length; i++) {
    const second = rest[i];
    const alreadyMet = haveAlreadyMet(first, second, equipes);
    if (!alreadyMet) {
      const remaining = rest.filter((_, idx) => idx !== i);
      const subResult = tryPair(remaining, equipes, false, tour);
      if (subResult !== null) {
        return [{ equipeAId: first, equipeBId: second }, ...subResult];
      }
    }
  }

  const [fallback, ...fallbackRest] = rest;
  const subResult = tryPair(fallbackRest, equipes, false, tour);
  if (subResult !== null) {
    return [{ equipeAId: first, equipeBId: fallback }, ...subResult];
  }
  return null;
}

export function tirageMelee(
  equipes: EquipeInfo[],
  tour: number,
  seed: string,
  options: { eviterMemeClub?: boolean } = {},
): TirageResult {
  const rng = seededRng(seed);
  const equipeMap = new Map<string, EquipeInfo>(equipes.map((e) => [e.id, e]));
  const actives = equipes.filter((e) => true);

  const byGroups = new Map<number, EquipeInfo[]>();
  for (const eq of actives) {
    const group = byGroups.get(eq.victoires) ?? [];
    group.push(eq);
    byGroups.set(eq.victoires, group);
  }

  const sortedVictoires = [...byGroups.keys()].sort((a, b) => b - a);
  let ordered: EquipeInfo[] = [];
  for (const v of sortedVictoires) {
    ordered = [...ordered, ...shuffleArray(byGroups.get(v)!, rng)];
  }

  let byeEquipeId: string | undefined;
  let pairingIds: string[];

  if (ordered.length % 2 === 1) {
    const lowestGroup = byGroups.get(sortedVictoires[sortedVictoires.length - 1])!;
    const shuffledLowest = shuffleArray(lowestGroup, rng);
    const byeEquipe = shuffledLowest[0];
    byeEquipeId = byeEquipe.id;
    pairingIds = ordered.filter((e) => e.id !== byeEquipeId).map((e) => e.id);
  } else {
    pairingIds = ordered.map((e) => e.id);
  }

  const pairs = tryPair(pairingIds, equipeMap, options.eviterMemeClub ?? false, tour);

  const appariements: Appariement[] = pairs ?? [];
  if (byeEquipeId) {
    appariements.push({ equipeAId: byeEquipeId, equipeBId: 'BYE', isBye: true });
  }

  return { appariements, seed, byeEquipeId };
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export interface BracketSlot {
  position: number;
  equipeId: string | null;
  isBye: boolean;
}

export function generateBracket(
  equipeIds: string[],
  seed: string,
  preserveOrder = false,
): BracketSlot[] {
  const rng = seededRng(seed);
  const ordered = preserveOrder ? equipeIds : shuffleArray(equipeIds, rng);
  const size = nextPowerOfTwo(ordered.length);
  const numByes = size - ordered.length;

  if (numByes === 0) {
    return ordered.map((id, i) => ({ position: i, equipeId: id, isBye: false }));
  }

  if (preserveOrder) {
    const slots: BracketSlot[] = [];
    
    // Distribute byes evenly to avoid adjacent byes
    // For N byes in size slots, place them at positions: 0, size/numByes, 2*size/numByes, etc.
    const byePositions = new Set<number>();
    if (numByes > 0) {
      const spacing = size / numByes;
      for (let i = 0; i < numByes; i++) {
        const pos = Math.floor(i * spacing);
        byePositions.add(pos);
      }
    }
    
    // Fill slots
    let teamIndex = 0;
    for (let i = 0; i < size; i++) {
      if (byePositions.has(i)) {
        slots.push({ position: i, equipeId: null, isBye: true });
      } else {
        slots.push({ position: i, equipeId: ordered[teamIndex++], isBye: false });
      }
    }
    
    return slots;
  }

  // Distribute byes evenly so no two byes are adjacent.
  // Strategy: divide the bracket into `numByes` equal bands and place one bye
  // near the centre of each band. The band width is `size / numByes` which is
  // always ≥ 2 (since numByes ≤ size/2 for any valid bracket), so consecutive
  // bye positions are guaranteed to differ by at least 2.
  const bandSize = size / numByes;
  const byeSet = new Set<number>();
  for (let i = 0; i < numByes; i++) {
    const pos = Math.round(i * bandSize + (bandSize - 1) / 2);
    byeSet.add(Math.min(pos, size - 1));
  }

  const slots: BracketSlot[] = [];
  let teamIndex = 0;
  for (let i = 0; i < size; i++) {
    if (byeSet.has(i)) {
      slots.push({ position: i, equipeId: null, isBye: true });
    } else {
      slots.push({ position: i, equipeId: ordered[teamIndex++], isBye: false });
    }
  }

  return slots;
}

export function generatePoolAssignments(
  equipeIds: string[],
  taillePoule: number,
  seed: string,
): string[][] {
  const rng = seededRng(seed);
  const shuffled = shuffleArray(equipeIds, rng);
  const nbEquipes = shuffled.length;
  const nbPoules = Math.floor(nbEquipes / taillePoule);
  const remainder = nbEquipes % taillePoule;

  const pools: string[][] = Array.from({ length: Math.max(nbPoules, 1) }, () => []);
  let idx = 0;
  for (let i = 0; i < shuffled.length; i++) {
    const poolIdx = idx % pools.length;
    pools[poolIdx].push(shuffled[i]);
    idx++;
  }

  void remainder;
  return pools.filter((p) => p.length >= 2);
}

/**
 * Groupe des joueurs individuels en équipes pour les modes Mêlée et Mêlée-Démêlée.
 *
 * Algorithme :
 *  - Mélanger aléatoirement tous les joueurs
 *  - Former des équipes de `tailleEquipe` joueurs
 *  - Si un reste existe (< tailleEquipe), créer une dernière équipe avec ces joueurs
 *  - IMPORTANT : jamais d'équipe avec plus de `tailleEquipe` joueurs
 *
 * @param joueurIds   IDs des joueurs inscrits (1 par entrée)
 * @param tailleEquipe  Taille cible (1, 2 ou 3)
 * @param seed        Graine déterministe
 * @returns           Tableau de groupes de joueurIds
 */
export function constituerEquipesMelee(
  joueurIds: string[],
  tailleEquipe: number,
  seed: string,
): string[][] {
  if (tailleEquipe <= 1) return joueurIds.map((id) => [id]);

  const rng = seededRng(seed);
  const shuffled = shuffleArray(joueurIds, rng);
  const equipes: string[][] = [];

  for (let i = 0; i < shuffled.length; i += tailleEquipe) {
    const groupe = shuffled.slice(i, i + tailleEquipe);
    equipes.push(groupe);
  }

  return equipes;
}

export function generateRoundRobin(equipeIds: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < equipeIds.length; i++) {
    for (let j = i + 1; j < equipeIds.length; j++) {
      pairs.push([equipeIds[i], equipeIds[j]]);
    }
  }
  return pairs;
}

export interface PoolMatchData {
  equipeAId: string;
  equipeBId: string;
  scoreA: number | null;
  scoreB: number | null;
}

export interface RankingEntry {
  equipeId: string;
  victoires: number;
  defaites: number;
  pointsMarques: number;
  pointsEncaisses: number;
  quotient: number;
}

export function calculatePoolRankings(matches: PoolMatchData[]): RankingEntry[] {
  const stats = new Map<string, RankingEntry>();

  for (const match of matches) {
    const { equipeAId, equipeBId, scoreA, scoreB } = match;

    if (!stats.has(equipeAId)) {
      stats.set(equipeAId, {
        equipeId: equipeAId,
        victoires: 0,
        defaites: 0,
        pointsMarques: 0,
        pointsEncaisses: 0,
        quotient: 0,
      });
    }
    if (!stats.has(equipeBId)) {
      stats.set(equipeBId, {
        equipeId: equipeBId,
        victoires: 0,
        defaites: 0,
        pointsMarques: 0,
        pointsEncaisses: 0,
        quotient: 0,
      });
    }

    const statsA = stats.get(equipeAId)!;
    const statsB = stats.get(equipeBId)!;

    statsA.pointsMarques += scoreA || 0;
    statsA.pointsEncaisses += scoreB || 0;
    statsB.pointsMarques += scoreB || 0;
    statsB.pointsEncaisses += scoreA || 0;

    if ((scoreA || 0) > (scoreB || 0)) {
      statsA.victoires++;
      statsB.defaites++;
    } else if ((scoreB || 0) > (scoreA || 0)) {
      statsB.victoires++;
      statsA.defaites++;
    }
  }

  const rankings = Array.from(stats.values()).map((s) => {
    s.quotient = s.pointsEncaisses === 0 ? s.pointsMarques : s.pointsMarques / s.pointsEncaisses;
    return s;
  });

  return rankings.sort((a, b) => {
    if (a.victoires !== b.victoires) return b.victoires - a.victoires;
    if (a.quotient !== b.quotient) return b.quotient - a.quotient;
    return b.pointsMarques - a.pointsMarques;
  });
}
