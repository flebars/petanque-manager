import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Users, Layers } from 'lucide-react';
import type { Concours } from '@/types';
import { Card } from '@/components/common/Card';
import { ConcoursStatusBadge } from './ConcoursStatusBadge';
import { FORMAT_LABELS, TYPE_EQUIPE_LABELS, formatDate } from '@/lib/utils';

interface ConcoursCardProps {
  concours: Concours;
}

export function ConcoursCard({ concours }: ConcoursCardProps): JSX.Element {
  const navigate = useNavigate();
  return (
    <Card onClick={() => navigate(`/concours/${concours.id}`)}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-gray-100 leading-tight">{concours.nom}</h4>
          <ConcoursStatusBadge statut={concours.statut} />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-dark-50">
          {concours.lieu && (
            <span className="flex items-center gap-1.5">
              <MapPin size={13} />
              {concours.lieu}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Calendar size={13} />
            {formatDate(concours.dateDebut)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={13} />
            {concours.equipes?.length ?? 0} équipe{(concours.equipes?.length ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="badge badge-primary text-xs px-2 py-0.5">
            {FORMAT_LABELS[concours.format]}
          </span>
          <span className="badge badge-secondary text-xs px-2 py-0.5">
            {TYPE_EQUIPE_LABELS[concours.typeEquipe]}
          </span>
          {concours.params?.nbTours && (
            <span className="badge badge-secondary text-xs px-2 py-0.5 flex items-center gap-1">
              <Layers size={11} />
              {concours.params.nbTours} tours
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
