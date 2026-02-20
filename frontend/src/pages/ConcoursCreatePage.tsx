import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { concoursApi } from '@/api/concours';
import { ConcoursForm, type ConcoursFormValues } from '@/components/concours/ConcoursForm';
import { Button } from '@/components/common/Button';

export default function ConcoursCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { mutateAsync } = useMutation({
    mutationFn: (data: ConcoursFormValues) =>
      concoursApi.create({
        nom: data.nom,
        lieu: data.lieu || undefined,
        format: data.format,
        typeEquipe: data.typeEquipe,
        modeConstitution: data.modeConstitution,
        nbTerrains: Number(data.nbTerrains),
        maxParticipants: data.maxParticipants ? Number(data.maxParticipants) : undefined,
        dateDebut: data.dateDebut,
        dateFin: data.dateFin,
        ...(data.format === 'MELEE' && data.nbTours ? { nbTours: Number(data.nbTours) } : {}),
        ...(data.format === 'CHAMPIONNAT' && data.taillePoule ? { taillePoule: Number(data.taillePoule) } : {}),
        ...(data.format === 'COUPE' ? { consolante: data.consolante ?? false } : {}),
      }),
    onSuccess: (concours) => {
      queryClient.invalidateQueries({ queryKey: ['concours'] });
      toast.success('Concours créé avec succès');
      navigate(`/concours/${concours.id}`);
    },
    onError: () => toast.error('Erreur lors de la création du concours'),
  });

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Nouveau concours</h1>
          <p className="text-dark-50 text-sm mt-0.5">Configurer et créer un nouveau tournoi</p>
        </div>
      </div>

      <div className="bg-dark-400 border border-dark-300 rounded-xl p-6">
        <ConcoursForm onSubmit={(data) => mutateAsync(data).then(() => undefined)} submitLabel="Créer le concours" />
      </div>
    </div>
  );
}
