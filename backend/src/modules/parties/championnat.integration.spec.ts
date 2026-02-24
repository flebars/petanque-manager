import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ChampionnatService } from './championnat.service';
import { CoupeService } from './coupe.service';
import { PrismaService } from '@/prisma/prisma.service';
import { EventsGateway } from '@/modules/gateway/events.gateway';
import { StatutPartie, TypePartie, StatutEquipe, FormatConcours, TypeEquipe, ModeConstitution } from '@prisma/client';
import Redis from 'ioredis';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://petanque:petanque@localhost:5432/petanque_test';
const TEST_REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379';

const mockEventsGateway = {
  emitTourDemarre: jest.fn(),
  emitScoreValide: jest.fn(),
};

describe('ChampionnatService (Integration)', () => {
  let app: INestApplication;
  let service: ChampionnatService;
  let coupeService: CoupeService;
  let prisma: PrismaService;
  let redis: Redis;
  let testConcoursId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;

    redis = new Redis(TEST_REDIS_URL);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        ChampionnatService,
        CoupeService,
        PrismaService,
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: 'REDIS_CLIENT', useValue: redis },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = moduleFixture.get<ChampionnatService>(ChampionnatService);
    coupeService = moduleFixture.get<CoupeService>(CoupeService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase();
    testConcoursId = await createTestConcours();
  });

  afterAll(async () => {
    await cleanDatabase();
    await redis.quit();
    await prisma.$disconnect();
    await app.close();
  });

  async function cleanDatabase() {
    await prisma.$transaction([
      prisma.partie.deleteMany(),
      prisma.classement.deleteMany(),
      prisma.classementJoueur.deleteMany(),
      prisma.pouleEquipe.deleteMany(),
      prisma.poule.deleteMany(),
      prisma.equipeJoueur.deleteMany(),
      prisma.equipe.deleteMany(),
      prisma.terrain.deleteMany(),
      prisma.tirageLog.deleteMany(),
      prisma.concours.deleteMany(),
      prisma.joueur.deleteMany(),
    ]);
  }

  async function createTestConcours(): Promise<string> {
    const organisateur = await prisma.joueur.create({
      data: {
        email: `org-${Date.now()}@test.com`,
        nom: 'Test',
        prenom: 'Organizer',
        passwordHash: 'test-hash',
        genre: 'H',
        role: 'ORGANISATEUR',
      },
    });

    const concours = await prisma.concours.create({
      data: {
        nom: 'Test Championship',
        lieu: 'Test Location',
        dateDebut: new Date(),
        dateFin: new Date(),
        format: FormatConcours.CHAMPIONNAT,
        typeEquipe: TypeEquipe.TRIPLETTE,
        modeConstitution: 'MONTEE',
        statut: 'EN_COURS',
        nbTerrains: 10,
        maxParticipants: 100,
        params: { taillePoule: 4 },
        organisateurId: organisateur.id,
      },
    });
    return concours.id;
  }

  async function createTeams(concoursId: string, count: number): Promise<string[]> {
    const teamIds: string[] = [];
    for (let i = 0; i < count; i++) {
      const team = await prisma.equipe.create({
        data: {
          concoursId,
          nom: `Team ${i + 1}`,
          statut: StatutEquipe.PRESENTE,
        },
      });
      teamIds.push(team.id);
    }
    return teamIds;
  }

  async function createTerrains(concoursId: string, count: number): Promise<string[]> {
    const terrainIds: string[] = [];
    for (let i = 0; i < count; i++) {
      const terrain = await prisma.terrain.create({
        data: {
          concoursId,
          numero: i + 1,
        },
      });
      terrainIds.push(terrain.id);
    }
    return terrainIds;
  }

  async function completeAllPoolMatches(concoursId: string) {
    const poolMatches = await prisma.partie.findMany({
      where: {
        concoursId,
        type: TypePartie.CHAMPIONNAT_POULE,
      },
    });

    for (const match of poolMatches) {
      await prisma.partie.update({
        where: { id: match.id },
        data: {
          scoreA: 13,
          scoreB: Math.floor(Math.random() * 10),
          statut: StatutPartie.TERMINEE,
          heureFin: new Date(),
        },
      });
    }
  }

  describe('Full Pool Phase Flow', () => {
    it('should create pools and round-robin matches for 8 teams', async () => {
      await createTeams(testConcoursId, 8);
      await createTerrains(testConcoursId, 3);

      await service.lancerPoules(testConcoursId);

      const poules = await prisma.poule.findMany({
        where: { concoursId: testConcoursId },
        include: {
          equipes: true,
          parties: true,
        },
      });

      expect(poules).toHaveLength(2);
      poules.forEach((poule) => {
        expect(poule.equipes).toHaveLength(4);
        expect(poule.parties).toHaveLength(6);
      });

      const allMatches = await prisma.partie.findMany({
        where: { concoursId: testConcoursId, type: TypePartie.CHAMPIONNAT_POULE },
      });

      expect(allMatches).toHaveLength(12);
      allMatches.forEach((match) => {
        expect(match.tour).toBe(1);
        expect(match.statut).toBe(StatutPartie.A_JOUER);
        expect(match.terrainId).toBeTruthy();
      });
    });

    it('should handle unequal pool distribution for 9 teams', async () => {
      await createTeams(testConcoursId, 9);
      await createTerrains(testConcoursId, 2);

      await service.lancerPoules(testConcoursId);

      const poules = await prisma.poule.findMany({
        where: { concoursId: testConcoursId },
        include: { equipes: true },
      });

      expect(poules).toHaveLength(2);
      const poolSizes = poules.map((p) => p.equipes.length).sort();
      expect(poolSizes).toEqual([4, 5]);
    });

    it('should prevent concurrent pool launches with Redis lock', async () => {
      await createTeams(testConcoursId, 8);
      await createTerrains(testConcoursId, 3);

      const promise1 = service.lancerPoules(testConcoursId);
      const promise2 = service.lancerPoules(testConcoursId);

      const results = await Promise.allSettled([promise1, promise2]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      if (rejected[0].status === 'rejected') {
        expect(rejected[0].reason.message).toContain('Tirage des poules déjà en cours');
      }
    });

    it('should emit tourDemarre event after pool creation', async () => {
      await createTeams(testConcoursId, 4);
      await createTerrains(testConcoursId, 2);

      mockEventsGateway.emitTourDemarre.mockClear();

      await service.lancerPoules(testConcoursId);

      expect(mockEventsGateway.emitTourDemarre).toHaveBeenCalledWith(testConcoursId, 1);
    });
  });

  describe('Full Bracket Phase Flow', () => {
    it('should qualify top 2 teams from each pool and create bracket', async () => {
      const teamIds = await createTeams(testConcoursId, 8);
      await createTerrains(testConcoursId, 3);

      await service.lancerPoules(testConcoursId);
      await completeAllPoolMatches(testConcoursId);

      const beforePoules = await prisma.poule.findMany({
        where: { concoursId: testConcoursId },
      });
      expect(beforePoules.every((p) => p.statut === 'EN_COURS')).toBe(true);

      const bracketMatches = await service.lancerPhaseFinale(testConcoursId);

      const afterPoules = await prisma.poule.findMany({
        where: { concoursId: testConcoursId },
      });
      expect(afterPoules.every((p) => p.statut === 'TERMINE')).toBe(true);

      expect(bracketMatches.length).toBeGreaterThan(0);

      const finalMatches = await prisma.partie.findMany({
        where: {
          concoursId: testConcoursId,
          type: TypePartie.CHAMPIONNAT_FINALE,
        },
      });

      expect(finalMatches.length).toBeGreaterThan(0);
      finalMatches.forEach((match) => {
        expect(match.tour).toBe(2);
      });
    });

    it('should assign byes to highest-ranked teams (6 qualified teams)', async () => {
      await createTeams(testConcoursId, 12);
      await createTerrains(testConcoursId, 4);

      await service.lancerPoules(testConcoursId);
      await completeAllPoolMatches(testConcoursId);

      await service.lancerPhaseFinale(testConcoursId);

      const byeTeam = await prisma.equipe.findFirst({
        where: { concoursId: testConcoursId, nom: '__BYE__' },
      });

      expect(byeTeam).toBeTruthy();

      const byeMatches = await prisma.partie.findMany({
        where: {
          concoursId: testConcoursId,
          type: TypePartie.CHAMPIONNAT_FINALE,
          OR: [{ equipeAId: byeTeam!.id }, { equipeBId: byeTeam!.id }],
        },
      });

      expect(byeMatches.length).toBeGreaterThan(0);
      byeMatches.forEach((match) => {
        expect(match.statut).toBe(StatutPartie.TERMINEE);
        expect(match.scoreA).toBe(13);
        expect(match.scoreB).toBe(0);
      });
    });

    it('should prevent bracket launch if pool matches are not complete', async () => {
      await createTeams(testConcoursId, 8);
      await createTerrains(testConcoursId, 3);

      await service.lancerPoules(testConcoursId);

      const poolMatches = await prisma.partie.findMany({
        where: {
          concoursId: testConcoursId,
          type: TypePartie.CHAMPIONNAT_POULE,
        },
        take: 1,
      });

      await prisma.partie.update({
        where: { id: poolMatches[0].id },
        data: {
          scoreA: 13,
          scoreB: 5,
          statut: StatutPartie.TERMINEE,
        },
      });

      await expect(service.lancerPhaseFinale(testConcoursId)).rejects.toThrow(
        'Certaines parties de poules ne sont pas encore terminées',
      );
    });

    it('should prevent concurrent bracket launches with Redis lock', async () => {
      await createTeams(testConcoursId, 8);
      await createTerrains(testConcoursId, 3);

      await service.lancerPoules(testConcoursId);
      await completeAllPoolMatches(testConcoursId);

      const promise1 = service.lancerPhaseFinale(testConcoursId);
      const promise2 = service.lancerPhaseFinale(testConcoursId);

      const results = await Promise.allSettled([promise1, promise2]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      if (rejected[0].status === 'rejected') {
        expect(rejected[0].reason.message).toContain('Lancement de la phase finale déjà en cours');
      }
    });

    it('should emit tourDemarre event after bracket creation', async () => {
      await createTeams(testConcoursId, 8);
      await createTerrains(testConcoursId, 3);

      await service.lancerPoules(testConcoursId);
      await completeAllPoolMatches(testConcoursId);

      mockEventsGateway.emitTourDemarre.mockClear();

      await service.lancerPhaseFinale(testConcoursId);

      expect(mockEventsGateway.emitTourDemarre).toHaveBeenCalledWith(testConcoursId, 2);
    });
  });

  describe('End-to-End Championship Flow', () => {
    it('should complete full championship from pools to finals', async () => {
      const teamIds = await createTeams(testConcoursId, 8);
      await createTerrains(testConcoursId, 4);

      await service.lancerPoules(testConcoursId);

      let poolMatches = await prisma.partie.findMany({
        where: {
          concoursId: testConcoursId,
          type: TypePartie.CHAMPIONNAT_POULE,
        },
      });
      expect(poolMatches).toHaveLength(12);
      expect(poolMatches.every((m) => m.statut === StatutPartie.A_JOUER)).toBe(true);

      await completeAllPoolMatches(testConcoursId);

      poolMatches = await prisma.partie.findMany({
        where: {
          concoursId: testConcoursId,
          type: TypePartie.CHAMPIONNAT_POULE,
        },
      });
      expect(poolMatches.every((m) => m.statut === StatutPartie.TERMINEE)).toBe(true);

      await service.lancerPhaseFinale(testConcoursId);

      const bracketMatches = await prisma.partie.findMany({
        where: {
          concoursId: testConcoursId,
          type: TypePartie.CHAMPIONNAT_FINALE,
        },
        orderBy: { bracketRonde: 'asc' },
      });

      expect(bracketMatches.length).toBeGreaterThan(0);

      const byeMatches = bracketMatches.filter((m) => m.statut === StatutPartie.TERMINEE);
      const regularMatches = bracketMatches.filter((m) => m.statut === StatutPartie.A_JOUER);

      expect(byeMatches.length).toBe(0);
      expect(regularMatches.length).toBe(2);

      const poules = await prisma.poule.findMany({
        where: { concoursId: testConcoursId },
      });
      expect(poules.every((p) => p.statut === 'TERMINE')).toBe(true);
    });

    it('should handle championship with 12 teams (3 pools, 6 qualifiers, 2 byes)', async () => {
      await createTeams(testConcoursId, 12);
      await createTerrains(testConcoursId, 4);

      await service.lancerPoules(testConcoursId);

      const poules = await prisma.poule.findMany({
        where: { concoursId: testConcoursId },
        include: { equipes: true },
      });
      expect(poules).toHaveLength(3);
      expect(poules.every((p) => p.equipes.length === 4)).toBe(true);

      await completeAllPoolMatches(testConcoursId);

      await service.lancerPhaseFinale(testConcoursId);

      const bracketMatches = await prisma.partie.findMany({
        where: {
          concoursId: testConcoursId,
          type: TypePartie.CHAMPIONNAT_FINALE,
        },
      });

      const byeTeam = await prisma.equipe.findFirst({
        where: { concoursId: testConcoursId, nom: '__BYE__' },
      });

      const byeMatches = bracketMatches.filter(
        (m) => m.equipeAId === byeTeam?.id || m.equipeBId === byeTeam?.id,
      );

      expect(byeMatches).toHaveLength(2);
      expect(byeMatches.every((m) => m.statut === StatutPartie.TERMINEE)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum teams (4 teams, 1 pool)', async () => {
      await createTeams(testConcoursId, 4);
      await createTerrains(testConcoursId, 2);

      await service.lancerPoules(testConcoursId);

      const poules = await prisma.poule.findMany({
        where: { concoursId: testConcoursId },
        include: { equipes: true, parties: true },
      });

      expect(poules).toHaveLength(1);
      expect(poules[0].equipes).toHaveLength(4);
      expect(poules[0].parties).toHaveLength(6);

      await completeAllPoolMatches(testConcoursId);
      await service.lancerPhaseFinale(testConcoursId);

      const bracketMatches = await prisma.partie.findMany({
        where: {
          concoursId: testConcoursId,
          type: TypePartie.CHAMPIONNAT_FINALE,
        },
      });

      expect(bracketMatches).toHaveLength(1);
    });

    it('should throw error if trying to launch pools twice', async () => {
      await createTeams(testConcoursId, 8);
      await createTerrains(testConcoursId, 3);

      await service.lancerPoules(testConcoursId);

      await expect(
        redis.del(`draw:lock:${testConcoursId}:championnat:poules`),
      ).resolves.toBeDefined();

      const existingPoules = await prisma.poule.findMany({
        where: { concoursId: testConcoursId },
      });

      expect(existingPoules.length).toBeGreaterThan(0);
    });

    it('should handle forfeit in pool phase', async () => {
      await createTeams(testConcoursId, 4);
      await createTerrains(testConcoursId, 2);

      await service.lancerPoules(testConcoursId);

      const poolMatches = await prisma.partie.findMany({
        where: {
          concoursId: testConcoursId,
          type: TypePartie.CHAMPIONNAT_POULE,
        },
        take: 1,
      });

      await prisma.partie.update({
        where: { id: poolMatches[0].id },
        data: {
          scoreA: 13,
          scoreB: 0,
          statut: StatutPartie.FORFAIT,
          heureFin: new Date(),
        },
      });

      const updatedMatch = await prisma.partie.findUnique({
        where: { id: poolMatches[0].id },
      });

      expect(updatedMatch?.statut).toBe(StatutPartie.FORFAIT);
      expect(updatedMatch?.scoreA).toBe(13);
      expect(updatedMatch?.scoreB).toBe(0);
    });
  });
});
