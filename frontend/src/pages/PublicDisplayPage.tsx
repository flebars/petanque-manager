import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { useEffect } from 'react';
import type { Concours, Partie } from '@/types';
import { concoursApi } from '@/api/concours';
import { partiesApi } from '@/api/parties';
import { classementApi } from '@/api/classement';
import { Spinner } from '@/components/common/Spinner';
import { ConvocationBanner } from '@/components/public/ConvocationBanner';
import { PublicMatchGrid } from '@/components/public/PublicMatchGrid';
import { ClassementTable } from '@/components/classement/ClassementTable';
import { cn } from '@/lib/utils';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

type View = 'parties' | 'classement';

export default function PublicDisplayPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('parties');
  const [tourActif, setTourActif] = useState(1);

  const { data: concours, isLoading: loadingConcours } = useQuery<Concours>({
    queryKey: ['public', 'concours', id],
    queryFn: () => concoursApi.get(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const { data: parties = [], isLoading: loadingParties } = useQuery<Partie[]>({
    queryKey: ['public', 'parties', id],
    queryFn: () => partiesApi.listByConcours(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  });

  const { data: classements = [] } = useQuery({
    queryKey: ['public', 'classement', id],
    queryFn: () => classementApi.getByConcours(id!),
    enabled: !!id && view === 'classement',
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!id) return;
    const socket = io(WS_URL);
    socket.emit('joinConcours', id);

    const refresh = (): void => {
      queryClient.invalidateQueries({ queryKey: ['public', 'parties', id] });
      queryClient.invalidateQueries({ queryKey: ['public', 'classement', id] });
      queryClient.invalidateQueries({ queryKey: ['public', 'concours', id] });
    };

    socket.on('partieUpdated', refresh);
    socket.on('tourLance', refresh);

    return () => {
      socket.emit('leaveConcours', id);
      socket.disconnect();
    };
  }, [id, queryClient]);

  const tours = useMemo(() => {
    const set = new Set(parties.map((p) => p.tour).filter((t): t is number => t !== undefined));
    return Array.from(set).sort((a, b) => a - b);
  }, [parties]);

  useEffect(() => {
    if (tours.length > 0) {
      setTourActif(tours[tours.length - 1]);
    }
  }, [tours.length]);

  if (loadingConcours || !concours) {
    return (
      <div className="min-h-screen bg-dark-500 flex items-center justify-center">
        <Spinner size="lg" className="text-primary-500" />
      </div>
    );
  }

  const partiesDuTour = parties.filter((p) => p.tour === tourActif);

  return (
    <div className="min-h-screen bg-dark-500 flex flex-col">
      <ConvocationBanner concours={concours} />

      <div className="flex items-center gap-1 px-6 pt-4 border-b border-dark-300">
        <button
          onClick={() => setView('parties')}
          className={cn(
            'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            view === 'parties'
              ? 'border-primary-500 text-primary-500'
              : 'border-transparent text-dark-50 hover:text-gray-100',
          )}
        >
          Parties
        </button>
        <button
          onClick={() => setView('classement')}
          className={cn(
            'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            view === 'classement'
              ? 'border-primary-500 text-primary-500'
              : 'border-transparent text-dark-50 hover:text-gray-100',
          )}
        >
          Classement
        </button>

        {view === 'parties' && tours.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 pb-1">
            {tours.map((t) => (
              <button
                key={t}
                onClick={() => setTourActif(t)}
                className={cn(
                  'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                  tourActif === t
                    ? 'bg-primary-500 text-white'
                    : 'bg-dark-400 text-dark-50 hover:text-gray-100',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {view === 'parties' && (
          <>
            {loadingParties ? (
              <div className="flex justify-center py-20">
                <Spinner size="lg" className="text-primary-500" />
              </div>
            ) : (
              <PublicMatchGrid parties={partiesDuTour} tour={tourActif} />
            )}
          </>
        )}

        {view === 'classement' && (
          <div className="px-4 py-5">
            <ClassementTable classements={classements} />
          </div>
        )}
      </div>

      <footer className="px-6 py-3 border-t border-dark-300 flex items-center justify-between text-xs text-dark-100">
        <span>Affichage public — mise à jour automatique</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
          Temps réel
        </span>
      </footer>
    </div>
  );
}
