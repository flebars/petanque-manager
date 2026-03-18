import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConcoursService } from './concours.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ChampionnatService } from '@/modules/parties/championnat.service';
import { JoueursService } from '@/modules/joueurs/joueurs.service';
import { Role, StatutConcours, FormatConcours, TypeEquipe, ModeConstitution, Genre, Categorie } from '@prisma/client';
import {
  createMockJoueur,
  createMockEquipe,
  createMockConcours,
  createImportJson,
  MOCK_PLAYER_FULL,
  MOCK_PLAYER_MINIMAL,
} from './test-helpers';

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
  const mockJoueursService = {};

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
        { provide: JoueursService, useValue: mockJoueursService },
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

describe('ConcoursService - Export', () => {
  let service: ConcoursService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    concours: {
      findUnique: jest.fn(),
    },
  };

  const mockChampionnatService = {};
  const mockJoueursService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConcoursService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ChampionnatService, useValue: mockChampionnatService },
        { provide: JoueursService, useValue: mockJoueursService },
      ],
    }).compile();

    service = module.get<ConcoursService>(ConcoursService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('exportConcours', () => {
    it('should export tournament with no players (empty tournament)', async () => {
      const mockConcours = createMockConcours({
        format: FormatConcours.MELEE,
        modeConstitution: ModeConstitution.MELEE,
        equipes: [],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.version).toBe('1.0');
      expect(result.exportedAt).toBeDefined();
      expect(result.tournament.nom).toBe(mockConcours.nom);
      expect(result.players).toEqual([]);
      expect(result.teams).toBeUndefined();
    });

    it('should export tournament with individual players (MELEE mode)', async () => {
      const player1 = createMockJoueur({ id: 'p1', email: 'p1@test.com' });
      const player2 = createMockJoueur({ id: 'p2', email: 'p2@test.com' });
      
      const mockConcours = createMockConcours({
        format: FormatConcours.MELEE,
        modeConstitution: ModeConstitution.MELEE,
        equipes: [
          createMockEquipe({ id: 'e1', joueurs: [{ equipeId: 'e1', joueurId: 'p1', joueur: player1 }] }),
          createMockEquipe({ id: 'e2', joueurs: [{ equipeId: 'e2', joueurId: 'p2', joueur: player2 }] }),
        ],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.players).toHaveLength(2);
      expect(result.players[0].email).toBe('p1@test.com');
      expect(result.players[1].email).toBe('p2@test.com');
      expect(result.teams).toBeUndefined();
    });

    it('should export tournament with pre-formed teams (MONTEE mode)', async () => {
      const player1 = createMockJoueur({ id: 'p1', email: 'p1@test.com' });
      const player2 = createMockJoueur({ id: 'p2', email: 'p2@test.com' });
      const player3 = createMockJoueur({ id: 'p3', email: 'p3@test.com' });
      const player4 = createMockJoueur({ id: 'p4', email: 'p4@test.com' });

      const mockConcours = createMockConcours({
        format: FormatConcours.MELEE,
        typeEquipe: TypeEquipe.DOUBLETTE,
        modeConstitution: ModeConstitution.MONTEE,
        equipes: [
          createMockEquipe({
            id: 'e1',
            nom: 'Team 1',
            joueurs: [
              { equipeId: 'e1', joueurId: 'p1', joueur: player1 },
              { equipeId: 'e1', joueurId: 'p2', joueur: player2 },
            ],
          }),
          createMockEquipe({
            id: 'e2',
            nom: 'Team 2',
            joueurs: [
              { equipeId: 'e2', joueurId: 'p3', joueur: player3 },
              { equipeId: 'e2', joueurId: 'p4', joueur: player4 },
            ],
          }),
        ],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.players).toHaveLength(4);
      expect(result.teams).toHaveLength(2);
      expect(result.teams![0].playerEmails).toEqual(['p1@test.com', 'p2@test.com']);
      expect(result.teams![1].playerEmails).toEqual(['p3@test.com', 'p4@test.com']);
    });

    it('should deduplicate players appearing in export', async () => {
      const player1 = createMockJoueur({ id: 'p1', email: 'p1@test.com' });

      const mockConcours = createMockConcours({
        equipes: [
          createMockEquipe({ id: 'e1', joueurs: [{ equipeId: 'e1', joueurId: 'p1', joueur: player1 }] }),
          createMockEquipe({ id: 'e2', joueurs: [{ equipeId: 'e2', joueurId: 'p1', joueur: player1 }] }),
        ],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.players).toHaveLength(1);
      expect(result.players[0].email).toBe('p1@test.com');
    });

    it('should export all tournament properties correctly', async () => {
      const mockConcours = createMockConcours({
        nom: 'Grand Prix 2026',
        lieu: 'Marseille',
        format: FormatConcours.MELEE,
        typeEquipe: TypeEquipe.TRIPLETTE,
        modeConstitution: ModeConstitution.MONTEE,
        nbTerrains: 10,
        maxParticipants: 50,
        dateDebut: new Date('2026-06-01T09:00:00Z'),
        dateFin: new Date('2026-06-01T18:00:00Z'),
        params: { nbTours: 7 },
        equipes: [],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.tournament.nom).toBe('Grand Prix 2026');
      expect(result.tournament.lieu).toBe('Marseille');
      expect(result.tournament.format).toBe(FormatConcours.MELEE);
      expect(result.tournament.typeEquipe).toBe(TypeEquipe.TRIPLETTE);
      expect(result.tournament.modeConstitution).toBe(ModeConstitution.MONTEE);
      expect(result.tournament.nbTerrains).toBe(10);
      expect(result.tournament.maxParticipants).toBe(50);
      expect(result.tournament.params).toEqual({ nbTours: 7 });
    });

    it('should filter ephemeral teams for MELEE_DEMELEE mode', async () => {
      const player1 = createMockJoueur({ id: 'p1', email: 'p1@test.com' });
      const player2 = createMockJoueur({ id: 'p2', email: 'p2@test.com' });

      const mockConcours = createMockConcours({
        modeConstitution: ModeConstitution.MELEE_DEMELEE,
        equipes: [
          createMockEquipe({ id: 'e1', tour: null, joueurs: [{ equipeId: 'e1', joueurId: 'p1', joueur: player1 }] }),
          createMockEquipe({ id: 'e2', tour: null, joueurs: [{ equipeId: 'e2', joueurId: 'p2', joueur: player2 }] }),
          createMockEquipe({ id: 'e3', tour: 1, joueurs: [{ equipeId: 'e3', joueurId: 'p1', joueur: player1 }] }),
          createMockEquipe({ id: 'e4', tour: 1, joueurs: [{ equipeId: 'e4', joueurId: 'p2', joueur: player2 }] }),
        ],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.players).toHaveLength(2);
    });

    it('should filter out __TBD__ placeholder teams', async () => {
      const player1 = createMockJoueur({ id: 'p1', email: 'p1@test.com' });

      const mockConcours = createMockConcours({
        modeConstitution: ModeConstitution.MONTEE,
        equipes: [
          createMockEquipe({ id: 'e1', nom: 'Real Team', joueurs: [{ equipeId: 'e1', joueurId: 'p1', joueur: player1 }] }),
          createMockEquipe({ id: 'e2', nom: '__TBD__', joueurs: [] }),
        ],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.players).toHaveLength(1);
      expect(result.teams).toHaveLength(1);
      expect(result.teams![0].nom).toBe('Real Team');
    });

    it('should filter out __BYE__ placeholder teams', async () => {
      const player1 = createMockJoueur({ id: 'p1', email: 'p1@test.com' });

      const mockConcours = createMockConcours({
        modeConstitution: ModeConstitution.MONTEE,
        equipes: [
          createMockEquipe({ id: 'e1', nom: 'Real Team', joueurs: [{ equipeId: 'e1', joueurId: 'p1', joueur: player1 }] }),
          createMockEquipe({ id: 'e2', nom: '__BYE__', joueurs: [] }),
        ],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.players).toHaveLength(1);
      expect(result.teams).toHaveLength(1);
      expect(result.teams![0].nom).toBe('Real Team');
    });

    it('should filter out teams with no players', async () => {
      const player1 = createMockJoueur({ id: 'p1', email: 'p1@test.com' });

      const mockConcours = createMockConcours({
        modeConstitution: ModeConstitution.MONTEE,
        equipes: [
          createMockEquipe({ id: 'e1', nom: 'Real Team', joueurs: [{ equipeId: 'e1', joueurId: 'p1', joueur: player1 }] }),
          createMockEquipe({ id: 'e2', nom: 'Empty Team', joueurs: [] }),
        ],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.players).toHaveLength(1);
      expect(result.teams).toHaveLength(1);
      expect(result.teams![0].nom).toBe('Real Team');
    });

    it('should convert null to undefined for optional fields', async () => {
      const playerWithNulls = createMockJoueur({
        id: 'p1',
        email: 'p1@test.com',
        licenceFfpjp: null,
        club: null,
        dateNaissance: null,
      });

      const mockConcours = createMockConcours({
        equipes: [
          createMockEquipe({ joueurs: [{ equipeId: 'e1', joueurId: 'p1', joueur: playerWithNulls }] }),
        ],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.players[0].licenceFfpjp).toBeUndefined();
      expect(result.players[0].club).toBeUndefined();
      expect(result.players[0].dateNaissance).toBeUndefined();
    });

    it('should format dateNaissance as YYYY-MM-DD', async () => {
      const playerWithDate = createMockJoueur({
        id: 'p1',
        email: 'p1@test.com',
        dateNaissance: new Date('1990-05-15T00:00:00Z'),
      });

      const mockConcours = createMockConcours({
        equipes: [
          createMockEquipe({ joueurs: [{ equipeId: 'e1', joueurId: 'p1', joueur: playerWithDate }] }),
        ],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.players[0].dateNaissance).toBe('1990-05-15');
    });

    it('should handle players without dateNaissance', async () => {
      const playerNoDate = createMockJoueur({
        id: 'p1',
        email: 'p1@test.com',
        dateNaissance: null,
      });

      const mockConcours = createMockConcours({
        equipes: [
          createMockEquipe({ joueurs: [{ equipeId: 'e1', joueurId: 'p1', joueur: playerNoDate }] }),
        ],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.players[0].dateNaissance).toBeUndefined();
    });

    it('should preserve all player attributes', async () => {
      const fullPlayer = createMockJoueur({
        id: 'p1',
        email: 'full@test.com',
        nom: 'Dupont',
        prenom: 'Jean',
        genre: Genre.H,
        dateNaissance: new Date('1990-05-15'),
        licenceFfpjp: '123456',
        club: 'Club Test',
        categorie: Categorie.SENIOR,
      });

      const mockConcours = createMockConcours({
        equipes: [
          createMockEquipe({ joueurs: [{ equipeId: 'e1', joueurId: 'p1', joueur: fullPlayer }] }),
        ],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.players[0]).toMatchObject({
        email: 'full@test.com',
        nom: 'Dupont',
        prenom: 'Jean',
        genre: Genre.H,
        dateNaissance: '1990-05-15',
        licenceFfpjp: '123456',
        club: 'Club Test',
        categorie: Categorie.SENIOR,
      });
    });

    it('should export MELEE params (nbTours)', async () => {
      const mockConcours = createMockConcours({
        format: FormatConcours.MELEE,
        params: { nbTours: 5 },
        equipes: [],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.tournament.params).toEqual({ nbTours: 5 });
    });

    it('should export COUPE params (consolante)', async () => {
      const mockConcours = createMockConcours({
        format: FormatConcours.COUPE,
        params: { consolante: true },
        equipes: [],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.tournament.params).toEqual({ consolante: true });
    });

    it('should export CHAMPIONNAT params (taillePoule)', async () => {
      const mockConcours = createMockConcours({
        format: FormatConcours.CHAMPIONNAT,
        params: { taillePoule: 4 },
        equipes: [],
      });

      mockPrismaService.concours.findUnique.mockResolvedValue(mockConcours);

      const result = await service.exportConcours('concours-1');

      expect(result.tournament.params).toEqual({ taillePoule: 4 });
    });

    it('should throw NotFoundException for non-existent tournament', async () => {
      mockPrismaService.concours.findUnique.mockResolvedValue(null);

      await expect(service.exportConcours('invalid-id')).rejects.toThrow(NotFoundException);
      await expect(service.exportConcours('invalid-id')).rejects.toThrow('Concours invalid-id introuvable');
    });
  });
});

describe('ConcoursService - Import', () => {
  let service: ConcoursService;
  let prisma: PrismaService;
  let joueursService: JoueursService;

  const mockPrismaService: any = {
    concours: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    terrain: {
      createMany: jest.fn(),
    },
    equipe: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(mockPrismaService)),
  };

  const mockJoueursService: any = {
    findOrCreateByEmail: jest.fn(),
  };

  const mockChampionnatService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConcoursService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ChampionnatService, useValue: mockChampionnatService },
        { provide: JoueursService, useValue: mockJoueursService },
      ],
    }).compile();

    service = module.get<ConcoursService>(ConcoursService);
    prisma = module.get<PrismaService>(PrismaService);
    joueursService = module.get<JoueursService>(JoueursService);
    jest.clearAllMocks();
  });

  describe('importConcours', () => {
    it('should create tournament with all properties', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Imported Tournament',
          lieu: 'Test City',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          maxParticipants: 20,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
          params: { nbTours: 5 },
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [{ nom: 'Team 1', playerEmails: ['p1@test.com', 'p2@test.com'] }],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }));
      mockPrismaService.concours.create.mockResolvedValue(createMockConcours({ id: 'new-id' }));
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours({ id: 'new-id' }));

      const result = await service.importConcours(importDto, 'user-123');

      expect(mockPrismaService.concours.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nom: 'Imported Tournament',
          lieu: 'Test City',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          maxParticipants: 20,
          params: { nbTours: 5 },
          organisateurId: 'user-123',
        }),
      });
    });

    it('should create terrains automatically', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 8,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [{ playerEmails: ['p1@test.com', 'p2@test.com'] }],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }));
      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockPrismaService.terrain.createMany).toHaveBeenCalledWith({
        data: [
          { concoursId: 'new-id', numero: 1 },
          { concoursId: 'new-id', numero: 2 },
          { concoursId: 'new-id', numero: 3 },
          { concoursId: 'new-id', numero: 4 },
          { concoursId: 'new-id', numero: 5 },
          { concoursId: 'new-id', numero: 6 },
          { concoursId: 'new-id', numero: 7 },
          { concoursId: 'new-id', numero: 8 },
        ],
      });
    });

    it('should set statut to INSCRIPTION', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [{ playerEmails: ['p1@test.com', 'p2@test.com'] }],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }));
      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours({ statut: StatutConcours.INSCRIPTION }));

      const result = await service.importConcours(importDto, 'user-123');

      expect(result.statut).toBe(StatutConcours.INSCRIPTION);
    });

    it('should assign current user as organisateur', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [{ playerEmails: ['p1@test.com', 'p2@test.com'] }],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }));
      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-abc-123');

      expect(mockPrismaService.concours.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organisateurId: 'user-abc-123',
        }),
      });
    });

    it('should handle tournament with no optional fields', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Minimal Tournament',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.TETE_A_TETE,
          modeConstitution: ModeConstitution.MELEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          {
            email: 'p1@test.com',
            nom: 'Test',
            prenom: 'Player',
            genre: Genre.H,
            categorie: Categorie.SENIOR,
          },
        ],
        teams: undefined,
      });

      mockJoueursService.findOrCreateByEmail.mockResolvedValue(createMockJoueur({ id: 'id1' }));
      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockPrismaService.concours.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          lieu: undefined,
          maxParticipants: undefined,
        }),
      });
    });

    it('should reuse existing player by email', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.TETE_A_TETE,
          modeConstitution: ModeConstitution.MELEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          {
            email: 'existing@test.com',
            nom: 'Existing',
            prenom: 'Player',
            genre: Genre.H,
            categorie: Categorie.SENIOR,
          },
        ],
        teams: undefined,
      });

      const existingPlayer = createMockJoueur({ id: 'existing-id', email: 'existing@test.com' });
      mockJoueursService.findOrCreateByEmail.mockResolvedValue(existingPlayer);
      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockJoueursService.findOrCreateByEmail).toHaveBeenCalledWith(
        'existing@test.com',
        expect.objectContaining({
          nom: 'Existing',
          prenom: 'Player',
        }),
      );
    });

    it('should create new player for unknown email', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.TETE_A_TETE,
          modeConstitution: ModeConstitution.MELEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          {
            email: 'newplayer@test.com',
            nom: 'New',
            prenom: 'Player',
            genre: Genre.F,
            categorie: Categorie.FEMININ,
          },
        ],
        teams: undefined,
      });

      const newPlayer = createMockJoueur({ id: 'new-player-id', email: 'newplayer@test.com' });
      mockJoueursService.findOrCreateByEmail.mockResolvedValue(newPlayer);
      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockJoueursService.findOrCreateByEmail).toHaveBeenCalledWith(
        'newplayer@test.com',
        expect.any(Object),
      );
    });

    it('should handle mixed existing and new players', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'existing1@test.com', nom: 'E1', prenom: 'P1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'new1@test.com', nom: 'N1', prenom: 'P1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'existing2@test.com', nom: 'E2', prenom: 'P2', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'new2@test.com', nom: 'N2', prenom: 'P2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [
          { playerEmails: ['existing1@test.com', 'new1@test.com'] },
          { playerEmails: ['existing2@test.com', 'new2@test.com'] },
        ],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'existing-1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'new-1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'existing-2' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'new-2' }));

      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockJoueursService.findOrCreateByEmail).toHaveBeenCalledTimes(4);
    });

    it('should preserve player data from JSON', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.TETE_A_TETE,
          modeConstitution: ModeConstitution.MELEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          {
            email: 'full@test.com',
            nom: 'Dupont',
            prenom: 'Jean',
            genre: Genre.H,
            dateNaissance: '1990-05-15',
            licenceFfpjp: '123456',
            club: 'Club Test',
            categorie: Categorie.VETERAN,
          },
        ],
        teams: undefined,
      });

      mockJoueursService.findOrCreateByEmail.mockResolvedValue(createMockJoueur({ id: 'id1' }));
      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockJoueursService.findOrCreateByEmail).toHaveBeenCalledWith(
        'full@test.com',
        expect.objectContaining({
          nom: 'Dupont',
          prenom: 'Jean',
          genre: Genre.H,
          dateNaissance: '1990-05-15',
          licenceFfpjp: '123456',
          club: 'Club Test',
          categorie: Categorie.VETERAN,
        }),
      );
    });

    it('should set default role SPECTATEUR for new players', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.TETE_A_TETE,
          modeConstitution: ModeConstitution.MELEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          {
            email: 'new@test.com',
            nom: 'New',
            prenom: 'Player',
            genre: Genre.H,
            categorie: Categorie.SENIOR,
          },
        ],
        teams: undefined,
      });

      mockJoueursService.findOrCreateByEmail.mockResolvedValue(createMockJoueur({ id: 'id1' }));
      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockJoueursService.findOrCreateByEmail).toHaveBeenCalledWith(
        'new@test.com',
        expect.objectContaining({
          role: Role.SPECTATEUR,
        }),
      );
    });

    it('should create teams for MONTEE mode', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p3@test.com', nom: 'P3', prenom: 'T3', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p4@test.com', nom: 'P4', prenom: 'T4', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [
          { nom: 'Team A', playerEmails: ['p1@test.com', 'p2@test.com'] },
          { nom: 'Team B', playerEmails: ['p3@test.com', 'p4@test.com'] },
        ],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id3' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id4' }));

      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.equipe.create.mockResolvedValue({});
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockPrismaService.equipe.create).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.equipe.create).toHaveBeenNthCalledWith(1, {
        data: {
          concoursId: 'new-id',
          nom: 'Team A',
          numeroTirage: 1,
          statut: 'INSCRITE',
          joueurs: {
            create: [{ joueurId: 'id1' }, { joueurId: 'id2' }],
          },
        },
      });
    });

    it('should assign numeroTirage sequentially', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.TETE_A_TETE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p3@test.com', nom: 'P3', prenom: 'T3', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [
          { playerEmails: ['p1@test.com'] },
          { playerEmails: ['p2@test.com'] },
          { playerEmails: ['p3@test.com'] },
        ],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id3' }));

      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.equipe.create.mockResolvedValue({});
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockPrismaService.equipe.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
        data: expect.objectContaining({ numeroTirage: 1 }),
      }));
      expect(mockPrismaService.equipe.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
        data: expect.objectContaining({ numeroTirage: 2 }),
      }));
      expect(mockPrismaService.equipe.create).toHaveBeenNthCalledWith(3, expect.objectContaining({
        data: expect.objectContaining({ numeroTirage: 3 }),
      }));
    });

    it('should set team statut to INSCRITE', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [{ playerEmails: ['p1@test.com', 'p2@test.com'] }],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }));

      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.equipe.create.mockResolvedValue({});
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockPrismaService.equipe.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          statut: 'INSCRITE',
        }),
      });
    });

    it('should preserve team names', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [{ nom: 'Les Champions', playerEmails: ['p1@test.com', 'p2@test.com'] }],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }));

      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.equipe.create.mockResolvedValue({});
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockPrismaService.equipe.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nom: 'Les Champions',
        }),
      });
    });

    it('should link players to teams via EquipeJoueur', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [{ playerEmails: ['p1@test.com', 'p2@test.com'] }],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'player-id-1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'player-id-2' }));

      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.equipe.create.mockResolvedValue({});
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockPrismaService.equipe.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          joueurs: {
            create: [
              { joueurId: 'player-id-1' },
              { joueurId: 'player-id-2' },
            ],
          },
        }),
      });
    });

    it('should create individual registrations for MELEE', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.TETE_A_TETE,
          modeConstitution: ModeConstitution.MELEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p3@test.com', nom: 'P3', prenom: 'T3', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: undefined,
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id3' }));

      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.equipe.create.mockResolvedValue({});
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockPrismaService.equipe.create).toHaveBeenCalledTimes(3);
      expect(mockPrismaService.equipe.create).toHaveBeenNthCalledWith(1, {
        data: {
          concoursId: 'new-id',
          numeroTirage: 1,
          statut: 'INSCRITE',
          joueurs: {
            create: [{ joueurId: 'id1' }],
          },
        },
      });
    });

    it('should reject teams array for non-MONTEE modes', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MELEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [],
        teams: [{ playerEmails: ['p1@test.com', 'p2@test.com'] }],
      });

      await expect(service.importConcours(importDto, 'user-123')).rejects.toThrow(BadRequestException);
      await expect(service.importConcours(importDto, 'user-123')).rejects.toThrow(
        'Les équipes pré-constituées ne sont autorisées que pour le mode MONTEE',
      );
    });

    it('should reject unsupported version', async () => {
      const importDto = createImportJson({
        version: '2.0',
      });

      await expect(service.importConcours(importDto, 'user-123')).rejects.toThrow(BadRequestException);
      await expect(service.importConcours(importDto, 'user-123')).rejects.toThrow(
        'Version non supportée: 2.0',
      );
    });

    it('should reject MONTEE without teams', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [],
        teams: [],
      });

      await expect(service.importConcours(importDto, 'user-123')).rejects.toThrow(BadRequestException);
      await expect(service.importConcours(importDto, 'user-123')).rejects.toThrow(
        'Le mode MONTEE nécessite des équipes pré-constituées',
      );
    });

    it('should reject too many players (>1000)', async () => {
      const players = Array.from({ length: 1001 }, (_, i) => ({
        email: `p${i}@test.com`,
        nom: `Player${i}`,
        prenom: 'Test',
        genre: Genre.H,
        categorie: Categorie.SENIOR,
      }));

      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.TETE_A_TETE,
          modeConstitution: ModeConstitution.MELEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players,
        teams: undefined,
      });

      await expect(service.importConcours(importDto, 'user-123')).rejects.toThrow(BadRequestException);
      await expect(service.importConcours(importDto, 'user-123')).rejects.toThrow(
        'Import limité à 1000 joueurs maximum',
      );
    });

    it('should validate team size matches typeEquipe', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.TETE_A_TETE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [{ playerEmails: ['p1@test.com', 'p2@test.com'] }],
      });

      await expect(service.importConcours(importDto, 'user-123')).rejects.toThrow(BadRequestException);
      await expect(service.importConcours(importDto, 'user-123')).rejects.toThrow(
        'Chaque équipe doit avoir 1 joueur(s) pour TETE_A_TETE',
      );
    });

    it('should filter out __TBD__ and __BYE__ teams before validation', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [
          { nom: 'Real Team', playerEmails: ['p1@test.com', 'p2@test.com'] },
          { nom: '__TBD__', playerEmails: [] },
          { nom: '__BYE__', playerEmails: [] },
        ],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }));

      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.equipe.create.mockResolvedValue({});
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockPrismaService.equipe.create).toHaveBeenCalledTimes(1);
    });

    it('should allow past dates with console warning', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const importDto = createImportJson({
        tournament: {
          nom: 'Past Tournament',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2020-01-01T09:00:00Z',
          dateFin: '2020-01-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [{ playerEmails: ['p1@test.com', 'p2@test.com'] }],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }));
      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Import d\'un concours avec date de début dans le passé'),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle empty playerEmails after filtering', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [
          { playerEmails: ['p1@test.com', 'p2@test.com'] },
          { playerEmails: [] },
        ],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }));

      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.equipe.create.mockResolvedValue({});
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockPrismaService.equipe.create).toHaveBeenCalledTimes(1);
    });

    it('should rollback on player lookup failure', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.TETE_A_TETE,
          modeConstitution: ModeConstitution.MELEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: undefined,
      });

      mockJoueursService.findOrCreateByEmail.mockRejectedValue(new Error('Database error'));

      await expect(service.importConcours(importDto, 'user-123')).rejects.toThrow('Database error');
      expect(mockPrismaService.concours.create).not.toHaveBeenCalled();
    });

    it('should import CHAMPIONNAT with taillePoule param', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test Championnat',
          format: FormatConcours.CHAMPIONNAT,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
          params: { taillePoule: 4 },
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [{ playerEmails: ['p1@test.com', 'p2@test.com'] }],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }));
      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockPrismaService.concours.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          params: { taillePoule: 4 },
        }),
      });
    });

    it('should import COUPE with consolante param', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test Coupe',
          format: FormatConcours.COUPE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
          params: { consolante: true },
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
          { email: 'p2@test.com', nom: 'P2', prenom: 'T2', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [{ playerEmails: ['p1@test.com', 'p2@test.com'] }],
      });

      mockJoueursService.findOrCreateByEmail
        .mockResolvedValueOnce(createMockJoueur({ id: 'id1' }))
        .mockResolvedValueOnce(createMockJoueur({ id: 'id2' }));
      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });
      mockPrismaService.concours.findUnique.mockResolvedValue(createMockConcours());

      await service.importConcours(importDto, 'user-123');

      expect(mockPrismaService.concours.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          params: { consolante: true },
        }),
      });
    });

    it('should throw error when team references unknown player email', async () => {
      const importDto = createImportJson({
        tournament: {
          nom: 'Test',
          format: FormatConcours.MELEE,
          typeEquipe: TypeEquipe.DOUBLETTE,
          modeConstitution: ModeConstitution.MONTEE,
          nbTerrains: 4,
          dateDebut: '2026-07-01T09:00:00Z',
          dateFin: '2026-07-01T18:00:00Z',
        },
        players: [
          { email: 'p1@test.com', nom: 'P1', prenom: 'T1', genre: Genre.H, categorie: Categorie.SENIOR },
        ],
        teams: [{ playerEmails: ['p1@test.com', 'unknown@test.com'] }],
      });

      mockJoueursService.findOrCreateByEmail.mockResolvedValueOnce(createMockJoueur({ id: 'id1' }));
      mockPrismaService.concours.create.mockResolvedValue({ id: 'new-id' });

      await expect(service.importConcours(importDto, 'user-123')).rejects.toThrow(
        'Joueur avec email unknown@test.com introuvable',
      );
    });
  });
});
