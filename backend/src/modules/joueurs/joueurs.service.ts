import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateJoueurDto } from './dto/create-joueur.dto';
import { UpdateJoueurDto } from './dto/update-joueur.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Joueur } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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

  async update(id: string, dto: UpdateJoueurDto): Promise<Joueur> {
    await this.findOne(id);
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
}
