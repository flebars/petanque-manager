export type Role = 'SUPER_ADMIN' | 'ORGANISATEUR' | 'ARBITRE' | 'CAPITAINE' | 'SPECTATEUR';
export type Genre = 'H' | 'F';
export type Categorie = 'SENIOR' | 'VETERAN' | 'FEMININ' | 'JEUNE';
export type FormatConcours = 'MELEE' | 'COUPE' | 'CHAMPIONNAT';
export type TypeEquipe = 'TETE_A_TETE' | 'DOUBLETTE' | 'TRIPLETTE';
export type ModeConstitution = 'MELEE_DEMELEE' | 'MELEE' | 'MONTEE';
export type StatutConcours = 'INSCRIPTION' | 'EN_COURS' | 'TERMINE';
export type StatutEquipe = 'INSCRITE' | 'PRESENTE' | 'FORFAIT' | 'DISQUALIFIEE';
export type StatutPartie = 'A_JOUER' | 'EN_COURS' | 'TERMINEE' | 'LITIGE' | 'FORFAIT';
export type TypePartie =
  | 'MELEE'
  | 'COUPE_PRINCIPALE'
  | 'COUPE_CONSOLANTE'
  | 'CHAMPIONNAT_POULE'
  | 'CHAMPIONNAT_FINALE';

export interface Joueur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  genre: Genre;
  dateNaissance?: string;
  licenceFfpjp?: string;
  club?: string;
  categorie: Categorie;
  role: Role;
  createdAt: string;
}

export interface EquipeJoueur {
  equipeId: string;
  joueurId: string;
  joueur: Joueur;
}

export interface Equipe {
  id: string;
  concoursId: string;
  nom?: string;
  numeroTirage?: number;
  statut: StatutEquipe;
  joueurs: EquipeJoueur[];
  createdAt: string;
}

export interface Terrain {
  id: string;
  concoursId: string;
  numero: number;
  emplacement?: string;
}

export interface ConcoursParams {
  nbTours?: number;
  taillePoule?: number;
  consolante?: boolean;
}

export interface Concours {
  id: string;
  nom: string;
  lieu?: string;
  format: FormatConcours;
  typeEquipe: TypeEquipe;
  modeConstitution: ModeConstitution;
  statut: StatutConcours;
  nbTerrains: number;
  maxParticipants?: number;
  dateDebut: string;
  dateFin: string;
  params: ConcoursParams;
  organisateurId: string;
  organisateur?: Pick<Joueur, 'id' | 'nom' | 'prenom' | 'email'>;
  equipes: Equipe[];
  terrains: Terrain[];
  createdAt: string;
}

export interface Partie {
  id: string;
  concoursId: string;
  tour?: number;
  pouleId?: string;
  equipeAId: string;
  equipeBId: string;
  terrainId?: string;
  scoreA?: number;
  scoreB?: number;
  statut: StatutPartie;
  type: TypePartie;
  bracketRonde?: number;
  bracketPos?: number;
  heureDebut?: string;
  heureFin?: string;
  notes?: string;
  equipeA?: Equipe;
  equipeB?: Equipe;
  terrain?: Terrain;
}

export interface Classement {
  id: string;
  concoursId: string;
  equipeId: string;
  victoires: number;
  defaites: number;
  pointsMarques: number;
  pointsEncaisses: number;
  quotient: number;
  rang?: number;
  equipe?: Equipe;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtUser {
  sub: string;
  email: string;
  role: Role;
}
