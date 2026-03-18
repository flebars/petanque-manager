import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateJoueurDto } from './dto/create-joueur.dto';
import { UpdateJoueurDto } from './dto/update-joueur.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Joueur, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { JwtPayload } from '@/modules/auth/strategies/jwt.strategy';

@Injectable()
export class JoueursService {
  constructor(private prisma: PrismaService) {}

  findAll(email?: string): Promise<Joueur[]> {
    return this.prisma.joueur.findMany({
      where: email ? { email: { contains: email, mode: 'insensitive' } } : undefined,
      orderBy: { nom: 'asc' },
    });
  }

  async findOne(id: string): Promise<Joueur> {
    const joueur = await this.prisma.joueur.findUnique({ where: { id } });
    if (!joueur) throw new NotFoundException(`Joueur ${id} introuvable`);
    return joueur;
  }

  async findByEmail(email: string): Promise<Joueur | null> {
    return this.prisma.joueur.findUnique({ where: { email } });
  }

  async create(dto: CreateJoueurDto): Promise<Joueur> {
    return this.prisma.joueur.create({
      data: {
        ...dto,
        passwordHash: '',
        dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateJoueurDto, user: JwtPayload): Promise<Joueur> {
    await this.findOne(id);

    if (id !== user.sub && user.role !== Role.SUPER_ADMIN && user.role !== Role.ORGANISATEUR) {
      throw new ForbiddenException('Vous ne pouvez modifier que votre propre profil');
    }

    return this.prisma.joueur.update({
      where: { id },
      data: {
        ...dto,
        dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : undefined,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.joueur.delete({ where: { id } });
  }

  async changePassword(joueurId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const joueur = await this.prisma.joueur.findUnique({
      where: { id: joueurId },
      select: { id: true, passwordHash: true },
    });

    if (!joueur) throw new NotFoundException(`Joueur ${joueurId} introuvable`);

    const isValid = await bcrypt.compare(dto.oldPassword, joueur.passwordHash);
    if (!isValid) throw new UnauthorizedException('Ancien mot de passe incorrect');

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.joueur.update({
      where: { id: joueurId },
      data: { passwordHash: newHash },
    });

    return { message: 'Mot de passe modifié avec succès' };
  }

  async findOrCreateByEmail(
    email: string,
    data: Partial<Omit<Joueur, 'id' | 'passwordHash' | 'createdAt' | 'updatedAt'>> & {
      dateNaissance?: Date | string | null;
    },
  ): Promise<Joueur> {
    const existing = await this.prisma.joueur.findUnique({ where: { email } });
    if (existing) return existing;

    return this.prisma.joueur.create({
      data: {
        email,
        nom: data.nom || '',
        prenom: data.prenom || '',
        genre: data.genre || 'H',
        categorie: data.categorie || 'SENIOR',
        role: data.role || Role.SPECTATEUR,
        passwordHash: '',
        dateNaissance: data.dateNaissance ? new Date(data.dateNaissance) : undefined,
        licenceFfpjp: data.licenceFfpjp,
        club: data.club,
      },
    });
  }
}
