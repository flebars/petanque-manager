import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MapPin, Flag, AlertTriangle, Play, CheckCircle } from 'lucide-react';
import type { Partie } from '@/types';
import { partiesApi } from '@/api/parties';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ScoreForm } from './ScoreForm';
import { LitigeForm } from './LitigeForm';
import { nomEquipe, STATUT_PARTIE_LABELS } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface MatchCardProps {
  partie: Partie;
  concoursId: string;
  readonly?: boolean;
}

const STATUT_BADGE_VARIANT = {
  A_JOUER: 'gray',
  EN_COURS: 'orange',
  TERMINEE: 'green',
  LITIGE: 'red',
  FORFAIT: 'gray',
} as const;

export function MatchCard({ partie, concoursId, readonly = false }: MatchCardProps): JSX.Element {
  const [showScore, setShowScore] = useState(false);
  const [showLitige, setShowLitige] = useState(false);
  const [litigeMode, setLitigeMode] = useState<'signal' | 'resoudre'>('signal');
  const queryClient = useQueryClient();

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['parties', concoursId] });
    queryClient.invalidateQueries({ queryKey: ['classement', concoursId] });
  };

  const demarrerMutation = useMutation({
    mutationFn: () => partiesApi.demarrer(partie.id),
    onSuccess: () => { invalidate(); toast.success('Partie démarrée'); },
    onError: () => toast.error('Impossible de démarrer la partie'),
  });

  const forfaitMutation = useMutation({
    mutationFn: (equipeId: string) => partiesApi.forfaitAvantMatch(partie.id, equipeId),
    onSuccess: () => { invalidate(); toast.success('Forfait enregistré'); },
    onError: () => toast.error("Erreur lors de l'enregistrement du forfait"),
  });

  const equipeA = partie.equipeA;
  const equipeB = partie.equipeB;
  const nomA = equipeA ? nomEquipe(equipeA) : '—';
  const nomB = equipeB ? nomEquipe(equipeB) : '—';

  const hasScore = partie.scoreA !== null && partie.scoreA !== undefined && partie.scoreB !== null && partie.scoreB !== undefined;
  const aWon = hasScore && (partie.scoreA ?? 0) === 13;
  const bWon = hasScore && (partie.scoreB ?? 0) === 13;
  const isActive = partie.statut === 'EN_COURS';
  const isDone = partie.statut === 'TERMINEE' || partie.statut === 'FORFAIT';

  return (
    <>
      <div
        className={cn(
          'card border transition-colors',
          isActive ? 'match-card-active' : isDone ? 'match-card-finished' : 'border-dark-300',
          isDone && 'opacity-90',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-dark-50">
            {partie.terrain && (
              <span className="flex items-center gap-1">
                <MapPin size={11} />
                <span className="font-display font-bold text-sm text-gray-100">
                  T{partie.terrain.numero}
                </span>
              </span>
            )}
            {partie.tour && (
              <span className="text-dark-100">Tour {partie.tour}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isActive && (
              <span className="flex items-center gap-1.5 text-xs text-warning-500">
                <span className="status-indicator status-active" />
                En cours
              </span>
            )}
            <Badge variant={STATUT_BADGE_VARIANT[partie.statut]}>
              {STATUT_PARTIE_LABELS[partie.statut]}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <div className={cn('flex-1 min-w-0', aWon && 'text-success-400', !aWon && bWon && 'text-dark-50')}>
            <p className={cn('font-medium text-sm', !aWon && !bWon ? 'text-gray-100' : '')}>{nomA}</p>
            {equipeA?.joueurs && equipeA.joueurs.length > 0 && (
              <p className="text-xs text-dark-100">
                {equipeA.joueurs.map((ej) => `${ej.joueur.prenom} ${ej.joueur.nom}`).join(', ')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                'font-display font-bold text-3xl min-w-[2ch] text-right tabular-nums',
                aWon ? 'score-winner' : hasScore ? 'text-dark-100' : 'text-dark-300',
              )}
            >
              {hasScore ? partie.scoreA : '—'}
            </span>
            <span className="text-dark-300 text-lg font-light">–</span>
            <span
              className={cn(
                'font-display font-bold text-3xl min-w-[2ch] text-left tabular-nums',
                bWon ? 'score-winner' : hasScore ? 'text-dark-100' : 'text-dark-300',
              )}
            >
              {hasScore ? partie.scoreB : '—'}
            </span>
          </div>

          <div className={cn('flex-1 min-w-0 text-right', bWon && 'text-success-400', !bWon && aWon && 'text-dark-50')}>
            <p className={cn('font-medium text-sm', !aWon && !bWon ? 'text-gray-100' : '')}>{nomB}</p>
            {equipeB?.joueurs && equipeB.joueurs.length > 0 && (
              <p className="text-xs text-dark-100">
                {equipeB.joueurs.map((ej) => `${ej.joueur.prenom} ${ej.joueur.nom}`).join(', ')}
              </p>
            )}
          </div>
        </div>

        {hasScore && (
          <div className="mt-3">
            <ProgressBar
              valueA={partie.scoreA ?? 0}
              valueB={partie.scoreB ?? 0}
            />
          </div>
        )}

        {!readonly && !isDone && (
          <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-dark-300">
            {partie.statut === 'A_JOUER' && (
              <>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => demarrerMutation.mutate()}
                  loading={demarrerMutation.isPending}
                >
                  <Play size={13} /> Démarrer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (equipeA && confirm(`Forfait de ${nomA} ?`)) {
                      forfaitMutation.mutate(equipeA.id);
                    }
                  }}
                >
                  <Flag size={13} /> Forfait {nomA.slice(0, 10)}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (equipeB && confirm(`Forfait de ${nomB} ?`)) {
                      forfaitMutation.mutate(equipeB.id);
                    }
                  }}
                >
                  <Flag size={13} /> Forfait {nomB.slice(0, 10)}
                </Button>
              </>
            )}

            {partie.statut === 'EN_COURS' && (
              <>
                <Button size="sm" onClick={() => setShowScore(true)}>
                  <CheckCircle size={13} /> Saisir le score
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setLitigeMode('signal'); setShowLitige(true); }}
                >
                  <AlertTriangle size={13} /> Litige
                </Button>
              </>
            )}

            {partie.statut === 'LITIGE' && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => { setLitigeMode('resoudre'); setShowLitige(true); }}
              >
                <AlertTriangle size={13} /> Résoudre le litige
              </Button>
            )}
          </div>
        )}
      </div>

      <ScoreForm
        open={showScore}
        onClose={() => setShowScore(false)}
        partie={partie}
        equipeANom={nomA}
        equipeBNom={nomB}
        onSuccess={() => { invalidate(); setShowScore(false); }}
      />

      <LitigeForm
        open={showLitige}
        onClose={() => setShowLitige(false)}
        partie={partie}
        mode={litigeMode}
        equipeANom={nomA}
        equipeBNom={nomB}
        onSuccess={() => { invalidate(); setShowLitige(false); }}
      />
    </>
  );
}
