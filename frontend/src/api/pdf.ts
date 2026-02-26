import { api } from './client';
import toast from 'react-hot-toast';

const downloadPdf = async (url: string, filename: string): Promise<void> => {
  try {
    const response = await api.get(url, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
    toast.success('PDF téléchargé avec succès');
  } catch (error: any) {
    if (error.response?.status === 404) {
      toast.error('Aucune partie trouvée pour ce tour');
    } else {
      toast.error('Erreur lors du téléchargement du PDF');
    }
    throw error;
  }
};

export const pdfApi = {
  downloadFichesPartieTour: (concoursId: string, tour: number): Promise<void> =>
    downloadPdf(`/pdf/fiches-partie/concours/${concoursId}/tour/${tour}`, `fiches-tour-${tour}.pdf`),

  downloadFichesPartiePoule: (pouleId: string, pouleName: string): Promise<void> =>
    downloadPdf(`/pdf/fiches-partie/poule/${pouleId}`, `fiches-poule-${pouleName}.pdf`),

  downloadFichesPartieBracket: (
    concoursId: string,
    ronde: number,
    type: 'principale' | 'consolante',
  ): Promise<void> => {
    const typeParam = type === 'consolante' ? '?type=consolante' : '';
    const filename =
      type === 'consolante'
        ? `fiches-bracket-ronde-${ronde}-consolante.pdf`
        : `fiches-bracket-ronde-${ronde}.pdf`;
    return downloadPdf(`/pdf/fiches-partie/concours/${concoursId}/bracket/${ronde}${typeParam}`, filename);
  },
};
