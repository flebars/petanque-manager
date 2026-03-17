import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Button } from '@/components/common/Button';
import * as adminApi from '@/api/admin';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Email invalide'),
  nom: z.string().min(1, 'Nom requis'),
  prenom: z.string().min(1, 'Prénom requis'),
  genre: z.enum(['H', 'F']),
  dateNaissance: z.string().optional(),
  licenceFfpjp: z.string().optional(),
  club: z.string().optional(),
  categorie: z.enum(['SENIOR', 'VETERAN', 'FEMININ', 'JEUNE']),
});

type FormValues = z.infer<typeof schema>;

interface UserProfileEditorProps {
  isOpen: boolean;
  onClose: () => void;
  user: adminApi.User | null;
  onSuccess: () => void;
}

export default function UserProfileEditor({
  isOpen,
  onClose,
  user,
  onSuccess,
}: UserProfileEditorProps): JSX.Element {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: user
      ? {
          email: user.email,
          nom: user.nom,
          prenom: user.prenom,
          genre: user.genre as 'H' | 'F',
          dateNaissance: '',
          licenceFfpjp: '',
          club: user.club || '',
          categorie: user.categorie as 'SENIOR' | 'VETERAN' | 'FEMININ' | 'JEUNE',
        }
      : undefined,
  });

  const onSubmit = async (data: FormValues) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const cleanData: any = {};
      Object.keys(data).forEach((key) => {
        const value = data[key as keyof FormValues];
        if (value !== '' && value !== undefined) {
          cleanData[key] = value;
        }
      });

      await adminApi.updateUserProfile(user.id, cleanData);
      toast.success('User profile updated successfully');
      onSuccess();
      onClose();
      reset();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return <></>;

  return (
    <Modal open={isOpen} onClose={onClose} title="Edit User Profile" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="bg-dark-500/30 border border-dark-300 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-100 mb-3">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Prénom"
              placeholder="John"
              {...register('prenom')}
              error={errors.prenom?.message}
            />
            <Input
              label="Nom"
              placeholder="Doe"
              {...register('nom')}
              error={errors.nom?.message}
            />
            <div className="md:col-span-2">
              <Input
                label="Email"
                type="email"
                placeholder="user@example.com"
                {...register('email')}
                error={errors.email?.message}
              />
            </div>
            <Select
              label="Genre"
              options={[
                { value: 'H', label: 'Homme' },
                { value: 'F', label: 'Femme' },
              ]}
              {...register('genre')}
              error={errors.genre?.message}
            />
            <Input
              label="Date de naissance"
              type="date"
              {...register('dateNaissance')}
              error={errors.dateNaissance?.message}
            />
          </div>
        </div>

        <div className="bg-dark-500/30 border border-dark-300 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-100 mb-3">Additional Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Licence FFPJP"
              placeholder="12345678"
              {...register('licenceFfpjp')}
              error={errors.licenceFfpjp?.message}
            />
            <Input
              label="Club"
              placeholder="Pétanque Club Marseille"
              {...register('club')}
              error={errors.club?.message}
            />
            <div className="md:col-span-2">
              <Select
                label="Catégorie"
                options={[
                  { value: 'SENIOR', label: 'Senior' },
                  { value: 'VETERAN', label: 'Vétéran (+60 ans)' },
                  { value: 'FEMININ', label: 'Féminin' },
                  { value: 'JEUNE', label: 'Jeune (-18 ans)' },
                ]}
                {...register('categorie')}
                error={errors.categorie?.message}
              />
            </div>
          </div>
        </div>

        <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3">
          <p className="text-sm text-primary-200">
            ℹ️ Role changes must be done via the "Edit Role" button. Password resets are handled separately.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
