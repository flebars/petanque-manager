import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Classement, ClassementJoueur, StatutPartie, ModeConstitution } from '@prisma/client';

@Injectable()
export class ClassementService {
  constructor(private prisma: PrismaService) {}

  async findByConcours(concoursId: string): Promise<Classement[] | ClassementJoueur[]> {
    const concours = await this.prisma.concours.findUnique({
      where: { id: concoursId },
      select: { modeConstitution: true },
    });

    if (concours?.modeConstitution === ModeConstitution.MELEE_DEMELEE) {
      return this.prisma.classementJoueur.findMany({
        where: { concoursId },
        include: { joueur: true },
        orderBy: [
          { rang: 'asc' },
          { victoires: 'desc' },
          { quotient: 'desc' },
          { pointsMarques: 'desc' },
        ],
      });
    }

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
    const concours = await this.prisma.concours.findUnique({
      where: { id: concoursId },
      select: { modeConstitution: true },
    });

    if (concours?.modeConstitution === ModeConstitution.MELEE_DEMELEE) {
      await this.recalculerJoueurs(concoursId);
    } else {
      await this.recalculerEquipes(concoursId);
    }
  }

  private async recalculerEquipes(concoursId: string): Promise<void> {
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

    await this.assignerRangsEquipes(concoursId);
  }

  private async recalculerJoueurs(concoursId: string): Promise<void> {
    const parties = await this.prisma.partie.findMany({
      where: { concoursId, statut: { in: [StatutPartie.TERMINEE, StatutPartie.FORFAIT] } },
      include: {
        equipeA: { include: { joueurs: true } },
        equipeB: { include: { joueurs: true } },
      },
    });

    const stats = new Map<
      string,
      { victoires: number; defaites: number; pointsMarques: number; pointsEncaisses: number }
    >();

    for (const partie of parties) {
      if (partie.scoreA === null || partie.scoreB === null) continue;

      const joueursA = partie.equipeA.joueurs.map((ej) => ej.joueurId);
      const joueursB = partie.equipeB.joueurs.map((ej) => ej.joueurId);

      if (partie.equipeAId === partie.equipeBId) {
        for (const joueurId of joueursA) {
          const s = stats.get(joueurId) ?? {
            victoires: 0, defaites: 0, pointsMarques: 0, pointsEncaisses: 0,
          };
          s.victoires += 1;
          s.pointsMarques += 13;
          stats.set(joueurId, s);
        }
        continue;
      }

      for (const joueurId of joueursA) {
        const s = stats.get(joueurId) ?? {
          victoires: 0, defaites: 0, pointsMarques: 0, pointsEncaisses: 0,
        };
        s.pointsMarques += partie.scoreA;
        s.pointsEncaisses += partie.scoreB;
        if (partie.scoreA > partie.scoreB) {
          s.victoires += 1;
        } else {
          s.defaites += 1;
        }
        stats.set(joueurId, s);
      }

      for (const joueurId of joueursB) {
        const s = stats.get(joueurId) ?? {
          victoires: 0, defaites: 0, pointsMarques: 0, pointsEncaisses: 0,
        };
        s.pointsMarques += partie.scoreB;
        s.pointsEncaisses += partie.scoreA;
        if (partie.scoreB > partie.scoreA) {
          s.victoires += 1;
        } else {
          s.defaites += 1;
        }
        stats.set(joueurId, s);
      }
    }

    for (const [joueurId, s] of stats.entries()) {
      const quotient = s.pointsEncaisses === 0
        ? s.pointsMarques
        : s.pointsMarques / s.pointsEncaisses;

      await this.prisma.classementJoueur.upsert({
        where: { concoursId_joueurId: { concoursId, joueurId } },
        update: { ...s, quotient },
        create: { concoursId, joueurId, ...s, quotient },
      });
    }

    await this.assignerRangsJoueurs(concoursId);
  }

  private async assignerRangsEquipes(concoursId: string): Promise<void> {
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

  private async assignerRangsJoueurs(concoursId: string): Promise<void> {
    const classements = await this.prisma.classementJoueur.findMany({
      where: { concoursId },
      orderBy: [
        { victoires: 'desc' },
        { quotient: 'desc' },
        { pointsMarques: 'desc' },
      ],
    });

    for (let i = 0; i < classements.length; i++) {
      await this.prisma.classementJoueur.update({
        where: { id: classements[i].id },
        data: { rang: i + 1 },
      });
    }
  }
}
