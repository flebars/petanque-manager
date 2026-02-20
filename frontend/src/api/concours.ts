import { api } from './client';
import { Concours } from '@/types';

export const concoursApi = {
  list: (): Promise<Concours[]> => api.get<Concours[]>('/concours').then((r) => r.data),

  get: (id: string): Promise<Concours> =>
    api.get<Concours>(`/concours/${id}`).then((r) => r.data),

  create: (data: Partial<Concours> & { dateDebut: string; dateFin: string }): Promise<Concours> =>
    api.post<Concours>('/concours', data).then((r) => r.data),

  update: (id: string, data: Partial<Concours>): Promise<Concours> =>
    api.patch<Concours>(`/concours/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<void> => api.delete(`/concours/${id}`).then(() => undefined),

  demarrer: (id: string): Promise<Concours> =>
    api.post<Concours>(`/concours/${id}/demarrer`).then((r) => r.data),

  terminer: (id: string): Promise<Concours> =>
    api.post<Concours>(`/concours/${id}/terminer`).then((r) => r.data),
};
