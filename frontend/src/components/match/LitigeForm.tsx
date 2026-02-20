import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import type { Partie } from '@/types';
import { partiesApi } from '@/api/parties';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Textarea } from '@/components/common/Textarea';
import { ScoreForm } from './ScoreForm';

const signalSchema = z.object({
  notes: z.string().max(500).optional(),
});

type SignalValues = z.infer<typeof signalSchema>;

interface LitigeFormProps {
  open: boolean;
  onClose: () => void;
  partie: Partie;
  mode: 'signal' | 'resoudre';
  equipeANom: string;
  equipeBNom: string;
  onSuccess: () => void;
}

export function LitigeForm({
  open,
  onClose,
  partie,
  mode,
  equipeANom,
  equipeBNom,
  onSuccess,
}: LitigeFormProps): JSX.Element {
  const { register, handleSubmit, reset } = useForm<SignalValues>({
    resolver: zodResolver(signalSchema),
  });

  useEffect(() => {
    if (open) reset({ notes: '' });
  }, [open, reset]);

  const signalerMutation = useMutation({
    mutationFn: (values: SignalValues) =>
      partiesApi.signalerLitige(partie.id, values.notes),
    onSuccess: () => {
      toast.success('Litige signalé');
      onSuccess();
    },
    onError: () => toast.error('Erreur lors du signalement du litige'),
  });

  if (mode === 'resoudre') {
    return (
      <ScoreForm
        open={open}
        onClose={onClose}
        partie={partie}
        equipeANom={equipeANom}
        equipeBNom={equipeBNom}
        resoudre
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Signaler un litige" size="sm">
      <form
        onSubmit={handleSubmit((v) => signalerMutation.mutate(v))}
        className="flex flex-col gap-4"
      >
        <div className="flex items-start gap-3 rounded-lg bg-warning-600/10 border border-warning-600/30 p-3">
          <AlertTriangle size={18} className="text-warning-600 mt-0.5 shrink-0" />
          <div className="text-sm text-gray-100">
            <p className="font-medium mb-0.5">
              {equipeANom} <span className="text-dark-50">vs</span> {equipeBNom}
            </p>
            <p className="text-dark-50 text-xs">
              La partie sera marquée comme litigieuse. Un arbitre devra valider le score final.
            </p>
          </div>
        </div>

        <Textarea
          label="Observations (optionnel)"
          placeholder="Décrivez la situation…"
          rows={3}
          {...register('notes')}
        />

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            variant="danger"
            className="flex-1"
            loading={signalerMutation.isPending}
          >
            <AlertTriangle size={14} /> Signaler
          </Button>
        </div>
      </form>
    </Modal>
  );
}
