import { api } from './client';
import { Classement } from '@/types';

export const classementApi = {
  getByConcours: (concoursId: string): Promise<Classement[]> =>
    api.get<Classement[]>(`/classement/concours/${concoursId}`).then((r) => r.data),
};
