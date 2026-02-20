import type { Concours } from '@/types';
import { ConcoursStatusBadge } from '@/components/concours/ConcoursStatusBadge';
import { FORMAT_LABELS, TYPE_EQUIPE_LABELS, formatDate } from '@/lib/utils';
import { MapPin, Calendar } from 'lucide-react';

interface ConvocationBannerProps {
  concours: Concours;
}

export function ConvocationBanner({ concours }: ConvocationBannerProps): JSX.Element {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 bg-dark-400 border-b border-dark-300">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-barlow-condensed font-bold text-3xl text-gray-100 tracking-wide uppercase">
            {concours.nom}
          </h1>
          <ConcoursStatusBadge statut={concours.statut} />
        </div>
        <div className="flex items-center gap-4 text-sm text-dark-50 flex-wrap">
          <span>{FORMAT_LABELS[concours.format]}</span>
          <span>·</span>
          <span>{TYPE_EQUIPE_LABELS[concours.typeEquipe]}</span>
          {concours.lieu && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <MapPin size={13} />
                {concours.lieu}
              </span>
            </>
          )}
          <span>·</span>
          <span className="flex items-center gap-1">
            <Calendar size={13} />
            {formatDate(concours.dateDebut)}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-dark-100 uppercase tracking-widest">Équipes</p>
        <p className="font-barlow-condensed font-bold text-4xl text-gray-100">
          {concours.equipes.length}
        </p>
      </div>
    </div>
  );
}
