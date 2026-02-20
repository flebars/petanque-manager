import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { Partie } from '@/types';
import { partiesApi } from '@/api/parties';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';

const schema = z
  .object({
    scoreA: z.coerce.number().int().min(0).max(13),
    scoreB: z.coerce.number().int().min(0).max(13),
  })
  .refine((d) => d.scoreA === 13 || d.scoreB === 13, {
    message: 'Un des scores doit être 13',
    path: ['scoreA'],
  })
  .refine((d) => !(d.scoreA === 13 && d.scoreB === 13), {
    message: 'Les deux équipes ne peuvent pas avoir 13',
    path: ['scoreB'],
  });

type FormValues = z.infer<typeof schema>;

interface ScoreFormProps {
  open: boolean;
  onClose: () => void;
  partie: Partie;
  equipeANom: string;
  equipeBNom: string;
  resoudre?: boolean;
  onSuccess: () => void;
}

export function ScoreForm({
  open,
  onClose,
  partie,
  equipeANom,
  equipeBNom,
  resoudre = false,
  onSuccess,
}: ScoreFormProps): JSX.Element {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { scoreA: undefined, scoreB: undefined },
  });

  useEffect(() => {
    if (open) reset({ scoreA: undefined, scoreB: undefined });
  }, [open, reset]);

  const scoreA = watch('scoreA');
  const scoreB = watch('scoreB');
  const aWins = Number(scoreA) === 13;
  const bWins = Number(scoreB) === 13;

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      resoudre
        ? partiesApi.resoudreLitige(partie.id, values.scoreA, values.scoreB)
        : partiesApi.saisirScore(partie.id, values.scoreA, values.scoreB),
    onSuccess: () => {
      toast.success('Score enregistré');
      onSuccess();
    },
    onError: () => toast.error("Erreur lors de l'enregistrement du score"),
  });

  const onSubmit = (values: FormValues): void => {
    mutation.mutate(values);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={resoudre ? 'Résoudre le litige — Score final' : 'Saisir le score'}
      size="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex flex-col items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium truncate max-w-full text-center',
                aWins ? 'text-success-500' : 'text-gray-100',
              )}
            >
              {equipeANom}
            </span>
            <input
              type="number"
              min={0}
              max={13}
              placeholder="0"
              {...register('scoreA')}
              className={cn(
                'w-20 h-20 text-center font-barlow-condensed font-bold text-5xl rounded-xl border bg-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500 tabular-nums transition-colors',
                aWins
                  ? 'border-success-500 text-success-500'
                  : 'border-dark-300 text-gray-100',
              )}
            />
          </div>

          <span className="text-dark-100 text-2xl font-light mb-6">–</span>

          <div className="flex-1 flex flex-col items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium truncate max-w-full text-center',
                bWins ? 'text-success-500' : 'text-gray-100',
              )}
            >
              {equipeBNom}
            </span>
            <input
              type="number"
              min={0}
              max={13}
              placeholder="0"
              {...register('scoreB')}
              className={cn(
                'w-20 h-20 text-center font-barlow-condensed font-bold text-5xl rounded-xl border bg-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500 tabular-nums transition-colors',
                bWins
                  ? 'border-success-500 text-success-500'
                  : 'border-dark-300 text-gray-100',
              )}
            />
          </div>
        </div>

        {(errors.scoreA || errors.scoreB) && (
          <p className="text-red-400 text-xs text-center -mt-2">
            {errors.scoreA?.message ?? errors.scoreB?.message}
          </p>
        )}

        <p className="text-xs text-dark-50 text-center">
          Le vainqueur doit avoir exactement 13 points.
        </p>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" className="flex-1" loading={mutation.isPending}>
            Valider
          </Button>
        </div>
      </form>
    </Modal>
  );
}
