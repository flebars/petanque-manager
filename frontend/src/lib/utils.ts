import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Check if a team is a TBD placeholder
 */
export function isTbdTeam(equipe: { nom?: string | null } | null | undefined): boolean {
  return equipe?.nom === '__TBD__';
}

/**
 * Check if a team is a BYE placeholder
 */
export function isByeTeam(equipe: { nom?: string | null } | null | undefined): boolean {
  return equipe?.nom === '__BYE__';
}

/**
 * Get team display name
 * - Returns 'À déterminer' for TBD placeholder teams
 * - Returns 'Bye' for BYE placeholder teams
 * - Returns team name or player names for real teams
 */
export function nomEquipe(equipe: { nom?: string | null; joueurs?: Array<{ joueur: { nom: string; prenom: string } }> }): string {
  if (isTbdTeam(equipe)) return 'À déterminer';
  if (isByeTeam(equipe)) return 'Bye';
  if (equipe.nom) return equipe.nom;
  if (!equipe.joueurs || equipe.joueurs.length === 0) return 'Équipe inconnue';
  return equipe.joueurs.map((j) => `${j.joueur.prenom} ${j.joueur.nom}`).join(' / ');
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export const FORMAT_LABELS: Record<string, string> = {
  MELEE: 'Mêlée',
  COUPE: 'Coupe',
  CHAMPIONNAT: 'Championnat',
};

export const TYPE_EQUIPE_LABELS: Record<string, string> = {
  TETE_A_TETE: 'Tête-à-tête',
  DOUBLETTE: 'Doublette',
  TRIPLETTE: 'Triplette',
};

export const MODE_CONSTITUTION_LABELS: Record<string, string> = {
  MELEE_DEMELEE: 'Mêlée-Démêlée',
  MELEE: 'Mêlée',
  MONTEE: 'Montée',
};

export const STATUT_CONCOURS_LABELS: Record<string, string> = {
  INSCRIPTION: 'Inscriptions ouvertes',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
};

export const STATUT_PARTIE_LABELS: Record<string, string> = {
  A_MONTER: 'En attente',
  A_JOUER: 'À jouer',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  LITIGE: 'Litige',
  FORFAIT: 'Forfait',
};
