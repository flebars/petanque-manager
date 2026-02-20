import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trophy, Play, CheckCircle, Clock, Plus } from 'lucide-react';
import { concoursApi } from '@/api/concours';
import { Spinner } from '@/components/common/Spinner';
import { Button } from '@/components/common/Button';
import { ConcoursCard } from '@/components/concours/ConcoursCard';
import type { Concours } from '@/types';

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconClass: string;
}): JSX.Element {
  return (
    <div className="card border border-dark-300 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="font-display text-3xl font-bold text-gray-100">{value}</p>
        <p className="text-sm text-dark-50">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const { data: concours = [], isLoading } = useQuery<Concours[]>({
    queryKey: ['concours'],
    queryFn: concoursApi.list,
  });

  const enCours = concours.filter((c) => c.statut === 'EN_COURS');
  const termine = concours.filter((c) => c.statut === 'TERMINE');
  const inscription = concours.filter((c) => c.statut === 'INSCRIPTION');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" className="text-primary-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-100">Tableau de bord</h1>
          <p className="text-dark-50 text-sm mt-1">Vue d'ensemble de vos concours</p>
        </div>
        <Button onClick={() => navigate('/concours/nouveau')}>
          <Plus size={16} />
          Nouveau concours
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total"       value={concours.length}    icon={Trophy}      iconClass="bg-primary-600/20 text-primary-400" />
        <StatCard label="En cours"    value={enCours.length}     icon={Play}        iconClass="bg-success-600/20 text-success-400" />
        <StatCard label="Inscriptions" value={inscription.length} icon={Clock}       iconClass="bg-warning-600/20 text-warning-400" />
        <StatCard label="Terminés"    value={termine.length}     icon={CheckCircle} iconClass="bg-dark-300 text-dark-50" />
      </div>

      {enCours.length > 0 && (
        <section>
          <h2 className="text-gray-100 mb-4">Concours en cours</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enCours.map((c) => <ConcoursCard key={c.id} concours={c} />)}
          </div>
        </section>
      )}

      {inscription.length > 0 && (
        <section>
          <h2 className="text-gray-100 mb-4">Inscriptions ouvertes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inscription.map((c) => <ConcoursCard key={c.id} concours={c} />)}
          </div>
        </section>
      )}

      {concours.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-600/20 flex items-center justify-center">
            <Trophy size={32} className="text-primary-400" />
          </div>
          <h3 className="text-gray-100">Aucun concours</h3>
          <p className="text-dark-50 text-sm max-w-xs">
            Créez votre premier concours pour commencer à gérer vos tournois de pétanque.
          </p>
          <Button onClick={() => navigate('/concours/nouveau')}>
            <Plus size={16} /> Créer un concours
          </Button>
        </div>
      )}
    </div>
  );
}
