import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Classement, StatutPartie } from '@prisma/client';

@Injectable()
export class ClassementService {
  constructor(private prisma: PrismaService) {}

  async findByConcours(concoursId: string): Promise<Classement[]> {
    return this.prisma.classement.findMany({
      where: { concoursId },
      include: { equipe: { include: { joueurs: { include: { joueur: true } } } } },
      orderBy: [
        { rang: 'asc' },
        { victoires: 'desc' },
        { quotient: 'desc' },
        { pointsMarques: 'desc' },
      ],
    });
  }

  async recalculer(concoursId: string): Promise<void> {
    const parties = await this.prisma.partie.findMany({
      where: { concoursId, statut: { in: [StatutPartie.TERMINEE, StatutPartie.FORFAIT] } },
    });

    const stats = new Map<
      string,
      { victoires: number; defaites: number; pointsMarques: number; pointsEncaisses: number }
    >();

    for (const partie of parties) {
      if (partie.scoreA === null || partie.scoreB === null) continue;
      if (partie.equipeAId === partie.equipeBId) {
        const s = stats.get(partie.equipeAId) ?? {
          victoires: 0, defaites: 0, pointsMarques: 0, pointsEncaisses: 0,
        };
        s.victoires += 1;
        s.pointsMarques += 13;
        stats.set(partie.equipeAId, s);
        continue;
      }

      const sA = stats.get(partie.equipeAId) ?? {
        victoires: 0, defaites: 0, pointsMarques: 0, pointsEncaisses: 0,
      };
      const sB = stats.get(partie.equipeBId) ?? {
        victoires: 0, defaites: 0, pointsMarques: 0, pointsEncaisses: 0,
      };

      sA.pointsMarques += partie.scoreA;
      sA.pointsEncaisses += partie.scoreB;
      sB.pointsMarques += partie.scoreB;
      sB.pointsEncaisses += partie.scoreA;

      if (partie.scoreA > partie.scoreB) {
        sA.victoires += 1;
        sB.defaites += 1;
      } else {
        sB.victoires += 1;
        sA.defaites += 1;
      }

      stats.set(partie.equipeAId, sA);
      stats.set(partie.equipeBId, sB);
    }

    for (const [equipeId, s] of stats.entries()) {
      const quotient = s.pointsEncaisses === 0
        ? s.pointsMarques
        : s.pointsMarques / s.pointsEncaisses;

      await this.prisma.classement.upsert({
        where: { concoursId_equipeId: { concoursId, equipeId } },
        update: { ...s, quotient },
        create: { concoursId, equipeId, ...s, quotient },
      });
    }

    await this.assignerRangs(concoursId);
  }

  private async assignerRangs(concoursId: string): Promise<void> {
    const classements = await this.prisma.classement.findMany({
      where: { concoursId },
      orderBy: [
        { victoires: 'desc' },
        { quotient: 'desc' },
        { pointsMarques: 'desc' },
      ],
    });

    for (let i = 0; i < classements.length; i++) {
      await this.prisma.classement.update({
        where: { id: classements[i].id },
        data: { rang: i + 1 },
      });
    }
  }
}
