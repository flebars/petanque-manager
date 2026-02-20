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
): BracketSlot[] {
  const rng = seededRng(seed);
  const shuffled = shuffleArray(equipeIds, rng);
  const size = nextPowerOfTwo(shuffled.length);
  const slots: BracketSlot[] = [];

  for (let i = 0; i < size; i++) {
    slots.push({
      position: i,
      equipeId: shuffled[i] ?? null,
      isBye: shuffled[i] === undefined,
    });
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
 * Algorithme (spec §2) :
 *  - Mélanger aléatoirement tous les joueurs
 *  - Former des équipes de `tailleEquipe` joueurs
 *  - Si le reste est > 0 et < tailleEquipe : constituer la dernière équipe
 *    avec (tailleEquipe - 1) joueurs (jamais moins)
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
  let i = 0;

  while (i < shuffled.length) {
    const remaining = shuffled.length - i;
    if (remaining >= tailleEquipe) {
      equipes.push(shuffled.slice(i, i + tailleEquipe));
      i += tailleEquipe;
    } else {
      // Dernier groupe incomplet : taille (tailleEquipe - 1) minimum
      equipes.push(shuffled.slice(i));
      break;
    }
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
