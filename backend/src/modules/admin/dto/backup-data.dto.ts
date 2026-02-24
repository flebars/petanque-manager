export interface BackupDataDto {
  exportedAt: string;
  exportedBy: string;
  version: string;
  counts: {
    joueurs: number;
    concours: number;
    equipes: number;
    parties: number;
    classements: number;
    poules: number;
    terrains: number;
  };
  data: {
    joueurs: any[];
    concours: any[];
    equipes: any[];
    parties: any[];
    classements: any[];
    classementsJoueurs: any[];
    poules: any[];
    pouleEquipes: any[];
    terrains: any[];
    tirageLogs: any[];
  };
}
