import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { joueursApi } from '@/api/joueurs';
import type { Joueur } from '@/types';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Button } from '@/components/common/Button';

const schema = z.object({
  email: z.string().email('Email invalide'),
  nom: z.string().min(1, 'Nom requis'),
  prenom: z.string().min(1, 'Prénom requis'),
  genre: z.enum(['H', 'F']),
  dateNaissance: z.string().optional(),
  licenceFfpjp: z.string().optional(),
  club: z.string().optional(),
  categorie: z.enum(['SENIOR', 'VETERAN', 'FEMININ', 'JEUNE']).optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateJoueurModalProps {
  open: boolean;
  onClose: () => void;
  initialEmail?: string;
  onSuccess: (joueur: Joueur) => void;
}

export function CreateJoueurModal({
  open,
  onClose,
  initialEmail = '',
  onSuccess,
}: CreateJoueurModalProps): JSX.Element {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: initialEmail, genre: 'H', categorie: 'SENIOR' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      joueursApi.create({
        email: data.email,
        nom: data.nom,
        prenom: data.prenom,
        genre: data.genre as Joueur['genre'],
        dateNaissance: data.dateNaissance || undefined,
        licenceFfpjp: data.licenceFfpjp || undefined,
        club: data.club || undefined,
        categorie: (data.categorie ?? 'SENIOR') as Joueur['categorie'],
      }),
    onSuccess: (joueur) => {
      toast.success(`Joueur ${joueur.prenom} ${joueur.nom} créé`);
      reset();
      onSuccess(joueur);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Erreur lors de la création');
    },
  });

  const handleClose = (): void => {
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Créer un nouveau joueur" size="md">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Prénom *"
            placeholder="Jean"
            error={errors.prenom?.message}
            {...register('prenom')}
          />
          <Input
            label="Nom *"
            placeholder="Dupont"
            error={errors.nom?.message}
            {...register('nom')}
          />
        </div>

        <Input
          label="Email *"
          type="email"
          placeholder="jean.dupont@email.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Genre *"
            error={errors.genre?.message}
            options={[
              { value: 'H', label: 'Homme' },
              { value: 'F', label: 'Femme' },
            ]}
            {...register('genre')}
          />
          <Select
            label="Catégorie"
            options={[
              { value: 'SENIOR', label: 'Sénior' },
              { value: 'VETERAN', label: 'Vétéran (+60)' },
              { value: 'FEMININ', label: 'Féminin' },
              { value: 'JEUNE', label: 'Jeune (-18)' },
            ]}
            {...register('categorie')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Licence FFPJP"
            placeholder="123456"
            {...register('licenceFfpjp')}
          />
          <Input
            label="Club"
            placeholder="PC Marseille"
            {...register('club')}
          />
        </div>

        <Input
          label="Date de naissance"
          type="date"
          {...register('dateNaissance')}
        />

        <div className="flex gap-3 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Annuler
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Créer le joueur
          </Button>
        </div>
      </form>
    </Modal>
  );
}
