import { Modal } from '@/components/common/Modal';
import { ConcoursForm, type ConcoursFormValues } from './ConcoursForm';
import type { Concours } from '@/types';

interface EditConcoursModalProps {
  open: boolean;
  onClose: () => void;
  concours: Concours;
  onSubmit: (data: ConcoursFormValues) => Promise<void>;
}

export function EditConcoursModal({ open, onClose, concours, onSubmit }: EditConcoursModalProps): JSX.Element {
  const handleSubmit = async (data: ConcoursFormValues): Promise<void> => {
    const editableFields = {
      nom: data.nom,
      dateDebut: data.dateDebut,
      dateFin: data.dateFin,
      nbTerrains: data.nbTerrains,
    };
    await onSubmit(editableFields as ConcoursFormValues);
    onClose();
  };

  const defaultValues: Partial<ConcoursFormValues> = {
    nom: concours.nom,
    dateDebut: new Date(concours.dateDebut).toISOString().slice(0, 16),
    dateFin: new Date(concours.dateFin).toISOString().slice(0, 16),
    nbTerrains: concours.nbTerrains,
  };

  return (
    <Modal open={open} onClose={onClose} title="Modifier le concours" size="xl">
      <div className="space-y-4">
        <p className="text-sm text-dark-50">
          Les paramètres du format (type d'équipe, mode de constitution) ne peuvent pas être modifiés après la création.
        </p>
        <ConcoursForm
          mode="edit"
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          submitLabel="Enregistrer"
        />
      </div>
    </Modal>
  );
}
