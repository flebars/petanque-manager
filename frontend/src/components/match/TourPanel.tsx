import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Shuffle, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { Partie } from '@/types';
import { partiesApi } from '@/api/parties';
import { Button } from '@/components/common/Button';
import { MatchCard } from './MatchCard';

interface TourPanelProps {
  concoursId: string;
  tour: number;
  parties: Partie[];
  isCurrentTour?: boolean;
  canLancer: boolean;
  readonly?: boolean;
}

export function TourPanel({
  concoursId,
  tour,
  parties,
  canLancer,
  readonly = false,
}: TourPanelProps): JSX.Element {
  const queryClient = useQueryClient();

  const total = parties.length;
  const terminees = parties.filter(
    (p) => p.statut === 'TERMINEE' || p.statut === 'FORFAIT',
  ).length;
  const litiges = parties.filter((p) => p.statut === 'LITIGE').length;
  const enCours = parties.filter((p) => p.statut === 'EN_COURS').length;
  const tourComplet = total > 0 && terminees === total;

  const lancerMutation = useMutation({
    mutationFn: () => partiesApi.lancerTourMelee(concoursId, tour),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties', concoursId] });
      queryClient.invalidateQueries({ queryKey: ['classement', concoursId] });
      toast.success(`Tour ${tour} lancé`);
    },
    onError: () => toast.error(`Impossible de lancer le tour ${tour}`),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-barlow-condensed font-bold text-xl text-gray-100 tracking-wide">
            Tour {tour}
          </h3>
          {total > 0 && (
            <div className="flex items-center gap-2 text-xs text-dark-50">
              {tourComplet ? (
                <span className="flex items-center gap-1 text-success-500">
                  <CheckCircle2 size={13} />
                  Terminé
                </span>
              ) : (
                <>
                  {enCours > 0 && (
                    <span className="flex items-center gap-1 text-warning-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning-500 animate-pulse" />
                      {enCours} en cours
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {terminees}/{total} terminées
                  </span>
                  {litiges > 0 && (
                    <span className="flex items-center gap-1 text-warning-600">
                      <AlertTriangle size={12} />
                      {litiges} litige{litiges > 1 ? 's' : ''}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {canLancer && total === 0 && !readonly && (
          <Button
            onClick={() => lancerMutation.mutate()}
            loading={lancerMutation.isPending}
            variant="primary"
          >
            <Shuffle size={15} /> Lancer le tour {tour}
          </Button>
        )}
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-dark-300 p-8 text-center text-dark-50 text-sm">
          {canLancer && !readonly
            ? 'Cliquez sur « Lancer le tour » pour générer les rencontres.'
            : 'Les rencontres de ce tour ne sont pas encore disponibles.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {parties.map((partie) => (
            <MatchCard
              key={partie.id}
              partie={partie}
              concoursId={concoursId}
              readonly={readonly}
            />
          ))}
        </div>
      )}
    </div>
  );
}
