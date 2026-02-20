import { api } from './client';
import { Partie } from '@/types';

export const partiesApi = {
  listByConcours: (concoursId: string): Promise<Partie[]> =>
    api.get<Partie[]>('/parties', { params: { concoursId } }).then((r) => r.data),

  get: (id: string): Promise<Partie> => api.get<Partie>(`/parties/${id}`).then((r) => r.data),

  demarrer: (id: string): Promise<Partie> =>
    api.post<Partie>(`/parties/${id}/demarrer`).then((r) => r.data),

  saisirScore: (id: string, scoreA: number, scoreB: number): Promise<Partie> =>
    api.patch<Partie>(`/parties/${id}/score`, { scoreA, scoreB }).then((r) => r.data),

  forfaitAvantMatch: (id: string, equipeId: string): Promise<Partie> =>
    api.post<Partie>(`/parties/${id}/forfait/${equipeId}`).then((r) => r.data),

  signalerLitige: (id: string, notes?: string): Promise<Partie> =>
    api.post<Partie>(`/parties/${id}/litige`, { notes }).then((r) => r.data),

  resoudreLitige: (id: string, scoreA: number, scoreB: number): Promise<Partie> =>
    api.patch<Partie>(`/parties/${id}/litige/resoudre`, { scoreA, scoreB }).then((r) => r.data),

  forfaitEnCours: (id: string): Promise<Partie> =>
    api.post<Partie>(`/parties/${id}/forfait-encours`).then((r) => r.data),

  lancerTourMelee: (concoursId: string, tour: number): Promise<Partie[]> =>
    api
      .post<Partie[]>(`/parties/concours/${concoursId}/tour/${tour}/lancer`)
      .then((r) => r.data),
};
