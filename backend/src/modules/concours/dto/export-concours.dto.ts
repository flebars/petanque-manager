import { FormatConcours, TypeEquipe, ModeConstitution, Genre, Categorie } from '@prisma/client';

export interface ExportedPlayer {
  email: string;
  nom: string;
  prenom: string;
  genre: Genre;
  dateNaissance?: string;
  licenceFfpjp?: string;
  club?: string;
  categorie: Categorie;
}

export interface ExportedTeam {
  nom?: string;
  playerEmails: string[];
}

export interface ExportedTournamentConfig {
  nom: string;
  lieu?: string;
  format: FormatConcours;
  typeEquipe: TypeEquipe;
  modeConstitution: ModeConstitution;
  nbTerrains: number;
  maxParticipants?: number;
  dateDebut: string;
  dateFin: string;
  params: {
    nbTours?: number;
    taillePoule?: number;
    consolante?: boolean;
  };
}

export class ExportConcoursDto {
  version: string;
  exportedAt: string;
  tournament: ExportedTournamentConfig;
  players: ExportedPlayer[];
  teams?: ExportedTeam[];
}
