import {
  tirageMelee,
  generateBracket,
  generatePoolAssignments,
  generateRoundRobin,
  nextPowerOfTwo,
  EquipeInfo,
} from './tirage.service';

function makeEquipe(id: string, victoires = 0, club?: string, adversaires: string[] = []): EquipeInfo {
  return { id, victoires, club, adversairesDejaRencontres: adversaires };
}

describe('tirageMelee', () => {
  it('should pair all teams when even count', () => {
    const equipes = [
      makeEquipe('A', 2), makeEquipe('B', 2),
      makeEquipe('C', 1), makeEquipe('D', 1),
    ];
    const result = tirageMelee(equipes, 2, 'seed1');
    expect(result.appariements).toHaveLength(2);
    expect(result.byeEquipeId).toBeUndefined();
  });

  it('should assign a bye when odd number of teams', () => {
    const equipes = [
      makeEquipe('A', 2), makeEquipe('B', 1), makeEquipe('C', 1),
    ];
    const result = tirageMelee(equipes, 2, 'seed2');
    const pairs = result.appariements.filter((a) => !a.isBye);
    expect(pairs).toHaveLength(1);
    expect(result.byeEquipeId).toBeDefined();
  });

  it('bye is 13-0 to the bye team — tracked in result', () => {
    const equipes = [makeEquipe('A'), makeEquipe('B'), makeEquipe('C')];
    const result = tirageMelee(equipes, 1, 'seed3');
    const bye = result.appariements.find((a) => a.isBye);
    expect(bye).toBeDefined();
    expect(bye!.equipeBId).toBe('BYE');
  });

  it('should avoid rematches when possible', () => {
    const equipes = [
      makeEquipe('A', 1, undefined, ['B']),
      makeEquipe('B', 1, undefined, ['A']),
      makeEquipe('C', 1),
      makeEquipe('D', 1),
    ];
    const result = tirageMelee(equipes, 2, 'seed4');
    const pairs = result.appariements.filter((a) => !a.isBye);
    for (const pair of pairs) {
      expect(
        (pair.equipeAId === 'A' && pair.equipeBId === 'B') ||
        (pair.equipeAId === 'B' && pair.equipeBId === 'A'),
      ).toBe(false);
    }
  });

  it('should fallback to rematch if no other option', () => {
    const equipes = [
      makeEquipe('A', 1, undefined, ['B']),
      makeEquipe('B', 1, undefined, ['A']),
    ];
    const result = tirageMelee(equipes, 2, 'seed5');
    expect(result.appariements).toHaveLength(1);
  });

  it('should avoid same club in early rounds when option enabled', () => {
    const equipes = [
      makeEquipe('A', 0, 'ClubX'),
      makeEquipe('B', 0, 'ClubX'),
      makeEquipe('C', 0, 'ClubY'),
      makeEquipe('D', 0, 'ClubY'),
    ];
    const result = tirageMelee(equipes, 1, 'seed6', { eviterMemeClub: true });
    const pairs = result.appariements.filter((a) => !a.isBye);
    for (const pair of pairs) {
      const clubA = equipes.find((e) => e.id === pair.equipeAId)?.club;
      const clubB = equipes.find((e) => e.id === pair.equipeBId)?.club;
      expect(clubA).not.toBe(clubB);
    }
  });

  it('groups teams by wins and pairs within groups first', () => {
    const equipes = [
      makeEquipe('A', 3), makeEquipe('B', 3),
      makeEquipe('C', 1), makeEquipe('D', 1),
    ];
    const result = tirageMelee(equipes, 4, 'seed7');
    const pairs = result.appariements.filter((a) => !a.isBye);
    const abPair = pairs.find(
      (p) =>
        (p.equipeAId === 'A' || p.equipeAId === 'B') &&
        (p.equipeBId === 'A' || p.equipeBId === 'B'),
    );
    const cdPair = pairs.find(
      (p) =>
        (p.equipeAId === 'C' || p.equipeAId === 'D') &&
        (p.equipeBId === 'C' || p.equipeBId === 'D'),
    );
    expect(abPair).toBeDefined();
    expect(cdPair).toBeDefined();
  });

  it('is deterministic with the same seed', () => {
    const equipes = [
      makeEquipe('A', 1), makeEquipe('B', 1),
      makeEquipe('C', 0), makeEquipe('D', 0),
    ];
    const r1 = tirageMelee(equipes, 2, 'deterministic');
    const r2 = tirageMelee(equipes, 2, 'deterministic');
    expect(r1.appariements).toEqual(r2.appariements);
  });

  it('produces different results with different seeds', () => {
    const equipes = [
      makeEquipe('A', 1), makeEquipe('B', 1),
      makeEquipe('C', 1), makeEquipe('D', 1),
      makeEquipe('E', 1), makeEquipe('F', 1),
    ];
    const r1 = tirageMelee(equipes, 2, 'seedX');
    const r2 = tirageMelee(equipes, 2, 'seedY');
    const same = JSON.stringify(r1.appariements) === JSON.stringify(r2.appariements);
    expect(same).toBe(false);
  });

  it('handles 2 teams', () => {
    const equipes = [makeEquipe('A', 0), makeEquipe('B', 0)];
    const result = tirageMelee(equipes, 1, 'seed8');
    expect(result.appariements).toHaveLength(1);
  });

  it('handles large number of teams', () => {
    const equipes = Array.from({ length: 32 }, (_, i) => makeEquipe(`E${i}`, i % 5));
    const result = tirageMelee(equipes, 3, 'seed9');
    expect(result.appariements).toHaveLength(16);
    expect(result.byeEquipeId).toBeUndefined();
  });
});

describe('nextPowerOfTwo', () => {
  it('returns correct values', () => {
    expect(nextPowerOfTwo(1)).toBe(1);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(4)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(9)).toBe(16);
  });
});

describe('generateBracket', () => {
  it('fills to next power of 2 with byes', () => {
    const ids = ['A', 'B', 'C', 'D', 'E'];
    const slots = generateBracket(ids, 'seed');
    expect(slots).toHaveLength(8);
    const byes = slots.filter((s) => s.isBye);
    expect(byes).toHaveLength(3);
  });

  it('no byes when power of 2', () => {
    const ids = ['A', 'B', 'C', 'D'];
    const slots = generateBracket(ids, 'seed');
    expect(slots).toHaveLength(4);
    expect(slots.filter((s) => s.isBye)).toHaveLength(0);
  });

  it('is deterministic', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const r1 = generateBracket(ids, 'x');
    const r2 = generateBracket(ids, 'x');
    expect(r1).toEqual(r2);
  });
});

describe('generatePoolAssignments', () => {
  it('creates correct number of pools', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const pools = generatePoolAssignments(ids, 4, 'seed');
    expect(pools.length).toBe(2);
    pools.forEach((p) => expect(p.length).toBeGreaterThanOrEqual(2));
  });

  it('distributes all teams', () => {
    const ids = Array.from({ length: 13 }, (_, i) => `T${i}`);
    const pools = generatePoolAssignments(ids, 4, 'seed');
    const total = pools.reduce((s, p) => s + p.length, 0);
    expect(total).toBe(13);
  });

  it('is deterministic', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const r1 = generatePoolAssignments(ids, 3, 'seed');
    const r2 = generatePoolAssignments(ids, 3, 'seed');
    expect(r1).toEqual(r2);
  });
});

describe('generateRoundRobin', () => {
  it('generates correct number of pairs for 4 teams', () => {
    const pairs = generateRoundRobin(['A', 'B', 'C', 'D']);
    expect(pairs).toHaveLength(6);
  });

  it('generates correct number of pairs for 3 teams', () => {
    const pairs = generateRoundRobin(['A', 'B', 'C']);
    expect(pairs).toHaveLength(3);
  });

  it('each team faces every other team exactly once', () => {
    const ids = ['A', 'B', 'C', 'D'];
    const pairs = generateRoundRobin(ids);
    for (const id of ids) {
      const count = pairs.filter((p) => p[0] === id || p[1] === id).length;
      expect(count).toBe(ids.length - 1);
    }
  });
});
