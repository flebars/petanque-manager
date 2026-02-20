import { api } from './client';
import { Joueur } from '@/types';

export const joueursApi = {
  list: (email?: string): Promise<Joueur[]> =>
    api.get<Joueur[]>('/joueurs', { params: email ? { email } : undefined }).then((r) => r.data),

  get: (id: string): Promise<Joueur> => api.get<Joueur>(`/joueurs/${id}`).then((r) => r.data),

  create: (data: Partial<Joueur>): Promise<Joueur> =>
    api.post<Joueur>('/joueurs', data).then((r) => r.data),

  update: (id: string, data: Partial<Joueur>): Promise<Joueur> =>
    api.patch<Joueur>(`/joueurs/${id}`, data).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/joueurs/${id}`).then(() => undefined),
};
