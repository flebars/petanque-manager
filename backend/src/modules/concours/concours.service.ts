import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateConcoursDto } from './dto/create-concours.dto';
import { UpdateConcoursDto } from './dto/update-concours.dto';
import { Concours, ModeConstitution, StatutConcours, FormatConcours, TypeEquipe } from '@prisma/client';
import { constituerEquipesMelee } from '@/modules/tirage/tirage.service';

type ConcoursParams = {
  nbTours?: number;
  taillePoule?: number;
  consolante?: boolean;
};

const TAILLE_EQUIPE: Record<TypeEquipe, number> = {
  TETE_A_TETE: 1,
  DOUBLETTE: 2,
  TRIPLETTE: 3,
};

@Injectable()
export class ConcoursService {
  constructor(private prisma: PrismaService) {}

  findAll(): Promise<Concours[]> {
    return this.prisma.concours.findMany({
      include: { equipes: true, organisateur: { select: { nom: true, prenom: true } } },
      orderBy: { dateDebut: 'desc' },
    });
  }

  async findOne(id: string): Promise<Concours> {
    const concours = await this.prisma.concours.findUnique({
      where: { id },
      include: {
        equipes: { include: { joueurs: { include: { joueur: true } } } },
        terrains: true,
        organisateur: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });
    if (!concours) throw new NotFoundException(`Concours ${id} introuvable`);
    return concours;
  }

  async create(dto: CreateConcoursDto, organisateurId: string): Promise<Concours> {
    const params: ConcoursParams = {};
    if (dto.format === FormatConcours.MELEE && dto.nbTours) params.nbTours = dto.nbTours;
    if (dto.format === FormatConcours.CHAMPIONNAT && dto.taillePoule) {
      params.taillePoule = dto.taillePoule;
    }
    if (dto.format === FormatConcours.COUPE && dto.consolante !== undefined) {
      params.consolante = dto.consolante;
    }

    const concours = await this.prisma.concours.create({
      data: {
        nom: dto.nom,
        lieu: dto.lieu,
        format: dto.format,
        typeEquipe: dto.typeEquipe,
        modeConstitution: dto.modeConstitution,
        nbTerrains: dto.nbTerrains,
        maxParticipants: dto.maxParticipants,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        params,
        organisateurId,
      },
    });

    await this.prisma.terrain.createMany({
      data: Array.from({ length: dto.nbTerrains }, (_, i) => ({
        concoursId: concours.id,
        numero: i + 1,
      })),
    });

    return this.findOne(concours.id);
  }

  async update(id: string, dto: UpdateConcoursDto, userId: string): Promise<Concours> {
    const concours = await this.findOne(id);
    if (concours.statut !== StatutConcours.INSCRIPTION) {
      throw new BadRequestException('Impossible de modifier un concours déjà démarré');
    }
    if (concours.organisateurId !== userId) {
      throw new ForbiddenException('Accès refusé');
    }

    return this.prisma.concours.update({
      where: { id },
      data: {
        nom: dto.nom,
        lieu: dto.lieu,
        maxParticipants: dto.maxParticipants,
        dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : undefined,
        dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
      },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const concours = await this.findOne(id);
    if (concours.organisateurId !== userId) throw new ForbiddenException('Accès refusé');
    await this.prisma.concours.delete({ where: { id } });
  }

  async demarrer(id: string, userId: string): Promise<Concours> {
    const concours = await this.findOne(id);
    if (concours.organisateurId !== userId) throw new ForbiddenException('Accès refusé');
    if (concours.statut !== StatutConcours.INSCRIPTION) {
      throw new BadRequestException('Le concours est déjà démarré ou terminé');
    }

    const equipes = concours.equipes as any[];
    if (equipes.length < 2) {
      throw new BadRequestException('Au moins 2 participants sont nécessaires');
    }

    // Modes MELEE et MELEE_DEMELEE : regrouper les joueurs individuels en équipes
    // avant le premier tirage. Pour MELEE les équipes restent fixes ; pour
    // MELEE_DEMELEE elles seront redisssoutes et reformées à chaque tour suivant.
    if (
      concours.modeConstitution === ModeConstitution.MELEE ||
      concours.modeConstitution === ModeConstitution.MELEE_DEMELEE
    ) {
      await this.constituerEquipes(concours.id, equipes, concours.typeEquipe as TypeEquipe);
    }

    return this.prisma.concours.update({
      where: { id },
      data: { statut: StatutConcours.EN_COURS },
    });
  }

  /**
   * Regroupe les inscriptions individuelles (1 joueur/equipe) en vraies équipes
   * multi-joueurs selon typeEquipe. Supprime les équipes individuelles et crée
   * les nouvelles équipes groupées dans la même transaction.
   */
  async constituerEquipes(
    concoursId: string,
    equipesSolo: Array<{ id: string; joueurs: Array<{ joueurId: string }> }>,
    typeEquipe: TypeEquipe,
  ): Promise<void> {
    const taille = TAILLE_EQUIPE[typeEquipe];

    // Récupérer les IDs de tous les joueurs inscrits (1 par equipe solo)
    const joueurIds = equipesSolo.flatMap((e) => e.joueurs.map((ej) => ej.joueurId));

    if (joueurIds.length < 2) return;

    const seed = `${Date.now()}-${Math.random()}`;
    const groupes = constituerEquipesMelee(joueurIds, taille, seed);

    await this.prisma.$transaction(async (tx) => {
      // Supprimer toutes les équipes solo existantes
      await tx.equipe.deleteMany({ where: { concoursId } });

      // Créer les nouvelles équipes groupées
      for (let i = 0; i < groupes.length; i++) {
        await tx.equipe.create({
          data: {
            concoursId,
            numeroTirage: i + 1,
            statut: 'PRESENTE',
            joueurs: {
              create: groupes[i].map((joueurId) => ({ joueurId })),
            },
          },
        });
      }
    });
  }

  async terminer(id: string, userId: string): Promise<Concours> {
    const concours = await this.findOne(id);
    if (concours.organisateurId !== userId) throw new ForbiddenException('Accès refusé');
    if (concours.statut !== StatutConcours.EN_COURS) {
      throw new BadRequestException('Le concours n\'est pas en cours');
    }
    return this.prisma.concours.update({
      where: { id },
      data: { statut: StatutConcours.TERMINE },
    });
  }
}
