import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateConcoursDto } from './dto/create-concours.dto';
import { UpdateConcoursDto } from './dto/update-concours.dto';
import { ExportConcoursDto } from './dto/export-concours.dto';
import { ImportConcoursDto } from './dto/import-concours.dto';
import { Concours, ModeConstitution, StatutConcours, FormatConcours, TypeEquipe, Role } from '@prisma/client';
import { constituerEquipesMelee } from '@/modules/tirage/tirage.service';
import { ChampionnatService } from '@/modules/parties/championnat.service';
import { JoueursService } from '@/modules/joueurs/joueurs.service';

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
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChampionnatService))
    private championnatService: ChampionnatService,
    private joueursService: JoueursService,
  ) {}

  async findAll(): Promise<Concours[]> {
    const concours = await this.prisma.concours.findMany({
      include: { equipes: true, organisateur: { select: { nom: true, prenom: true } } },
      orderBy: { dateDebut: 'desc' },
    });

    return concours.map((c) => ({
      ...c,
      equipes: c.modeConstitution === ModeConstitution.MELEE_DEMELEE
        ? c.equipes.filter((e) => e.tour === null)
        : c.equipes,
    }));
  }

  async findOne(id: string): Promise<Concours> {
    const concours = await this.prisma.concours.findUnique({
      where: { id },
      include: {
        equipes: { include: { joueurs: { include: { joueur: true } } } },
        terrains: true,
        poules: {
          include: {
            equipes: { 
              include: { 
                equipe: {
                  include: {
                    joueurs: { include: { joueur: true } }
                  }
                }
              }
            },
            parties: {
              include: {
                equipeA: { include: { joueurs: { include: { joueur: true } } } },
                equipeB: { include: { joueurs: { include: { joueur: true } } } },
                terrain: true,
              }
            }
          }
        },
        organisateur: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });
    if (!concours) throw new NotFoundException(`Concours ${id} introuvable`);

    return {
      ...concours,
      equipes: concours.modeConstitution === ModeConstitution.MELEE_DEMELEE
        ? (concours as any).equipes.filter((e: any) => e.tour === null)
        : (concours as any).equipes,
    } as unknown as Concours;
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

  async update(id: string, dto: UpdateConcoursDto, userId: string, userRole: Role): Promise<Concours> {
    const concours = await this.findOne(id);
    if (concours.statut !== StatutConcours.INSCRIPTION) {
      throw new BadRequestException('Impossible de modifier un concours déjà démarré');
    }
    if (concours.organisateurId !== userId && userRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Accès refusé');
    }

    if (dto.nbTerrains !== undefined) {
      await this.updateTerrains(id, dto.nbTerrains);
    }

    return this.prisma.concours.update({
      where: { id },
      data: {
        nom: dto.nom,
        dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : undefined,
        dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
        nbTerrains: dto.nbTerrains,
      },
    });
  }

  async updateTerrains(concoursId: string, newCount: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const currentTerrains = await tx.terrain.findMany({
        where: { concoursId },
        orderBy: { numero: 'asc' },
      });

      const currentCount = currentTerrains.length;

      if (newCount > currentCount) {
        const terrainsToCreate = Array.from(
          { length: newCount - currentCount },
          (_, i) => ({
            concoursId,
            numero: currentCount + i + 1,
          }),
        );
        await tx.terrain.createMany({ data: terrainsToCreate });
      } else if (newCount < currentCount) {
        const terrainsToDelete = currentTerrains.slice(newCount);
        const terrainIdsToDelete = terrainsToDelete.map((t) => t.id);

        const matchesOnDeletedTerrains = await tx.partie.findMany({
          where: { terrainId: { in: terrainIdsToDelete } },
        });

        if (matchesOnDeletedTerrains.length > 0) {
          const remainingTerrains = currentTerrains.slice(0, newCount);
          const terrainCounts = new Map<string, number>(
            remainingTerrains.map((t) => [t.id, 0]),
          );

          for (const terrain of remainingTerrains) {
            const count = await tx.partie.count({
              where: { terrainId: terrain.id },
            });
            terrainCounts.set(terrain.id, count);
          }

          for (const match of matchesOnDeletedTerrains) {
            let minTerrainId = remainingTerrains[0].id;
            let minCount = terrainCounts.get(minTerrainId) ?? 0;

            for (const [terrainId, count] of terrainCounts) {
              if (count < minCount) {
                minCount = count;
                minTerrainId = terrainId;
              }
            }

            await tx.partie.update({
              where: { id: match.id },
              data: { terrainId: minTerrainId },
            });
            terrainCounts.set(minTerrainId, minCount + 1);
          }
        }

        await tx.terrain.deleteMany({
          where: { id: { in: terrainIdsToDelete } },
        });
      }
    });
  }

  async remove(id: string, userId: string, userRole: Role): Promise<void> {
    const concours = await this.findOne(id);
    if (concours.organisateurId !== userId && userRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Accès refusé');
    }
    await this.prisma.concours.delete({ where: { id } });
  }

  async demarrer(id: string, userId: string, userRole: Role): Promise<Concours> {
    const concours = await this.findOne(id);
    if (concours.organisateurId !== userId && userRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Accès refusé');
    }
    if (concours.statut !== StatutConcours.INSCRIPTION) {
      throw new BadRequestException('Le concours est déjà démarré ou terminé');
    }

    const equipes = (concours as any).equipes as any[];
    if (equipes.length < 2) {
      throw new BadRequestException('Au moins 2 participants sont nécessaires');
    }

    await this.prisma.equipe.updateMany({
      where: {
        concoursId: id,
        statut: 'INSCRITE',
      },
      data: {
        statut: 'PRESENTE',
      },
    });

    // Modes MELEE et MELEE_DEMELEE : regrouper les joueurs individuels en équipes
    // avant le premier tirage. Pour MELEE les équipes restent fixes ; pour
    // MELEE_DEMELEE elles seront redisssoutes et reformées à chaque tour suivant.
    if (
      concours.modeConstitution === ModeConstitution.MELEE ||
      concours.modeConstitution === ModeConstitution.MELEE_DEMELEE
    ) {
      await this.constituerEquipes(
        concours.id,
        equipes,
        concours.typeEquipe as TypeEquipe,
        concours.modeConstitution,
      );
    }

    if (concours.format === FormatConcours.CHAMPIONNAT) {
      await this.championnatService.lancerPoules(id);
    }

    return this.prisma.concours.update({
      where: { id },
      data: { statut: StatutConcours.EN_COURS },
    });
  }

  /**
   * Regroupe les inscriptions individuelles (1 joueur/equipe) en vraies équipes
   * multi-joueurs selon typeEquipe.
   * 
   * Pour MELEE: supprime les équipes individuelles et crée les nouvelles équipes (tour=null).
   * Pour MELEE_DEMELEE: conserve les inscriptions individuelles (tour=null) et crée
   * les équipes du tour 1 (tour=1).
   */
  async constituerEquipes(
    concoursId: string,
    equipesSolo: Array<{ id: string; joueurs: Array<{ joueurId: string }> }>,
    typeEquipe: TypeEquipe,
    modeConstitution: ModeConstitution,
  ): Promise<void> {
    const taille = TAILLE_EQUIPE[typeEquipe];

    // Récupérer les IDs de tous les joueurs inscrits (1 par equipe solo)
    const joueurIds = equipesSolo.flatMap((e) => e.joueurs.map((ej) => ej.joueurId));

    if (joueurIds.length < 2) return;

    const seed = `${Date.now()}-${Math.random()}`;
    const groupes = constituerEquipesMelee(joueurIds, taille, seed);

    await this.prisma.$transaction(async (tx) => {
      // Pour MELEE_DEMELEE, conserver les inscriptions individuelles (tour=null)
      // Pour MELEE, supprimer les équipes solo
      if (modeConstitution !== ModeConstitution.MELEE_DEMELEE) {
        await tx.equipe.deleteMany({ where: { concoursId } });
      }

      // Créer les nouvelles équipes groupées
      // MELEE_DEMELEE: tour=1 (équipes éphémères pour le premier tour)
      // MELEE: tour=null (équipes permanentes)
      const tourValue = modeConstitution === ModeConstitution.MELEE_DEMELEE ? 1 : null;

      for (let i = 0; i < groupes.length; i++) {
        await tx.equipe.create({
          data: {
            concoursId,
            numeroTirage: i + 1,
            tour: tourValue,
            statut: 'PRESENTE',
            joueurs: {
              create: groupes[i].map((joueurId) => ({ joueurId })),
            },
          },
        });
      }
    });
  }

  async terminer(id: string, userId: string, userRole: Role): Promise<Concours> {
    const concours = await this.findOne(id);
    if (concours.organisateurId !== userId && userRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Accès refusé');
    }
    if (concours.statut !== StatutConcours.EN_COURS) {
      throw new BadRequestException('Le concours n\'est pas en cours');
    }
    return this.prisma.concours.update({
      where: { id },
      data: { statut: StatutConcours.TERMINE },
    });
  }

  async exportConcours(id: string): Promise<ExportConcoursDto> {
    const concours = await this.prisma.concours.findUnique({
      where: { id },
      include: {
        equipes: {
          include: {
            joueurs: { include: { joueur: true } },
          },
        },
      },
    });

    if (!concours) throw new NotFoundException(`Concours ${id} introuvable`);

    const equipesToExport = concours.modeConstitution === ModeConstitution.MELEE_DEMELEE
      ? concours.equipes.filter((e) => e.tour === null)
      : concours.equipes;

    const realEquipes = equipesToExport.filter(
      (e) => e.nom !== '__TBD__' && e.nom !== '__BYE__' && e.joueurs.length > 0,
    );

    const playerMap = new Map<string, any>();
    realEquipes.forEach((equipe) => {
      equipe.joueurs.forEach((ej) => {
        if (!playerMap.has(ej.joueur.email)) {
          playerMap.set(ej.joueur.email, {
            email: ej.joueur.email,
            nom: ej.joueur.nom,
            prenom: ej.joueur.prenom,
            genre: ej.joueur.genre,
            dateNaissance: ej.joueur.dateNaissance?.toISOString().split('T')[0],
            licenceFfpjp: ej.joueur.licenceFfpjp || undefined,
            club: ej.joueur.club || undefined,
            categorie: ej.joueur.categorie,
          });
        }
      });
    });

    const exportDto: ExportConcoursDto = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tournament: {
        nom: concours.nom,
        lieu: concours.lieu || undefined,
        format: concours.format,
        typeEquipe: concours.typeEquipe,
        modeConstitution: concours.modeConstitution,
        nbTerrains: concours.nbTerrains,
        maxParticipants: concours.maxParticipants || undefined,
        dateDebut: concours.dateDebut.toISOString(),
        dateFin: concours.dateFin.toISOString(),
        params: concours.params as any,
      },
      players: Array.from(playerMap.values()),
    };

    if (concours.modeConstitution === ModeConstitution.MONTEE) {
      exportDto.teams = realEquipes.map((equipe) => ({
        nom: equipe.nom || undefined,
        playerEmails: equipe.joueurs.map((ej) => ej.joueur.email),
      }));
    }

    return exportDto;
  }

  async importConcours(dto: ImportConcoursDto, organisateurId: string): Promise<Concours> {
    if (dto.version !== '1.0') {
      throw new BadRequestException(`Version non supportée: ${dto.version}. Version attendue: 1.0`);
    }

    const taille = TAILLE_EQUIPE[dto.tournament.typeEquipe];

    if (dto.tournament.modeConstitution === ModeConstitution.MONTEE) {
      if (!dto.teams || dto.teams.length === 0) {
        throw new BadRequestException('Le mode MONTEE nécessite des équipes pré-constituées');
      }
      
      const validTeams = dto.teams.filter(
        (team) => team.playerEmails && team.playerEmails.length > 0 && 
        team.nom !== '__TBD__' && team.nom !== '__BYE__'
      );

      for (const team of validTeams) {
        if (team.playerEmails.length !== taille) {
          throw new BadRequestException(
            `Chaque équipe doit avoir ${taille} joueur(s) pour ${dto.tournament.typeEquipe}`,
          );
        }
      }
      
      dto.teams = validTeams;
    } else {
      if (dto.teams && dto.teams.length > 0) {
        throw new BadRequestException(
          'Les équipes pré-constituées ne sont autorisées que pour le mode MONTEE',
        );
      }
    }

    if (dto.players.length > 1000) {
      throw new BadRequestException('Import limité à 1000 joueurs maximum');
    }

    const dateDebut = new Date(dto.tournament.dateDebut);
    if (dateDebut < new Date()) {
      console.warn(`Import d'un concours avec date de début dans le passé: ${dto.tournament.nom}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const emailToJoueurId = new Map<string, string>();

      for (const playerDto of dto.players) {
        const joueur = await this.joueursService.findOrCreateByEmail(playerDto.email, {
          nom: playerDto.nom,
          prenom: playerDto.prenom,
          genre: playerDto.genre,
          dateNaissance: playerDto.dateNaissance as any,
          licenceFfpjp: playerDto.licenceFfpjp,
          club: playerDto.club,
          categorie: playerDto.categorie,
          role: Role.SPECTATEUR,
        });
        emailToJoueurId.set(playerDto.email, joueur.id);
      }

      const params: any = {};
      if (dto.tournament.params?.nbTours) params.nbTours = dto.tournament.params.nbTours;
      if (dto.tournament.params?.taillePoule) params.taillePoule = dto.tournament.params.taillePoule;
      if (dto.tournament.params?.consolante !== undefined) {
        params.consolante = dto.tournament.params.consolante;
      }

      const concours = await tx.concours.create({
        data: {
          nom: dto.tournament.nom,
          lieu: dto.tournament.lieu,
          format: dto.tournament.format,
          typeEquipe: dto.tournament.typeEquipe,
          modeConstitution: dto.tournament.modeConstitution,
          nbTerrains: dto.tournament.nbTerrains,
          maxParticipants: dto.tournament.maxParticipants,
          dateDebut: new Date(dto.tournament.dateDebut),
          dateFin: new Date(dto.tournament.dateFin),
          params,
          organisateurId,
        },
      });

      await tx.terrain.createMany({
        data: Array.from({ length: dto.tournament.nbTerrains }, (_, i) => ({
          concoursId: concours.id,
          numero: i + 1,
        })),
      });

      if (dto.tournament.modeConstitution === ModeConstitution.MONTEE && dto.teams) {
        for (let i = 0; i < dto.teams.length; i++) {
          const team = dto.teams[i];
          const joueurIds = team.playerEmails.map((email) => {
            const joueurId = emailToJoueurId.get(email);
            if (!joueurId) {
              throw new BadRequestException(`Joueur avec email ${email} introuvable`);
            }
            return joueurId;
          });

          await tx.equipe.create({
            data: {
              concoursId: concours.id,
              nom: team.nom,
              numeroTirage: i + 1,
              statut: 'INSCRITE',
              joueurs: {
                create: joueurIds.map((joueurId) => ({ joueurId })),
              },
            },
          });
        }
      } else {
        for (let i = 0; i < dto.players.length; i++) {
          const joueurId = emailToJoueurId.get(dto.players[i].email);
          if (!joueurId) continue;

          await tx.equipe.create({
            data: {
              concoursId: concours.id,
              numeroTirage: i + 1,
              statut: 'INSCRITE',
              joueurs: {
                create: [{ joueurId }],
              },
            },
          });
        }
      }

      return tx.concours.findUnique({
        where: { id: concours.id },
        include: {
          equipes: { include: { joueurs: { include: { joueur: true } } } },
          terrains: true,
          organisateur: { select: { id: true, nom: true, prenom: true, email: true } },
        },
      }) as Promise<Concours>;
    });
  }
}
