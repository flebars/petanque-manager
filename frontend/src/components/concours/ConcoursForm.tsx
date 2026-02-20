import { useEffect } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Button } from '@/components/common/Button';

const schema = z
  .object({
    nom: z.string().min(1, 'Nom requis'),
    lieu: z.string().optional(),
    format: z.enum(['MELEE', 'COUPE', 'CHAMPIONNAT']),
    typeEquipe: z.enum(['TETE_A_TETE', 'DOUBLETTE', 'TRIPLETTE']),
    modeConstitution: z.enum(['MELEE_DEMELEE', 'MELEE', 'MONTEE']),
    nbTerrains: z.coerce.number().int().min(1, 'Au moins 1 terrain'),
    maxParticipants: z.coerce.number().int().positive().optional().or(z.literal('')),
    dateDebut: z.string().min(1, 'Date de début requise'),
    dateFin: z.string().min(1, 'Date de fin requise'),
    nbTours: z.coerce.number().int().min(1).max(20).optional().or(z.literal('')),
    taillePoule: z.coerce.number().int().min(3).max(5).optional().or(z.literal('')),
    consolante: z.boolean().optional(),
  })
  .refine((d) => new Date(d.dateFin) >= new Date(d.dateDebut), {
    message: 'La date de fin doit être après la date de début',
    path: ['dateFin'],
  });

export type ConcoursFormValues = z.infer<typeof schema>;

interface ConcoursFormProps {
  defaultValues?: Partial<ConcoursFormValues>;
  onSubmit: (data: ConcoursFormValues) => Promise<void>;
  submitLabel?: string;
}

export function ConcoursForm({ defaultValues, onSubmit, submitLabel = 'Créer le concours' }: ConcoursFormProps): JSX.Element {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ConcoursFormValues>({
    resolver: zodResolver(schema) as Resolver<ConcoursFormValues>,
    defaultValues: {
      format: 'MELEE',
      typeEquipe: 'DOUBLETTE',
      modeConstitution: 'MONTEE',
      nbTerrains: 4,
      nbTours: 6,
      ...defaultValues,
    },
  });

  const format = watch('format');

  useEffect(() => {
    if (format === 'MELEE' && !watch('nbTours')) setValue('nbTours', 6);
  }, [format, setValue, watch]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Input
            label="Nom du concours"
            placeholder="Grand Prix de Marseille"
            {...register('nom')}
            error={errors.nom?.message}
          />
        </div>
        <Input
          label="Lieu"
          placeholder="Marseille, Terrain du Parc"
          {...register('lieu')}
          error={errors.lieu?.message}
        />
        <Input
          label="Nombre de terrains"
          type="number"
          min={1}
          {...register('nbTerrains')}
          error={errors.nbTerrains?.message}
        />
        <Input
          label="Date et heure de début"
          type="datetime-local"
          {...register('dateDebut')}
          error={errors.dateDebut?.message}
        />
        <Input
          label="Date et heure de fin"
          type="datetime-local"
          {...register('dateFin')}
          error={errors.dateFin?.message}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Controller
          name="format"
          control={control}
          render={({ field }) => (
            <Select
              label="Format"
              options={[
                { value: 'MELEE', label: 'Mêlée (Swiss)' },
                { value: 'COUPE', label: 'Coupe (Élimination)' },
                { value: 'CHAMPIONNAT', label: 'Championnat (Poules)' },
              ]}
              {...field}
              error={errors.format?.message}
            />
          )}
        />
        <Controller
          name="typeEquipe"
          control={control}
          render={({ field }) => (
            <Select
              label="Type d'équipe"
              options={[
                { value: 'TETE_A_TETE', label: 'Tête-à-tête (1p)' },
                { value: 'DOUBLETTE', label: 'Doublette (2p)' },
                { value: 'TRIPLETTE', label: 'Triplette (3p)' },
              ]}
              {...field}
              error={errors.typeEquipe?.message}
            />
          )}
        />
        <Controller
          name="modeConstitution"
          control={control}
          render={({ field }) => (
            <Select
              label="Constitution des équipes"
              options={[
                { value: 'MELEE_DEMELEE', label: 'Mêlée-Démêlée' },
                { value: 'MELEE', label: 'Mêlée' },
                { value: 'MONTEE', label: 'Montée' },
              ]}
              {...field}
              error={errors.modeConstitution?.message}
            />
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Maximum de participants"
          type="number"
          min={2}
          placeholder="Illimité"
          {...register('maxParticipants')}
          error={errors.maxParticipants?.message}
        />
        {format === 'MELEE' && (
          <Input
            label="Nombre de tours"
            type="number"
            min={1}
            max={20}
            {...register('nbTours')}
            error={errors.nbTours?.message}
          />
        )}
        {format === 'CHAMPIONNAT' && (
          <Controller
            name="taillePoule"
            control={control}
            render={({ field }) => (
              <Select
                label="Taille des poules"
                options={[
                  { value: '3', label: '3 équipes' },
                  { value: '4', label: '4 équipes' },
                  { value: '5', label: '5 équipes' },
                ]}
                value={String(field.value ?? '')}
                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : '')}
                error={errors.taillePoule?.message}
              />
            )}
          />
        )}
        {format === 'COUPE' && (
          <div className="flex flex-col gap-1 justify-center">
            <label className="text-sm font-medium text-dark-50">Consolante</label>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" {...register('consolante')} className="accent-primary-500 w-4 h-4" />
              <span className="text-sm text-gray-100">Activer la consolante</span>
            </label>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" size="lg" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
