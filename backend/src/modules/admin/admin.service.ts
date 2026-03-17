import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  ClearDataDto,
  ClearDataResponseDto,
  UpdateUserRoleDto,
  BackupDataDto,
  AdminUpdateUserDto,
} from './dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getSystemStats() {
    const [users, tournaments, teams, matches, adminUsers] = await Promise.all([
      this.prisma.joueur.count(),
      this.prisma.concours.count(),
      this.prisma.equipe.count(),
      this.prisma.partie.count(),
      this.prisma.joueur.count({ where: { role: Role.SUPER_ADMIN } }),
    ]);

    return {
      users,
      tournaments,
      teams,
      matches,
      adminUsers,
    };
  }

  async listUsers(search?: string, page = 1, limit = 50) {
    const where = search
      ? {
          OR: [
            { nom: { contains: search, mode: 'insensitive' as const } },
            { prenom: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { club: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.joueur.findMany({
        where,
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          genre: true,
          club: true,
          role: true,
          categorie: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.joueur.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  async updateUserRole(
    userId: string,
    dto: UpdateUserRoleDto,
    actorId: string,
    ipAddress?: string,
  ) {
    const user = await this.prisma.joueur.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const actor = await this.prisma.joueur.findUnique({ where: { id: actorId } });
    if (!actor) throw new UnauthorizedException('Actor not found');

    const valid = await bcrypt.compare(dto.password, actor.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid password');

    if (user.role === Role.SUPER_ADMIN && dto.newRole !== Role.SUPER_ADMIN) {
      const adminCount = await this.prisma.joueur.count({
        where: { role: Role.SUPER_ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot remove the last SUPER_ADMIN');
      }
    }

    const oldRole = user.role;
    const updatedUser = await this.prisma.joueur.update({
      where: { id: userId },
      data: { role: dto.newRole },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
      },
    });

    await this.createAuditLog(
      'UPDATE_USER_ROLE',
      actorId,
      userId,
      { oldRole, newRole: dto.newRole },
      ipAddress,
    );

    return { message: 'Role updated successfully', user: updatedUser };
  }

  async updateUserProfile(
    userId: string,
    dto: AdminUpdateUserDto,
    actorId: string,
    ipAddress?: string,
  ) {
    const user = await this.prisma.joueur.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.joueur.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new BadRequestException('Email already in use');
      }
    }

    const oldValues = {
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      genre: user.genre,
      dateNaissance: user.dateNaissance,
      licenceFfpjp: user.licenceFfpjp,
      club: user.club,
      categorie: user.categorie,
    };

    const updatedUser = await this.prisma.joueur.update({
      where: { id: userId },
      data: {
        ...dto,
        dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : undefined,
      },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        genre: true,
        dateNaissance: true,
        licenceFfpjp: true,
        club: true,
        categorie: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const changes: any = {};
    Object.keys(dto).forEach((key) => {
      if (dto[key as keyof AdminUpdateUserDto] !== undefined) {
        changes[key] = {
          old: oldValues[key as keyof typeof oldValues],
          new: dto[key as keyof AdminUpdateUserDto],
        };
      }
    });

    await this.createAuditLog(
      'UPDATE_USER_PROFILE',
      actorId,
      userId,
      changes,
      ipAddress,
    );

    return { message: 'User profile updated successfully', user: updatedUser };
  }

  async deleteUser(userId: string, actorId: string, ipAddress?: string) {
    if (userId === actorId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    const user = await this.prisma.joueur.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === Role.SUPER_ADMIN) {
      const adminCount = await this.prisma.joueur.count({
        where: { role: Role.SUPER_ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last SUPER_ADMIN');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.concours.updateMany({
        where: { organisateurId: userId },
        data: { organisateurId: actorId },
      });

      await tx.joueur.delete({ where: { id: userId } });
    });

    await this.createAuditLog(
      'DELETE_USER',
      actorId,
      userId,
      { email: user.email, role: user.role },
      ipAddress,
    );

    return { message: 'User deleted successfully' };
  }

  async exportDatabase(actorId: string, ipAddress?: string): Promise<BackupDataDto> {
    const actor = await this.prisma.joueur.findUnique({ where: { id: actorId } });
    if (!actor) throw new UnauthorizedException('Actor not found');

    const [
      joueurs,
      concours,
      equipes,
      parties,
      classements,
      classementsJoueurs,
      poules,
      pouleEquipes,
      terrains,
      tirageLogs,
    ] = await Promise.all([
      this.prisma.joueur.findMany({ include: { equipeJoueurs: true } }),
      this.prisma.concours.findMany(),
      this.prisma.equipe.findMany({ include: { joueurs: true } }),
      this.prisma.partie.findMany(),
      this.prisma.classement.findMany(),
      this.prisma.classementJoueur.findMany(),
      this.prisma.poule.findMany(),
      this.prisma.pouleEquipe.findMany(),
      this.prisma.terrain.findMany(),
      this.prisma.tirageLog.findMany(),
    ]);

    await this.createAuditLog('EXPORT_BACKUP', actorId, null, null, ipAddress);

    return {
      exportedAt: new Date().toISOString(),
      exportedBy: actor.email,
      version: '1.0',
      counts: {
        joueurs: joueurs.length,
        concours: concours.length,
        equipes: equipes.length,
        parties: parties.length,
        classements: classements.length,
        poules: poules.length,
        terrains: terrains.length,
      },
      data: {
        joueurs,
        concours,
        equipes,
        parties,
        classements,
        classementsJoueurs,
        poules,
        pouleEquipes,
        terrains,
        tirageLogs,
      },
    };
  }

  async clearAllData(
    dto: ClearDataDto,
    actorId: string,
    ipAddress?: string,
  ): Promise<ClearDataResponseDto> {
    try {
      if (dto.confirmText !== 'DELETE') {
        throw new BadRequestException('Confirmation text must be "DELETE"');
      }

      const actor = await this.prisma.joueur.findUnique({ where: { id: actorId } });
      if (!actor) throw new UnauthorizedException('Actor not found');

      const valid = await bcrypt.compare(dto.password, actor.passwordHash);
      if (!valid) throw new UnauthorizedException('Invalid password');

      const stats = await this.getSystemStats();

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.pouleEquipe.deleteMany({});
        await tx.poule.deleteMany({});
        await tx.partie.deleteMany({});
        await tx.classement.deleteMany({});
        await tx.classementJoueur.deleteMany({});
        await tx.tirageLog.deleteMany({});
        await tx.equipeJoueur.deleteMany({});
        await tx.equipe.deleteMany({});
        await tx.terrain.deleteMany({});
        
        const deletedTournaments = await tx.concours.deleteMany({});

        const deletedUsers = await tx.joueur.deleteMany({
          where: { role: { not: Role.SUPER_ADMIN } },
        });

        return {
          tournaments: deletedTournaments.count,
          users: deletedUsers.count,
        };
      });

      await this.createAuditLog(
        'CLEAR_ALL_DATA',
        actorId,
        null,
        {
          deletedTournaments: result.tournaments,
          deletedUsers: result.users,
          preservedAdmins: stats.adminUsers,
        },
        ipAddress,
      );

      return {
        success: true,
        message: 'All data cleared successfully',
        deleted: {
          tournaments: result.tournaments,
          teams: stats.teams,
          matches: stats.matches,
          users: result.users,
        },
        preserved: {
          adminUsers: stats.adminUsers,
        },
      };
    } catch (error) {
      console.error('Error in clearAllData:', error);
      throw error;
    }
  }

  async listAuditLogs(action?: string, page = 1, limit = 50) {
    const where = action ? { action } : {};

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { email: true, nom: true, prenom: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, page, limit };
  }

  async cleanupOldAuditLogs() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 15);

    const result = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return { deleted: result.count };
  }

  private async createAuditLog(
    action: string,
    actorId: string,
    targetId: string | null,
    details: any,
    ipAddress?: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        action,
        actorId,
        targetId,
        details,
        ipAddress,
      },
    });
  }
}
