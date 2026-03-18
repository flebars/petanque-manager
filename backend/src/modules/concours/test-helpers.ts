import {
  Joueur,
  Equipe,
  Concours,
  Genre,
  Categorie,
  FormatConcours,
  TypeEquipe,
  ModeConstitution,
  StatutConcours,
  StatutEquipe,
} from '@prisma/client';
import { ExportConcoursDto } from './dto/export-concours.dto';
import { ImportConcoursDto } from './dto/import-concours.dto';

export function createMockJoueur(overrides?: Partial<Joueur>): Joueur {
  return {
    id: 'player-1',
    email: 'player1@test.com',
    passwordHash: 'hash123',
    nom: 'Dupont',
    prenom: 'Jean',
    genre: Genre.H,
    dateNaissance: new Date('1990-05-15'),
    licenceFfpjp: '123456',
    club: 'Club Test',
    categorie: Categorie.SENIOR,
    role: 'SPECTATEUR' as any,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function createMockEquipe(overrides?: Partial<Equipe & { joueurs: any[] }>): any {
  const { joueurs, ...equipeData } = overrides || {};
  return {
    id: 'equipe-1',
    concoursId: 'concours-1',
    nom: 'Équipe Test',
    numeroTirage: 1,
    tour: null,
    statut: StatutEquipe.INSCRITE,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    joueurs: joueurs || [
      {
        equipeId: 'equipe-1',
        joueurId: 'player-1',
        joueur: createMockJoueur(),
      },
    ],
    ...equipeData,
  };
}

export function createMockConcours(overrides?: Partial<Concours & { equipes: any[] }>): any {
  const { equipes, ...concoursData } = overrides || {};
  return {
    id: 'concours-1',
    nom: 'Grand Prix Test',
    lieu: 'Marseille',
    format: FormatConcours.MELEE,
    typeEquipe: TypeEquipe.DOUBLETTE,
    modeConstitution: ModeConstitution.MONTEE,
    statut: StatutConcours.INSCRIPTION,
    nbTerrains: 4,
    maxParticipants: 32,
    dateDebut: new Date('2026-06-01T09:00:00Z'),
    dateFin: new Date('2026-06-01T18:00:00Z'),
    params: { nbTours: 5 },
    organisateurId: 'user-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    equipes: equipes || [],
    ...concoursData,
  };
}

export function createExportJson(overrides?: Partial<ExportConcoursDto>): ExportConcoursDto {
  return {
    version: '1.0',
    exportedAt: '2026-03-17T10:00:00.000Z',
    tournament: {
      nom: 'Grand Prix Test',
      lieu: 'Marseille',
      format: FormatConcours.MELEE,
      typeEquipe: TypeEquipe.DOUBLETTE,
      modeConstitution: ModeConstitution.MONTEE,
      nbTerrains: 4,
      maxParticipants: 32,
      dateDebut: '2026-06-01T09:00:00.000Z',
      dateFin: '2026-06-01T18:00:00.000Z',
      params: { nbTours: 5 },
    },
    players: [
      {
        email: 'player1@test.com',
        nom: 'Dupont',
        prenom: 'Jean',
        genre: Genre.H,
        dateNaissance: '1990-05-15',
        licenceFfpjp: '123456',
        club: 'Club Test',
        categorie: Categorie.SENIOR,
      },
    ],
    teams: [
      {
        nom: 'Équipe Test',
        playerEmails: ['player1@test.com', 'player2@test.com'],
      },
    ],
    ...overrides,
  };
}

export function createImportJson(overrides?: Partial<ImportConcoursDto>): ImportConcoursDto {
  return {
    version: '1.0',
    exportedAt: '2026-03-17T10:00:00.000Z',
    tournament: {
      nom: 'Grand Prix Test',
      lieu: 'Marseille',
      format: FormatConcours.MELEE,
      typeEquipe: TypeEquipe.DOUBLETTE,
      modeConstitution: ModeConstitution.MONTEE,
      nbTerrains: 4,
      maxParticipants: 32,
      dateDebut: '2026-06-01T09:00:00.000Z',
      dateFin: '2026-06-01T18:00:00.000Z',
      params: { nbTours: 5 },
    },
    players: [
      {
        email: 'player1@test.com',
        nom: 'Dupont',
        prenom: 'Jean',
        genre: Genre.H,
        dateNaissance: '1990-05-15',
        licenceFfpjp: '123456',
        club: 'Club Test',
        categorie: Categorie.SENIOR,
      },
    ],
    teams: [
      {
        nom: 'Équipe Test',
        playerEmails: ['player1@test.com', 'player2@test.com'],
      },
    ],
    ...overrides,
  };
}

export const MOCK_PLAYER_FULL = createMockJoueur({
  id: 'player-full',
  email: 'full@test.com',
  nom: 'Dupont',
  prenom: 'Jean',
  genre: Genre.H,
  dateNaissance: new Date('1990-05-15'),
  licenceFfpjp: '123456',
  club: 'Club Test',
  categorie: Categorie.SENIOR,
});

export const MOCK_PLAYER_MINIMAL = createMockJoueur({
  id: 'player-minimal',
  email: 'minimal@test.com',
  nom: 'Martin',
  prenom: 'Pierre',
  genre: Genre.H,
  dateNaissance: null,
  licenceFfpjp: null,
  club: null,
  categorie: Categorie.SENIOR,
});

export const MOCK_TOURNAMENT_MELEE = createMockConcours({
  format: FormatConcours.MELEE,
  modeConstitution: ModeConstitution.MELEE,
  params: { nbTours: 5 },
});

export const MOCK_TOURNAMENT_COUPE = createMockConcours({
  format: FormatConcours.COUPE,
  modeConstitution: ModeConstitution.MONTEE,
  params: { consolante: true },
});

export const MOCK_TOURNAMENT_CHAMPIONNAT = createMockConcours({
  format: FormatConcours.CHAMPIONNAT,
  modeConstitution: ModeConstitution.MONTEE,
  params: { taillePoule: 4 },
});
