import { MapPin, CheckCircle2, Clock } from 'lucide-react';
import type { Terrain, Partie } from '@/types';
import { MatchCard } from '@/components/match/MatchCard';
import { cn } from '@/lib/utils';

interface TerrainCardProps {
  terrain: Terrain;
  parties: Partie[];
  concoursId: string;
}

export function TerrainCard({ terrain, parties, concoursId }: TerrainCardProps): JSX.Element {
  const completed = parties
    .filter((p) => p.statut === 'TERMINEE' || p.statut === 'FORFAIT')
    .sort((a, b) => (a.tour || 0) - (b.tour || 0));

  const inProgress = parties
    .filter((p) => p.statut === 'EN_COURS')
    .sort((a, b) => (a.tour || 0) - (b.tour || 0));

  const upcoming = parties
    .filter((p) => p.statut === 'A_JOUER' || p.statut === 'A_MONTER')
    .sort((a, b) => (a.tour || 0) - (b.tour || 0));

  const hasActiveMatches = inProgress.length > 0;

  return (
    <div
      className={cn(
        'bg-dark-400 border rounded-xl p-5 flex flex-col gap-4',
        hasActiveMatches ? 'border-warning-500/50' : 'border-dark-300',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-primary-400" />
          <h3 className="font-barlow-condensed font-bold text-2xl text-gray-100">
            Terrain {terrain.numero}
          </h3>
        </div>
      </div>

      {terrain.emplacement && (
        <p className="text-xs text-dark-50">{terrain.emplacement}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-dark-50">
          {parties.length} partie{parties.length > 1 ? 's' : ''}
        </span>
        {completed.length > 0 && (
          <span className="flex items-center gap-1 text-success-500">
            <CheckCircle2 size={11} />
            {completed.length} terminée{completed.length > 1 ? 's' : ''}
          </span>
        )}
        {inProgress.length > 0 && (
          <span className="flex items-center gap-1 text-warning-500">
            <span className="w-1.5 h-1.5 rounded-full bg-warning-500 animate-pulse" />
            {inProgress.length} en cours
          </span>
        )}
        {upcoming.length > 0 && (
          <span className="flex items-center gap-1 text-dark-50">
            <Clock size={11} />
            {upcoming.length} à venir
          </span>
        )}
      </div>

      {parties.length === 0 ? (
        <div className="text-center py-6 text-sm text-dark-50">
          Aucune partie assignée
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {completed.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-medium text-dark-50 uppercase tracking-wide">
                Terminées
              </h4>
              <div className="flex flex-col gap-2">
                {completed.map((partie) => (
                  <MatchCard
                    key={partie.id}
                    partie={partie}
                    concoursId={concoursId}
                    readonly
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          {inProgress.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-medium text-warning-500 uppercase tracking-wide">
                En cours
              </h4>
              <div className="flex flex-col gap-2">
                {inProgress.map((partie) => (
                  <MatchCard
                    key={partie.id}
                    partie={partie}
                    concoursId={concoursId}
                    readonly
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-medium text-dark-50 uppercase tracking-wide">
                À venir
              </h4>
              <div className="flex flex-col gap-2">
                {upcoming.map((partie) => (
                  <MatchCard
                    key={partie.id}
                    partie={partie}
                    concoursId={concoursId}
                    readonly
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
