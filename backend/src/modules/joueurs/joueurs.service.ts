import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateJoueurDto } from './dto/create-joueur.dto';
import { UpdateJoueurDto } from './dto/update-joueur.dto';
import { Joueur } from '@prisma/client';

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
}
