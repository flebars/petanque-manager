import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { concoursApi } from '@/api/concours';
import { Spinner } from '@/components/common/Spinner';
import { Button } from '@/components/common/Button';
import { ConcoursCard } from '@/components/concours/ConcoursCard';
import type { Concours, StatutConcours } from '@/types';
import { STATUT_CONCOURS_LABELS } from '@/lib/utils';

const ALL_STATUTS: StatutConcours[] = ['INSCRIPTION', 'EN_COURS', 'TERMINE'];

export default function ConcoursListPage(): JSX.Element {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState<StatutConcours | 'ALL'>('ALL');

  const { data: concours = [], isLoading } = useQuery<Concours[]>({
    queryKey: ['concours'],
    queryFn: concoursApi.list,
  });

  const filtered = concours.filter((c) => {
    const matchSearch =
      c.nom.toLowerCase().includes(search.toLowerCase()) ||
      (c.lieu ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatut = filterStatut === 'ALL' || c.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-gray-100">Concours</h1>
          <p className="text-dark-50 text-sm mt-1">{concours.length} concours au total</p>
        </div>
        <Button onClick={() => navigate('/concours/nouveau')}>
          <Plus size={16} /> Nouveau concours
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-100" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="input pl-9"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatut('ALL')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterStatut === 'ALL'
                ? 'bg-primary-500 text-white'
                : 'bg-dark-400 text-dark-50 border border-dark-300 hover:text-gray-100'
            }`}
          >
            Tous
          </button>
          {ALL_STATUTS.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatut(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors hidden sm:block ${
                filterStatut === s
                  ? 'bg-primary-500 text-white'
                  : 'bg-dark-400 text-dark-50 border border-dark-300 hover:text-gray-100'
              }`}
            >
              {STATUT_CONCOURS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" className="text-primary-500" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-dark-50 text-center py-16">Aucun concours trouvé.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => <ConcoursCard key={c.id} concours={c} />)}
        </div>
      )}
    </div>
  );
}
