import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Role, Genre, Categorie } from '@prisma/client';
import { AdminUpdateUserDto } from './dto';

describe('AdminService - updateUserProfile', () => {
  let service: AdminService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    joueur: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockUser = {
    id: 'user-1',
    email: 'john@test.com',
    nom: 'Doe',
    prenom: 'John',
    genre: Genre.H,
    dateNaissance: new Date('1985-05-15'),
    licenceFfpjp: '12345',
    club: 'Test Club',
    categorie: Categorie.SENIOR,
    role: Role.SPECTATEUR,
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      const dto: AdminUpdateUserDto = {
        nom: 'Smith',
        prenom: 'Jane',
        club: 'New Club',
      };

      mockPrismaService.joueur.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.joueur.update.mockResolvedValue({
        ...mockUser,
        ...dto,
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.updateUserProfile('user-1', dto, 'admin-1', '127.0.0.1');

      expect(result.message).toBe('User profile updated successfully');
      expect(result.user.nom).toBe('Smith');
      expect(mockPrismaService.joueur.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          nom: 'Smith',
          prenom: 'Jane',
          club: 'New Club',
        }),
        select: expect.any(Object),
      });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockPrismaService.joueur.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUserProfile('fake-id', {}, 'admin-1', '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent duplicate email', async () => {
      const dto: AdminUpdateUserDto = {
        email: 'existing@test.com',
      };

      mockPrismaService.joueur.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ id: 'other-user', email: 'existing@test.com' });

      await expect(
        service.updateUserProfile('user-1', dto, 'admin-1', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.joueur.update).not.toHaveBeenCalled();
    });

    it('should allow email update if not duplicate', async () => {
      const dto: AdminUpdateUserDto = {
        email: 'newemail@test.com',
      };

      mockPrismaService.joueur.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      mockPrismaService.joueur.update.mockResolvedValue({
        ...mockUser,
        email: 'newemail@test.com',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.updateUserProfile('user-1', dto, 'admin-1');

      expect(result.user.email).toBe('newemail@test.com');
      expect(mockPrismaService.joueur.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should allow partial updates', async () => {
      const dto: AdminUpdateUserDto = {
        club: 'Updated Club Only',
      };

      mockPrismaService.joueur.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.joueur.update.mockResolvedValue({
        ...mockUser,
        club: 'Updated Club Only',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.updateUserProfile('user-1', dto, 'admin-1');

      expect(result.user.club).toBe('Updated Club Only');
      expect(result.user.nom).toBe(mockUser.nom);
    });

    it('should handle date conversion correctly', async () => {
      const dto: AdminUpdateUserDto = {
        dateNaissance: '1990-01-01',
      };

      mockPrismaService.joueur.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.joueur.update.mockResolvedValue({
        ...mockUser,
        dateNaissance: new Date('1990-01-01'),
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.updateUserProfile('user-1', dto, 'admin-1');

      expect(mockPrismaService.joueur.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dateNaissance: expect.any(Date),
          }),
        }),
      );
    });

    it('should create audit log with changes', async () => {
      const dto: AdminUpdateUserDto = {
        nom: 'NewName',
        club: 'NewClub',
      };

      mockPrismaService.joueur.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.joueur.update.mockResolvedValue({
        ...mockUser,
        ...dto,
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.updateUserProfile('user-1', dto, 'admin-1', '192.168.1.1');

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'UPDATE_USER_PROFILE',
          actorId: 'admin-1',
          targetId: 'user-1',
          details: expect.objectContaining({
            nom: expect.objectContaining({
              old: 'Doe',
              new: 'NewName',
            }),
            club: expect.objectContaining({
              old: 'Test Club',
              new: 'NewClub',
            }),
          }),
          ipAddress: '192.168.1.1',
        },
      });
    });

    it('should preserve role when not in DTO', async () => {
      const dto: AdminUpdateUserDto = {
        nom: 'UpdatedName',
      };

      mockPrismaService.joueur.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.joueur.update.mockResolvedValue({
        ...mockUser,
        nom: 'UpdatedName',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.updateUserProfile('user-1', dto, 'admin-1');

      expect(result.user.role).toBe(Role.SPECTATEUR);
    });
  });
});
