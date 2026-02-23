import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PartiesService } from './parties.service';
import { CoupeService } from './coupe.service';
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

const mockCoupeService = {
  lancerTourCoupe: jest.fn(),
  progresserMatchBracket: jest.fn(),
};

describe('PartiesService - lancerTourCoupe', () => {
  let service: PartiesService;
  let coupeService: typeof mockCoupeService;
  let prisma: typeof mockPrisma;
  let redis: typeof mockRedis;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartiesService,
        { provide: CoupeService, useValue: mockCoupeService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClassementService, useValue: mockClassementService },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<PartiesService>(PartiesService);
    coupeService = mockCoupeService;
    prisma = mockPrisma;
    redis = mockRedis;
  });

  describe('lancerTourCoupe - Tour 1 (Initial Bracket)', () => {
    it('should delegate to CoupeService', async () => {
      const concoursId = 'concours-1';
      const expectedParties = [
        { id: 'partie-1', equipeAId: 'eq1', equipeBId: 'eq2' },
        { id: 'partie-2', equipeAId: 'eq3', equipeBId: 'eq4' },
      ];

      coupeService.lancerTourCoupe.mockResolvedValue(expectedParties);

      const parties = await service.lancerTourCoupe(concoursId, 1);
});
