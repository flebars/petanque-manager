import type { Partie } from '@/types';
import { nomEquipe } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { AlertTriangle, MapPin } from 'lucide-react';

interface PublicMatchGridProps {
  parties: Partie[];
  tour: number;
}

export function PublicMatchGrid({ parties, tour }: PublicMatchGridProps): JSX.Element {
  if (parties.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-dark-100 text-lg">
        Tirage en attente…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-5">
      <h2 className="font-barlow-condensed font-bold text-xl text-dark-50 tracking-widest uppercase px-1">
        Tour {tour}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {parties.map((partie) => {
          const equipeA = partie.equipeA;
          const equipeB = partie.equipeB;
          const nomA = equipeA ? nomEquipe(equipeA) : '—';
          const nomB = equipeB ? nomEquipe(equipeB) : '—';
          const hasScore =
            partie.scoreA !== null &&
            partie.scoreA !== undefined &&
            partie.scoreB !== null &&
            partie.scoreB !== undefined;
          const aWon = hasScore && partie.scoreA === 13;
          const bWon = hasScore && partie.scoreB === 13;
          const isLitige = partie.statut === 'LITIGE';
          const isDone = partie.statut === 'TERMINEE' || partie.statut === 'FORFAIT';
          const isActive = partie.statut === 'EN_COURS';

          return (
            <div
              key={partie.id}
              className={cn(
                'rounded-2xl border p-4 flex flex-col gap-3 bg-dark-400',
                isActive && 'border-warning-600/40',
                isLitige && 'border-red-400/40',
                isDone && 'border-dark-300/60',
                !isActive && !isLitige && !isDone && 'border-dark-300',
              )}
            >
              <div className="flex items-center justify-between text-xs text-dark-50">
                {partie.terrain ? (
                  <span className="flex items-center gap-1">
                    <MapPin size={11} />
                    <span className="font-barlow-condensed font-bold text-sm text-gray-100">
                      Terrain {partie.terrain.numero}
                    </span>
                  </span>
                ) : (
                  <span />
                )}
                {isLitige && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertTriangle size={12} />
                    Litige
                  </span>
                )}
                {isActive && (
                  <span className="flex items-center gap-1.5 text-warning-500">
                    <span className="w-2 h-2 rounded-full bg-warning-500 animate-pulse" />
                    En cours
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex-1 min-w-0',
                    aWon && 'text-success-500',
                    bWon && !aWon && 'text-dark-100',
                  )}
                >
                  <p className="font-barlow-condensed font-bold text-lg leading-tight truncate">
                    {nomA}
                  </p>
                  {equipeA?.joueurs && equipeA.joueurs.length > 0 && (
                    <p className="text-xs text-dark-100 truncate">
                      {equipeA.joueurs.map((ej) => ej.joueur.nom).join(', ')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={cn(
                      'font-barlow-condensed font-bold text-5xl min-w-[1.5ch] text-right tabular-nums leading-none',
                      aWon ? 'text-success-500' : hasScore ? 'text-dark-100' : 'text-dark-300',
                    )}
                  >
                    {hasScore ? partie.scoreA : '–'}
                  </span>
                  <span className="text-dark-300 text-2xl font-light">–</span>
                  <span
                    className={cn(
                      'font-barlow-condensed font-bold text-5xl min-w-[1.5ch] text-left tabular-nums leading-none',
                      bWon ? 'text-success-500' : hasScore ? 'text-dark-100' : 'text-dark-300',
                    )}
                  >
                    {hasScore ? partie.scoreB : '–'}
                  </span>
                </div>

                <div
                  className={cn(
                    'flex-1 min-w-0 text-right',
                    bWon && 'text-success-500',
                    aWon && !bWon && 'text-dark-100',
                  )}
                >
                  <p className="font-barlow-condensed font-bold text-lg leading-tight truncate">
                    {nomB}
                  </p>
                  {equipeB?.joueurs && equipeB.joueurs.length > 0 && (
                    <p className="text-xs text-dark-100 truncate">
                      {equipeB.joueurs.map((ej) => ej.joueur.nom).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
