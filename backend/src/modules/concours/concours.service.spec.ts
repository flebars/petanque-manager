import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConcoursService } from './concours.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ChampionnatService } from '@/modules/parties/championnat.service';
import { Role, StatutConcours, FormatConcours, TypeEquipe, ModeConstitution } from '@prisma/client';

describe('ConcoursService - Update', () => {
  let service: ConcoursService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    concours: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    terrain: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    partie: {
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(mockPrismaService)),
  };

  const mockChampionnatService = {};

  const mockConcours = {
    id: 'concours-1',
    nom: 'Grand Prix de Marseille',
    lieu: 'Marseille',
    format: FormatConcours.MELEE,
    typeEquipe: TypeEquipe.DOUBLETTE,
    modeConstitution: ModeConstitution.MONTEE,
    statut: StatutConcours.INSCRIPTION,
    nbTerrains: 4,
    maxParticipants: 32,
    dateDebut: new Date('2026-03-20T14:00:00Z'),
    dateFin: new Date('2026-03-20T18:00:00Z'),
    params: {},
    organisateurId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    equipes: [],
    terrains: [],
    poules: [],
    organisateur: { id: 'user-1', nom: 'Doe', prenom: 'John', email: 'john@example.com' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConcoursService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ChampionnatService, useValue: mockChampionnatService },
      ],
    }).compile();

    service = module.get<ConcoursService>(ConcoursService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('update', () => {
    it('should update tournament name and dates when INSCRIPTION status', async () => {
      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);
      mockPrismaService.concours.update.mockResolvedValue({
        ...mockConcours,
        nom: 'New Name',
        dateDebut: new Date('2026-04-01T14:00:00Z'),
      });

      const result = await service.update(
        'concours-1',
        {
          nom: 'New Name',
          dateDebut: '2026-04-01T14:00:00Z',
        },
        'user-1',
        Role.ORGANISATEUR,
      );

      expect(result.nom).toBe('New Name');
      expect(mockPrismaService.concours.update).toHaveBeenCalledWith({
        where: { id: 'concours-1' },
        data: {
          nom: 'New Name',
          dateDebut: new Date('2026-04-01T14:00:00Z'),
          dateFin: undefined,
          nbTerrains: undefined,
        },
      });
    });

    it('should throw BadRequestException when tournament is EN_COURS', async () => {
      mockPrismaService.concours.findUnique.mockResolvedValue({
        ...mockConcours,
        statut: StatutConcours.EN_COURS,
      });

      await expect(
        service.update('concours-1', { nom: 'New Name' }, 'user-1', Role.ORGANISATEUR),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when user is not organisateur or SUPER_ADMIN', async () => {
      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      await expect(
        service.update('concours-1', { nom: 'New Name' }, 'other-user', Role.SPECTATEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow SUPER_ADMIN to update any tournament', async () => {
      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);
      mockPrismaService.concours.update.mockResolvedValue({
        ...mockConcours,
        nom: 'Updated by Admin',
      });

      const result = await service.update(
        'concours-1',
        { nom: 'Updated by Admin' },
        'other-user',
        Role.SUPER_ADMIN,
      );

      expect(result.nom).toBe('Updated by Admin');
    });

    it('should call updateTerrains when nbTerrains is provided', async () => {
      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);
      mockPrismaService.concours.update.mockResolvedValue({
        ...mockConcours,
        nbTerrains: 6,
      });
      mockPrismaService.terrain.findMany.mockResolvedValue([
        { id: 't1', numero: 1, concoursId: 'concours-1' },
        { id: 't2', numero: 2, concoursId: 'concours-1' },
        { id: 't3', numero: 3, concoursId: 'concours-1' },
        { id: 't4', numero: 4, concoursId: 'concours-1' },
      ]);

      await service.update('concours-1', { nbTerrains: 6 }, 'user-1', Role.ORGANISATEUR);

      expect(mockPrismaService.terrain.createMany).toHaveBeenCalledWith({
        data: [
          { concoursId: 'concours-1', numero: 5 },
          { concoursId: 'concours-1', numero: 6 },
        ],
      });
    });
  });

  describe('updateTerrains', () => {
    it('should create new terrains when increasing count', async () => {
      mockPrismaService.terrain.findMany.mockResolvedValue([
        { id: 't1', numero: 1, concoursId: 'concours-1' },
        { id: 't2', numero: 2, concoursId: 'concours-1' },
      ]);

      await service.updateTerrains('concours-1', 5);

      expect(mockPrismaService.terrain.createMany).toHaveBeenCalledWith({
        data: [
          { concoursId: 'concours-1', numero: 3 },
          { concoursId: 'concours-1', numero: 4 },
          { concoursId: 'concours-1', numero: 5 },
        ],
      });
    });

    it('should delete terrains when decreasing count with no matches', async () => {
      mockPrismaService.terrain.findMany.mockResolvedValue([
        { id: 't1', numero: 1, concoursId: 'concours-1' },
        { id: 't2', numero: 2, concoursId: 'concours-1' },
        { id: 't3', numero: 3, concoursId: 'concours-1' },
        { id: 't4', numero: 4, concoursId: 'concours-1' },
      ]);
      mockPrismaService.partie.findMany.mockResolvedValue([]);

      await service.updateTerrains('concours-1', 2);

      expect(mockPrismaService.terrain.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['t3', 't4'] } },
      });
    });

    it('should reassign matches from deleted terrains using round-robin', async () => {
      mockPrismaService.terrain.findMany.mockResolvedValue([
        { id: 't1', numero: 1, concoursId: 'concours-1' },
        { id: 't2', numero: 2, concoursId: 'concours-1' },
        { id: 't3', numero: 3, concoursId: 'concours-1' },
        { id: 't4', numero: 4, concoursId: 'concours-1' },
      ]);

      mockPrismaService.partie.findMany.mockResolvedValue([
        { id: 'm1', terrainId: 't3' },
        { id: 'm2', terrainId: 't4' },
        { id: 'm3', terrainId: 't4' },
      ]);

      mockPrismaService.partie.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      await service.updateTerrains('concours-1', 2);

      expect(mockPrismaService.partie.update).toHaveBeenCalledTimes(3);
      expect(mockPrismaService.terrain.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['t3', 't4'] } },
      });
    });

    it('should do nothing when count is unchanged', async () => {
      mockPrismaService.terrain.findMany.mockResolvedValue([
        { id: 't1', numero: 1, concoursId: 'concours-1' },
        { id: 't2', numero: 2, concoursId: 'concours-1' },
      ]);

      await service.updateTerrains('concours-1', 2);

      expect(mockPrismaService.terrain.createMany).not.toHaveBeenCalled();
      expect(mockPrismaService.terrain.deleteMany).not.toHaveBeenCalled();
    });

    it('should handle decreasing to 1 terrain with many matches', async () => {
      mockPrismaService.terrain.findMany.mockResolvedValue([
        { id: 't1', numero: 1, concoursId: 'concours-1' },
        { id: 't2', numero: 2, concoursId: 'concours-1' },
        { id: 't3', numero: 3, concoursId: 'concours-1' },
      ]);

      mockPrismaService.partie.findMany.mockResolvedValue([
        { id: 'm1', terrainId: 't2' },
        { id: 'm2', terrainId: 't2' },
        { id: 'm3', terrainId: 't3' },
        { id: 'm4', terrainId: 't3' },
        { id: 'm5', terrainId: 't3' },
      ]);

      mockPrismaService.partie.count.mockResolvedValue(0);

      await service.updateTerrains('concours-1', 1);

      expect(mockPrismaService.partie.update).toHaveBeenCalledTimes(5);
      expect(mockPrismaService.terrain.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['t2', 't3'] } },
      });
    });
  });
});
