import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { concoursApi } from '@/api/concours';
import { Spinner } from '@/components/common/Spinner';
import { Button } from '@/components/common/Button';
import { ConcoursCard } from '@/components/concours/ConcoursCard';
import type { Concours, StatutConcours } from '@/types';
import { STATUT_CONCOURS_LABELS } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

const ALL_STATUTS: StatutConcours[] = ['INSCRIPTION', 'EN_COURS', 'TERMINE'];

export default function ConcoursListPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState<StatutConcours | 'ALL'>('ALL');
  const hasRole = useAuthStore((s) => s.hasRole);

  const canCreateTournament = hasRole('SUPER_ADMIN', 'ORGANISATEUR');

  const { data: concours = [], isLoading } = useQuery<Concours[]>({
    queryKey: ['concours'],
    queryFn: concoursApi.list,
  });

  const importMutation = useMutation({
    mutationFn: concoursApi.importJson,
    onSuccess: (newConcours) => {
      queryClient.invalidateQueries({ queryKey: ['concours'] });
      toast.success(`Concours "${newConcours.nom}" importé avec succès`);
      navigate(`/concours/${newConcours.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'import');
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Seuls les fichiers JSON sont acceptés');
      return;
    }

    importMutation.mutate(file);
    e.target.value = '';
  };

  const filtered = concours.filter((c) => {
    const matchSearch =
      c.nom.toLowerCase().includes(search.toLowerCase()) ||
      (c.lieu ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatut = filterStatut === 'ALL' || c.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-gray-100">Concours</h1>
          <p className="text-dark-50 text-sm mt-1">{concours.length} concours au total</p>
        </div>
        {canCreateTournament && (
          <>
            <Button onClick={() => navigate('/concours/nouveau')}>
              <Plus size={16} /> Nouveau concours
            </Button>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
                disabled={importMutation.isPending}
              />
              <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-dark-400 text-gray-100 border border-dark-300 hover:bg-dark-300 hover:border-dark-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                <Upload size={16} />
                {importMutation.isPending ? 'Import...' : 'Importer'}
              </div>
            </label>
          </>
        )}
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
