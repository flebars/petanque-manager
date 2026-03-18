import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChampionnatService } from './championnat.service';
import { CoupeService } from './coupe.service';
import { PrismaService } from '@/prisma/prisma.service';
import { EventsGateway } from '@/modules/gateway/events.gateway';
import { StatutPartie, TypePartie, StatutEquipe, FormatConcours } from '@prisma/client';

const mockRedis = {
  set: jest.fn(),
  del: jest.fn(),
};

const mockPrisma = {
  concours: {
    findUnique: jest.fn(),
  },
  equipe: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  poule: {
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  partie: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  terrain: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockEventsGateway = {
  emitTourDemarre: jest.fn(),
};

const mockCoupeService = {
  progresserMatchBracket: jest.fn(),
};

function makeConcours(overrides = {}) {
  return {
    id: 'concours-1',
    format: FormatConcours.CHAMPIONNAT,
    statut: 'EN_COURS',
    params: { taillePoule: 4 },
    equipes: [],
    poules: [],
    ...overrides,
  };
}

function makeEquipe(id: string, concoursId = 'concours-1') {
  return {
    id,
    concoursId,
    nom: `Team ${id}`,
    statut: StatutEquipe.PRESENTE,
  };
}

function makePoule(id: string, numero: number) {
  return {
    id,
    numero,
    concoursId: 'concours-1',
    statut: 'EN_COURS',
    equipes: [],
    parties: [],
  };
}

function makePoolMatch(
  id: string,
  pouleId: string,
  equipeAId: string,
  equipeBId: string,
  scoreA: number | null = 13,
  scoreB: number | null = 0,
  statut: StatutPartie = StatutPartie.TERMINEE,
) {
  return {
    id,
    concoursId: 'concours-1',
    pouleId,
    tour: 1,
    equipeAId,
    equipeBId,
    scoreA,
    scoreB,
    statut,
    type: TypePartie.CHAMPIONNAT_POULE,
    terrainId: 'terrain-1',
  };
}

function makeTerrain(numero: number) {
  return {
    id: `terrain-${numero}`,
    concoursId: 'concours-1',
    numero,
  };
}

describe('ChampionnatService', () => {
  let service: ChampionnatService;
  let prisma: typeof mockPrisma;
  let redis: typeof mockRedis;
  let eventsGateway: typeof mockEventsGateway;
  let coupeService: typeof mockCoupeService;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChampionnatService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: CoupeService, useValue: mockCoupeService },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<ChampionnatService>(ChampionnatService);
    prisma = mockPrisma;
    redis = mockRedis;
    eventsGateway = mockEventsGateway;
    coupeService = mockCoupeService;
  });

  describe('lancerPoules', () => {
    it('should create 2 pools of 4 for 8 teams (taillePoule=4)', async () => {
      const teams = Array.from({ length: 8 }, (_, i) => makeEquipe(`eq${i}`));
      const terrains = [makeTerrain(1), makeTerrain(2), makeTerrain(3)];

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ equipes: teams, params: { taillePoule: 4 } }),
      );
      prisma.terrain.findMany.mockResolvedValue(terrains);
      redis.set.mockResolvedValue('OK');
      prisma.poule.create.mockImplementation((data) => Promise.resolve({ id: `poule-${Date.now()}`, ...data.data }));
      prisma.partie.create.mockImplementation((data) => Promise.resolve({ id: `match-${Date.now()}`, ...data.data }));

      await service.lancerPoules('concours-1');

      expect(prisma.poule.create).toHaveBeenCalledTimes(2);
      expect(prisma.partie.create).toHaveBeenCalledTimes(12);
    });

    it('should create unequal pools for 9 teams (taillePoule=4)', async () => {
      const teams = Array.from({ length: 9 }, (_, i) => makeEquipe(`eq${i}`));
      const terrains = [makeTerrain(1), makeTerrain(2)];

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ equipes: teams, params: { taillePoule: 4 } }),
      );
      prisma.terrain.findMany.mockResolvedValue(terrains);
      redis.set.mockResolvedValue('OK');
      prisma.poule.create.mockImplementation((data) => Promise.resolve({ id: `poule-${Date.now()}`, ...data.data }));
      prisma.partie.create.mockResolvedValue({});

      await service.lancerPoules('concours-1');

      expect(prisma.poule.create).toHaveBeenCalledTimes(2);
    });

    it('should assign each pool to a dedicated terrain when terrains >= pools', async () => {
      const teams = Array.from({ length: 8 }, (_, i) => makeEquipe(`eq${i}`));
      const terrains = [makeTerrain(1), makeTerrain(2), makeTerrain(3)];

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ equipes: teams, params: { taillePoule: 4 } }),
      );
      prisma.terrain.findMany.mockResolvedValue(terrains);
      redis.set.mockResolvedValue('OK');

      const createdMatches: any[] = [];
      let poolCounter = 0;
      
      prisma.poule.create.mockImplementation((data) => {
        poolCounter++;
        return Promise.resolve({ id: `poule-${poolCounter}`, numero: poolCounter, ...data.data });
      });
      
      prisma.partie.create.mockImplementation((data) => {
        createdMatches.push(data.data);
        return Promise.resolve({ id: `match-${createdMatches.length}`, ...data.data });
      });

      await service.lancerPoules('concours-1');

      const pool1Matches = createdMatches.filter(m => m.pouleId === 'poule-1');
      expect(pool1Matches.length).toBe(6);
      expect(pool1Matches.every(m => m.terrainId === 'terrain-1')).toBe(true);

      const pool2Matches = createdMatches.filter(m => m.pouleId === 'poule-2');
      expect(pool2Matches.length).toBe(6);
      expect(pool2Matches.every(m => m.terrainId === 'terrain-2')).toBe(true);
    });

    it('should wrap terrain assignment when pools > terrains (modulo)', async () => {
      const teams = Array.from({ length: 12 }, (_, i) => makeEquipe(`eq${i}`));
      const terrains = [makeTerrain(1), makeTerrain(2)];

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ equipes: teams, params: { taillePoule: 4 } }),
      );
      prisma.terrain.findMany.mockResolvedValue(terrains);
      redis.set.mockResolvedValue('OK');

      const createdMatches: any[] = [];
      let poolCounter = 0;
      
      prisma.poule.create.mockImplementation((data) => {
        poolCounter++;
        return Promise.resolve({ id: `poule-${poolCounter}`, numero: poolCounter, ...data.data });
      });
      
      prisma.partie.create.mockImplementation((data) => {
        createdMatches.push(data.data);
        return Promise.resolve({ id: `match-${createdMatches.length}`, ...data.data });
      });

      await service.lancerPoules('concours-1');

      const pool1Matches = createdMatches.filter(m => m.pouleId === 'poule-1');
      expect(pool1Matches.every(m => m.terrainId === 'terrain-1')).toBe(true);

      const pool2Matches = createdMatches.filter(m => m.pouleId === 'poule-2');
      expect(pool2Matches.every(m => m.terrainId === 'terrain-2')).toBe(true);

      const pool3Matches = createdMatches.filter(m => m.pouleId === 'poule-3');
      expect(pool3Matches.every(m => m.terrainId === 'terrain-1')).toBe(true);
    });

    it('should generate round-robin matches for each pool', async () => {
      const teams = Array.from({ length: 4 }, (_, i) => makeEquipe(`eq${i}`));
      const terrains = [makeTerrain(1)];

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ equipes: teams, params: { taillePoule: 4 } }),
      );
      prisma.terrain.findMany.mockResolvedValue(terrains);
      redis.set.mockResolvedValue('OK');
      prisma.poule.create.mockResolvedValue({ id: 'poule-1' });
      prisma.partie.create.mockResolvedValue({});

      await service.lancerPoules('concours-1');

      expect(prisma.partie.create).toHaveBeenCalledTimes(6);
    });

    it('should create matches with type CHAMPIONNAT_POULE', async () => {
      const teams = Array.from({ length: 4 }, (_, i) => makeEquipe(`eq${i}`));
      const terrains = [makeTerrain(1)];

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ equipes: teams }),
      );
      prisma.terrain.findMany.mockResolvedValue(terrains);
      redis.set.mockResolvedValue('OK');
      prisma.poule.create.mockResolvedValue({ id: 'poule-1' });
      prisma.partie.create.mockResolvedValue({});

      await service.lancerPoules('concours-1');

      expect(prisma.partie.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: TypePartie.CHAMPIONNAT_POULE,
          }),
        }),
      );
    });

    it('should set all matches to tour=1 (pool phase)', async () => {
      const teams = Array.from({ length: 4 }, (_, i) => makeEquipe(`eq${i}`));
      const terrains = [makeTerrain(1)];

      prisma.concours.findUnique.mockResolvedValue(makeConcours({ equipes: teams }));
      prisma.terrain.findMany.mockResolvedValue(terrains);
      redis.set.mockResolvedValue('OK');
      prisma.poule.create.mockResolvedValue({ id: 'poule-1' });
      prisma.partie.create.mockResolvedValue({});

      await service.lancerPoules('concours-1');

      expect(prisma.partie.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tour: 1,
          }),
        }),
      );
    });

    it('should throw BadRequestException if format is not CHAMPIONNAT', async () => {
      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ format: FormatConcours.MELEE }),
      );
      redis.set.mockResolvedValue('OK');

      await expect(service.lancerPoules('concours-1')).rejects.toThrow(BadRequestException);
      await expect(service.lancerPoules('concours-1')).rejects.toThrow("Ce concours n'est pas en format CHAMPIONNAT");
    });

    it('should throw BadRequestException if less than 2 teams', async () => {
      const teams = [makeEquipe('eq1')];

      prisma.concours.findUnique.mockResolvedValue(makeConcours({ equipes: teams }));
      redis.set.mockResolvedValue('OK');

      await expect(service.lancerPoules('concours-1')).rejects.toThrow(BadRequestException);
      await expect(service.lancerPoules('concours-1')).rejects.toThrow("Pas assez d'équipes pour créer des poules");
    });

    it('should throw NotFoundException if concours does not exist', async () => {
      prisma.concours.findUnique.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');

      await expect(service.lancerPoules('concours-1')).rejects.toThrow(NotFoundException);
    });

    it('should acquire and release Redis lock on success', async () => {
      const teams = Array.from({ length: 4 }, (_, i) => makeEquipe(`eq${i}`));

      prisma.concours.findUnique.mockResolvedValue(makeConcours({ equipes: teams }));
      prisma.terrain.findMany.mockResolvedValue([makeTerrain(1)]);
      redis.set.mockResolvedValue('OK');
      prisma.poule.create.mockResolvedValue({ id: 'poule-1' });
      prisma.partie.create.mockResolvedValue({});

      await service.lancerPoules('concours-1');

      expect(redis.set).toHaveBeenCalledWith(
        'draw:lock:concours-1:championnat:poules',
        '1',
        'EX',
        30,
        'NX',
      );
      expect(redis.del).toHaveBeenCalledWith('draw:lock:concours-1:championnat:poules');
    });

    it('should release lock on failure', async () => {
      prisma.concours.findUnique.mockRejectedValue(new Error('Database error'));
      redis.set.mockResolvedValue('OK');

      await expect(service.lancerPoules('concours-1')).rejects.toThrow('Database error');
      expect(redis.del).toHaveBeenCalledWith('draw:lock:concours-1:championnat:poules');
    });

    it('should throw if Redis lock is already held', async () => {
      redis.set.mockResolvedValue(null);

      await expect(service.lancerPoules('concours-1')).rejects.toThrow(BadRequestException);
      await expect(service.lancerPoules('concours-1')).rejects.toThrow('Tirage des poules déjà en cours');
    });

    it('should emit tourDemarre event after pool creation', async () => {
      const teams = Array.from({ length: 4 }, (_, i) => makeEquipe(`eq${i}`));

      prisma.concours.findUnique.mockResolvedValue(makeConcours({ equipes: teams }));
      prisma.terrain.findMany.mockResolvedValue([makeTerrain(1)]);
      redis.set.mockResolvedValue('OK');
      prisma.poule.create.mockResolvedValue({ id: 'poule-1' });
      prisma.partie.create.mockResolvedValue({});

      await service.lancerPoules('concours-1');

      expect(eventsGateway.emitTourDemarre).toHaveBeenCalledWith('concours-1', 1);
    });
  });

  describe('lancerPhaseFinale', () => {
    it('should throw if any pool match is not finished', async () => {
      const poule1 = makePoule('poule-1', 1);
      const matches = [
        makePoolMatch('m1', 'poule-1', 'eq1', 'eq2', 13, 5, StatutPartie.TERMINEE),
        makePoolMatch('m2', 'poule-1', 'eq3', 'eq4', null, null, StatutPartie.EN_COURS),
      ];

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ poules: [poule1] }),
      );
      prisma.partie.findMany.mockResolvedValue(matches);
      redis.set.mockResolvedValue('OK');

      await expect(service.lancerPhaseFinale('concours-1')).rejects.toThrow(BadRequestException);
      await expect(service.lancerPhaseFinale('concours-1')).rejects.toThrow('Certaines parties de poules ne sont pas encore terminées');
    });

    it('should qualify top 2 teams from each pool', async () => {
      const poule1 = {
        ...makePoule('poule-1', 1),
        parties: [
          makePoolMatch('m1', 'poule-1', 'eq1', 'eq2', 13, 5),
          makePoolMatch('m2', 'poule-1', 'eq1', 'eq3', 13, 8),
          makePoolMatch('m3', 'poule-1', 'eq2', 'eq3', 13, 7),
        ],
      };

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ poules: [poule1] }),
      );
      prisma.partie.findMany.mockImplementation(({ where }) => {
        if (where.type === TypePartie.CHAMPIONNAT_POULE) {
          return Promise.resolve(poule1.parties);
        }
        return Promise.resolve(poule1.parties);
      });
      prisma.terrain.findMany.mockResolvedValue([makeTerrain(1)]);
      prisma.equipe.findFirst.mockResolvedValue(null);
      prisma.equipe.create.mockResolvedValue({ id: 'bye-team' });
      prisma.partie.create.mockResolvedValue({});
      redis.set.mockResolvedValue('OK');

      await service.lancerPhaseFinale('concours-1');

      expect(prisma.partie.create).toHaveBeenCalled();
    });

    it('should create matches with type CHAMPIONNAT_FINALE', async () => {
      const poule1 = {
        ...makePoule('poule-1', 1),
        parties: [
          makePoolMatch('m1', 'poule-1', 'eq1', 'eq2', 13, 5),
          makePoolMatch('m2', 'poule-1', 'eq3', 'eq4', 13, 7),
        ],
      };

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ poules: [poule1] }),
      );
      prisma.partie.findMany.mockImplementation(({ where }) => {
        if (where.pouleId) return Promise.resolve(poule1.parties);
        if (where.type === TypePartie.CHAMPIONNAT_POULE) return Promise.resolve(poule1.parties);
        return Promise.resolve([]);
      });
      prisma.terrain.findMany.mockResolvedValue([makeTerrain(1)]);
      prisma.equipe.findFirst.mockResolvedValue(null);
      prisma.equipe.create.mockResolvedValue({ id: 'bye-team' });
      prisma.partie.create.mockResolvedValue({ statut: StatutPartie.A_JOUER });
      redis.set.mockResolvedValue('OK');

      await service.lancerPhaseFinale('concours-1');

      expect(prisma.partie.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: TypePartie.CHAMPIONNAT_FINALE,
          }),
        }),
      );
    });

    it('should set bracket matches to tour=2 (final phase)', async () => {
      const poule1 = {
        ...makePoule('poule-1', 1),
        parties: [
          makePoolMatch('m1', 'poule-1', 'eq1', 'eq2', 13, 5),
          makePoolMatch('m2', 'poule-1', 'eq3', 'eq4', 13, 7),
        ],
      };

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ poules: [poule1] }),
      );
      prisma.partie.findMany.mockImplementation(({ where }) => {
        if (where.pouleId) return Promise.resolve(poule1.parties);
        if (where.type === TypePartie.CHAMPIONNAT_POULE) return Promise.resolve(poule1.parties);
        return Promise.resolve([]);
      });
      prisma.terrain.findMany.mockResolvedValue([makeTerrain(1)]);
      prisma.equipe.findFirst.mockResolvedValue(null);
      prisma.equipe.create.mockResolvedValue({ id: 'bye-team' });
      prisma.partie.create.mockResolvedValue({ statut: StatutPartie.A_JOUER });
      redis.set.mockResolvedValue('OK');

      await service.lancerPhaseFinale('concours-1');

      expect(prisma.partie.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tour: 2,
          }),
        }),
      );
    });

    it('should mark all poules as TERMINE', async () => {
      const poule1 = {
        ...makePoule('poule-1', 1),
        parties: [makePoolMatch('m1', 'poule-1', 'eq1', 'eq2', 13, 5)],
      };

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ poules: [poule1] }),
      );
      prisma.partie.findMany.mockImplementation(({ where }) => {
        if (where.pouleId) return Promise.resolve(poule1.parties);
        return Promise.resolve(poule1.parties);
      });
      prisma.terrain.findMany.mockResolvedValue([makeTerrain(1)]);
      prisma.equipe.findFirst.mockResolvedValue(null);
      prisma.equipe.create.mockResolvedValue({ id: 'bye-team' });
      prisma.partie.create.mockResolvedValue({ statut: StatutPartie.A_JOUER });
      redis.set.mockResolvedValue('OK');

      await service.lancerPhaseFinale('concours-1');

      expect(prisma.poule.updateMany).toHaveBeenCalledWith({
        where: { concoursId: 'concours-1' },
        data: { statut: 'TERMINE' },
      });
    });

    it('should call progresserMatchBracket for bye matches', async () => {
      const poule1 = {
        ...makePoule('poule-1', 1),
        parties: [
          makePoolMatch('m1', 'poule-1', 'eq1', 'eq2', 13, 5),
          makePoolMatch('m2', 'poule-1', 'eq1', 'eq3', 13, 8),
          makePoolMatch('m3', 'poule-1', 'eq2', 'eq3', 13, 7),
        ],
      };
      const poule2 = {
        ...makePoule('poule-2', 2),
        parties: [
          makePoolMatch('m4', 'poule-2', 'eq4', 'eq5', 13, 6),
          makePoolMatch('m5', 'poule-2', 'eq4', 'eq6', 13, 9),
          makePoolMatch('m6', 'poule-2', 'eq5', 'eq6', 13, 8),
        ],
      };
      const poule3 = {
        ...makePoule('poule-3', 3),
        parties: [
          makePoolMatch('m7', 'poule-3', 'eq7', 'eq8', 13, 4),
          makePoolMatch('m8', 'poule-3', 'eq7', 'eq9', 13, 7),
          makePoolMatch('m9', 'poule-3', 'eq8', 'eq9', 13, 10),
        ],
      };

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ poules: [poule1, poule2, poule3] }),
      );
      prisma.partie.findMany.mockImplementation(({ where }) => {
        if (where.pouleId === 'poule-1') return Promise.resolve(poule1.parties);
        if (where.pouleId === 'poule-2') return Promise.resolve(poule2.parties);
        if (where.pouleId === 'poule-3') return Promise.resolve(poule3.parties);
        if (where.type === TypePartie.CHAMPIONNAT_POULE) {
          return Promise.resolve([...poule1.parties, ...poule2.parties, ...poule3.parties]);
        }
        return Promise.resolve([]);
      });
      prisma.terrain.findMany.mockResolvedValue([makeTerrain(1)]);
      prisma.equipe.findFirst.mockResolvedValue(null);
      prisma.equipe.create.mockResolvedValue({ id: 'bye-team' });
      prisma.partie.create.mockImplementation((data) => {
        const match = { id: `match-${Date.now()}`, ...data.data };
        return Promise.resolve(match);
      });
      redis.set.mockResolvedValue('OK');

      await service.lancerPhaseFinale('concours-1');

      expect(coupeService.progresserMatchBracket).toHaveBeenCalled();
    });

    it('should acquire and release Redis lock', async () => {
      const poule1 = {
        ...makePoule('poule-1', 1),
        parties: [makePoolMatch('m1', 'poule-1', 'eq1', 'eq2', 13, 5)],
      };

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ poules: [poule1] }),
      );
      prisma.partie.findMany.mockResolvedValue(poule1.parties);
      prisma.terrain.findMany.mockResolvedValue([makeTerrain(1)]);
      prisma.equipe.findFirst.mockResolvedValue(null);
      prisma.equipe.create.mockResolvedValue({ id: 'bye-team' });
      prisma.partie.create.mockResolvedValue({ statut: StatutPartie.A_JOUER });
      redis.set.mockResolvedValue('OK');

      await service.lancerPhaseFinale('concours-1');

      expect(redis.set).toHaveBeenCalledWith(
        'draw:lock:concours-1:championnat:finale',
        '1',
        'EX',
        30,
        'NX',
      );
      expect(redis.del).toHaveBeenCalledWith('draw:lock:concours-1:championnat:finale');
    });

    it('should emit tourDemarre event after bracket creation', async () => {
      const poule1 = {
        ...makePoule('poule-1', 1),
        parties: [makePoolMatch('m1', 'poule-1', 'eq1', 'eq2', 13, 5)],
      };

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ poules: [poule1] }),
      );
      prisma.partie.findMany.mockResolvedValue(poule1.parties);
      prisma.terrain.findMany.mockResolvedValue([makeTerrain(1)]);
      prisma.equipe.findFirst.mockResolvedValue(null);
      prisma.equipe.create.mockResolvedValue({ id: 'bye-team' });
      prisma.partie.create.mockResolvedValue({ statut: StatutPartie.A_JOUER });
      redis.set.mockResolvedValue('OK');

      await service.lancerPhaseFinale('concours-1');

      expect(eventsGateway.emitTourDemarre).toHaveBeenCalledWith('concours-1', 2);
    });

    it('should throw if Redis lock is already held', async () => {
      redis.set.mockResolvedValue(null);

      await expect(service.lancerPhaseFinale('concours-1')).rejects.toThrow(BadRequestException);
      await expect(service.lancerPhaseFinale('concours-1')).rejects.toThrow('Lancement de la phase finale déjà en cours');
    });

    it('should prioritize pool winners for bracket seeding over runners-up', async () => {
      const poule1 = {
        ...makePoule('poule-1', 1),
        parties: [
          makePoolMatch('m1', 'poule-1', 'eq1', 'eq2', 13, 5),
          makePoolMatch('m2', 'poule-1', 'eq1', 'eq3', 13, 8),
          makePoolMatch('m3', 'poule-1', 'eq2', 'eq3', 13, 7),
        ],
      };
      const poule2 = {
        ...makePoule('poule-2', 2),
        parties: [
          makePoolMatch('m4', 'poule-2', 'eq4', 'eq5', 13, 10),
          makePoolMatch('m5', 'poule-2', 'eq4', 'eq6', 13, 11),
          makePoolMatch('m6', 'poule-2', 'eq5', 'eq6', 13, 9),
        ],
      };
      const poule3 = {
        ...makePoule('poule-3', 3),
        parties: [
          makePoolMatch('m7', 'poule-3', 'eq7', 'eq8', 13, 4),
          makePoolMatch('m8', 'poule-3', 'eq7', 'eq9', 13, 7),
          makePoolMatch('m9', 'poule-3', 'eq8', 'eq9', 13, 10),
        ],
      };

      prisma.concours.findUnique.mockResolvedValue(
        makeConcours({ poules: [poule1, poule2, poule3] }),
      );
      prisma.partie.findMany.mockImplementation(({ where }) => {
        if (where.pouleId === 'poule-1') return Promise.resolve(poule1.parties);
        if (where.pouleId === 'poule-2') return Promise.resolve(poule2.parties);
        if (where.pouleId === 'poule-3') return Promise.resolve(poule3.parties);
        if (where.type === TypePartie.CHAMPIONNAT_POULE) {
          return Promise.resolve([...poule1.parties, ...poule2.parties, ...poule3.parties]);
        }
        return Promise.resolve([]);
      });
      prisma.terrain.findMany.mockResolvedValue([makeTerrain(1)]);
      prisma.equipe.findFirst.mockResolvedValue(null);
      prisma.equipe.create.mockResolvedValue({ id: 'bye-team' });

      const createdMatches: any[] = [];
      prisma.partie.create.mockImplementation((data) => {
        const match = { id: `match-${createdMatches.length + 1}`, ...data.data };
        createdMatches.push(match);
        return Promise.resolve(match);
      });
      redis.set.mockResolvedValue('OK');

      await service.lancerPhaseFinale('concours-1');

      expect(createdMatches.length).toBeGreaterThan(0);
    });
  });
});
