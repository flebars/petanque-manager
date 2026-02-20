import { api } from './client';
import { Equipe } from '@/types';

export const equipesApi = {
  listByConcours: (concoursId: string): Promise<Equipe[]> =>
    api.get<Equipe[]>(`/equipes/concours/${concoursId}`).then((r) => r.data),

  get: (id: string): Promise<Equipe> => api.get<Equipe>(`/equipes/${id}`).then((r) => r.data),

  inscrire: (data: {
    concoursId: string;
    nom?: string;
    joueurIds: string[];
  }): Promise<Equipe> => api.post<Equipe>('/equipes', data).then((r) => r.data),

  updateStatut: (id: string, statut: string): Promise<Equipe> =>
    api.patch<Equipe>(`/equipes/${id}/statut`, { statut }).then((r) => r.data),

  forfait: (id: string): Promise<Equipe> =>
    api.post<Equipe>(`/equipes/${id}/forfait`).then((r) => r.data),

  remove: (id: string): Promise<void> => api.delete(`/equipes/${id}`).then(() => undefined),
};
