import { api } from './client';
import { Concours, ExportedTournament } from '@/types';

function readFileAsJson(file: File): Promise<ExportedTournament> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        resolve(json);
      } catch (e) {
        reject(new Error('Fichier JSON invalide'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export const concoursApi = {
  list: (): Promise<Concours[]> => api.get<Concours[]>('/concours').then((r) => r.data),

  get: (id: string): Promise<Concours> =>
    api.get<Concours>(`/concours/${id}`).then((r) => r.data),

  create: (data: Partial<Concours> & { dateDebut: string; dateFin: string }): Promise<Concours> =>
    api.post<Concours>('/concours', data).then((r) => r.data),

  update: (id: string, data: Partial<Concours> | { nom?: string; dateDebut?: string; dateFin?: string; nbTerrains?: number }): Promise<Concours> =>
    api.patch<Concours>(`/concours/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<void> => api.delete(`/concours/${id}`).then(() => undefined),

  demarrer: (id: string): Promise<Concours> =>
    api.post<Concours>(`/concours/${id}/demarrer`).then((r) => r.data),

  terminer: (id: string): Promise<Concours> =>
    api.post<Concours>(`/concours/${id}/terminer`).then((r) => r.data),

  exportJson: (id: string): Promise<ExportedTournament> =>
    api.get<ExportedTournament>(`/concours/${id}/export`).then((r) => r.data),

  importJson: (file: File): Promise<Concours> =>
    readFileAsJson(file).then((data) => api.post<Concours>('/concours/import', data).then((r) => r.data)),
};
