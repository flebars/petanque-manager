import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PartiesService } from './parties.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ClassementService } from '@/modules/classement/classement.service';
import { EventsGateway } from '@/modules/gateway/events.gateway';
import { StatutPartie, StatutEquipe, TypePartie } from '@prisma/client';

const mockRedis = {
  set: jest.fn(),
  del: jest.fn(),
};

const mockPrisma = {
  partie: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  concours: {
    findUnique: jest.fn(),
  },
  equipe: {
    findMany: jest.fn(),
  },
  terrain: {
    findMany: jest.fn(),
  },
  tirageLog: {
    create: jest.fn(),
  },
};

const mockClassementService = {
  recalculer: jest.fn(),
};

const mockEventsGateway = {
  emitTourDemarre: jest.fn(),
  emitScoreValide: jest.fn(),
};

describe('PartiesService - lancerTourCoupe', () => {
  let service: PartiesService;
  let prisma: typeof mockPrisma;
  let redis: typeof mockRedis;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartiesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClassementService, useValue: mockClassementService },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<PartiesService>(PartiesService);
    prisma = mockPrisma;
    redis = mockRedis;
  });

  describe('lancerTourCoupe - Tour 1 (Initial Bracket)', () => {
    it('should create bracket for 4 teams without byes', async () => {
      const concoursId = 'concours-1';
      const equipes = [
        { id: 'eq1', nom: 'Team 1', statut: StatutEquipe.INSCRITE },
        { id: 'eq2', nom: 'Team 2', statut: StatutEquipe.INSCRITE },
        { id: 'eq3', nom: 'Team 3', statut: StatutEquipe.INSCRITE },
        { id: 'eq4', nom: 'Team 4', statut: StatutEquipe.INSCRITE },
      ];
      const terrains = [
        { id: 'terrain-1', numero: 1 },
        { id: 'terrain-2', numero: 2 },
      ];

      redis.set.mockResolvedValue('OK');
      prisma.concours.findUnique.mockResolvedValue({
        id: concoursId,
        format: 'COUPE',
        params: { consolante: false },
      });
      prisma.equipe.findMany.mockResolvedValue(equipes);
      prisma.terrain.findMany.mockResolvedValue(terrains);
      prisma.partie.create.mockImplementation((args) => 
        Promise.resolve({
          id: `partie-${Math.random()}`,
          ...args.data,
        })
      );
      prisma.tirageLog.create.mockResolvedValue({});

      const parties = await service.lancerTourCoupe(concoursId, 1);

      expect(redis.set).toHaveBeenCalledWith(
        `draw:lock:${concoursId}:1`,
        '1',
        'EX',
        30,
        'NX'
      );
      expect(prisma.equipe.findMany).toHaveBeenCalledWith({
        where: {
          concoursId,
          statut: { in: [StatutEquipe.INSCRITE, StatutEquipe.PRESENTE] },
        },
      });
      expect(parties).toHaveLength(2);
      expect(parties.every((p) => p.type === TypePartie.COUPE_PRINCIPALE)).toBe(true);
      expect(redis.del).toHaveBeenCalledWith(`draw:lock:${concoursId}:1`);
    });

    it('should create bracket with byes for 5 teams (expand to 8)', async () => {
      const concoursId = 'concours-2';
      const equipes = [
        { id: 'eq1', statut: StatutEquipe.INSCRITE },
        { id: 'eq2', statut: StatutEquipe.INSCRITE },
        { id: 'eq3', statut: StatutEquipe.INSCRITE },
        { id: 'eq4', statut: StatutEquipe.INSCRITE },
        { id: 'eq5', statut: StatutEquipe.INSCRITE },
      ];
      const terrains = [{ id: 'terrain-1', numero: 1 }];

      redis.set.mockResolvedValue('OK');
      prisma.concours.findUnique.mockResolvedValue({
        id: concoursId,
        format: 'COUPE',
        params: { consolante: false },
      });
      prisma.equipe.findMany.mockResolvedValue(equipes);
      prisma.terrain.findMany.mockResolvedValue(terrains);
      prisma.partie.create.mockImplementation((args) => 
        Promise.resolve({
          id: `partie-${Math.random()}`,
          ...args.data,
        })
      );
      prisma.tirageLog.create.mockResolvedValue({});

      const parties = await service.lancerTourCoupe(concoursId, 1);

      expect(parties).toHaveLength(4);
      
      const byes = parties.filter((p) => p.equipeAId === p.equipeBId);
      const realMatches = parties.filter((p) => p.equipeAId !== p.equipeBId);
      
      expect(byes.length).toBeGreaterThan(0);
      expect(byes.every((p) => p.scoreA === 13 && p.scoreB === 0)).toBe(true);
      expect(byes.every((p) => p.statut === StatutPartie.TERMINEE)).toBe(true);
      expect(realMatches.every((p) => p.statut === StatutPartie.A_JOUER)).toBe(true);
    });

    it('should throw error if less than 2 teams', async () => {
      const concoursId = 'concours-3';
      
      redis.set.mockResolvedValue('OK');
      prisma.concours.findUnique.mockResolvedValue({
        id: concoursId,
        format: 'COUPE',
        params: { consolante: false },
      });
      prisma.equipe.findMany.mockResolvedValue([{ id: 'eq1', statut: StatutEquipe.INSCRITE }]);

      await expect(service.lancerTourCoupe(concoursId, 1)).rejects.toThrow(BadRequestException);
      expect(redis.del).toHaveBeenCalledWith(`draw:lock:${concoursId}:1`);
    });

    it('should throw error if no terrains available', async () => {
      const concoursId = 'concours-4';
      const equipes = [
        { id: 'eq1', statut: StatutEquipe.INSCRITE },
        { id: 'eq2', statut: StatutEquipe.INSCRITE },
      ];

      redis.set.mockResolvedValue('OK');
      prisma.concours.findUnique.mockResolvedValue({
        id: concoursId,
        format: 'COUPE',
        params: { consolante: false },
      });
      prisma.equipe.findMany.mockResolvedValue(equipes);
      prisma.terrain.findMany.mockResolvedValue([]);

      await expect(service.lancerTourCoupe(concoursId, 1)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw error if format is not COUPE', async () => {
      const concoursId = 'concours-5';

      redis.set.mockResolvedValue('OK');
      prisma.concours.findUnique.mockResolvedValue({
        id: concoursId,
        format: 'MELEE',
        params: {},
      });

      await expect(service.lancerTourCoupe(concoursId, 1)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw error if concours not found', async () => {
      const concoursId = 'non-existent';

      redis.set.mockResolvedValue('OK');
      prisma.concours.findUnique.mockResolvedValue(null);

      await expect(service.lancerTourCoupe(concoursId, 1)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw error if draw lock already acquired', async () => {
      const concoursId = 'concours-6';

      redis.set.mockResolvedValue(null);

      await expect(service.lancerTourCoupe(concoursId, 1)).rejects.toThrow(
        BadRequestException
      );
      expect(prisma.concours.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Score validation', () => {
    it('should reject score if winner does not have 13', async () => {
      const partie = {
        id: 'partie-1',
        concoursId: 'concours-1',
        statut: StatutPartie.EN_COURS,
      };

      prisma.partie.findUnique.mockResolvedValue(partie);

      await expect(
        service.saisirScore('partie-1', { scoreA: 12, scoreB: 11 })
      ).rejects.toThrow('Le gagnant doit avoir exactement 13 points');
    });

    it('should reject score if both teams have 13', async () => {
      const partie = {
        id: 'partie-1',
        concoursId: 'concours-1',
        statut: StatutPartie.EN_COURS,
      };

      prisma.partie.findUnique.mockResolvedValue(partie);

      await expect(
        service.saisirScore('partie-1', { scoreA: 13, scoreB: 13 })
      ).rejects.toThrow('Les deux équipes ne peuvent pas avoir 13 points');
    });

    it('should accept valid score (13-0 to 13-12)', async () => {
      const partie = {
        id: 'partie-1',
        concoursId: 'concours-1',
        statut: StatutPartie.EN_COURS,
      };

      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.partie.update.mockResolvedValue({
        ...partie,
        scoreA: 13,
        scoreB: 7,
        statut: StatutPartie.TERMINEE,
      });
      mockClassementService.recalculer.mockResolvedValue(undefined);

      const updated = await service.saisirScore('partie-1', { scoreA: 13, scoreB: 7 });

      expect(updated.scoreA).toBe(13);
      expect(updated.scoreB).toBe(7);
      expect(updated.statut).toBe(StatutPartie.TERMINEE);
      expect(mockClassementService.recalculer).toHaveBeenCalledWith('concours-1');
      expect(mockEventsGateway.emitScoreValide).toHaveBeenCalled();
    });
  });
});
