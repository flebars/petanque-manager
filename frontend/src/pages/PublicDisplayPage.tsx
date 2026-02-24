import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import type { Concours, Partie } from '@/types';
import { concoursApi } from '@/api/concours';
import { partiesApi } from '@/api/parties';
import { classementApi } from '@/api/classement';
import { Spinner } from '@/components/common/Spinner';
import { ConvocationBanner } from '@/components/public/ConvocationBanner';
import { PublicMatchGrid } from '@/components/public/PublicMatchGrid';
import { PublicPodiumView } from '@/components/public/PublicPodiumView';
import { PublicPouleView } from '@/components/public/PublicPouleView';
import { ClassementTable } from '@/components/classement/ClassementTable';
import { cn } from '@/lib/utils';
import { Pause, Play } from 'lucide-react';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

type View = 'parties' | 'poules' | 'podium' | 'classement';

const VIEW_DURATIONS: Record<View, number> = {
  parties: 15_000,
  poules: 12_000,
  podium: 10_000,
  classement: 10_000,
};

const VIEW_LABELS: Record<View, string> = {
  parties: 'Parties',
  poules: 'Poules',
  podium: 'Podium',
  classement: 'Classement',
};

function semiFinalsDone(parties: Partie[]): boolean {
  const principaleParties = parties.filter(
    (p) => p.type === 'COUPE_PRINCIPALE' || p.type === 'CHAMPIONNAT_FINALE'
  );
  if (principaleParties.length === 0) return false;
  const maxRonde = Math.max(...principaleParties.map((p) => p.bracketRonde ?? 0));
  if (maxRonde < 5) return false;
  const semiRonde = maxRonde - 1;
  const semis = principaleParties.filter((p) => p.bracketRonde === semiRonde);
  return (
    semis.length > 0 &&
    semis.every((p) => p.statut === 'TERMINEE' || p.statut === 'FORFAIT')
  );
}

function getSmartDefaultView(
  concours: Concours,
  parties: Partie[],
  podiumVisible: boolean,
): View {
  if ((concours.format === 'COUPE' || concours.format === 'CHAMPIONNAT') && podiumVisible) {
    const maxRonde = Math.max(
      ...parties.filter((p) => p.type === 'COUPE_PRINCIPALE' || p.type === 'CHAMPIONNAT_FINALE').map((p) => p.bracketRonde ?? 0),
    );
    const finalesDone = parties.some(
      (p) => (p.type === 'COUPE_PRINCIPALE' || p.type === 'CHAMPIONNAT_FINALE') && p.bracketRonde === maxRonde && p.bracketPos === 0 &&
        (p.statut === 'TERMINEE' || p.statut === 'FORFAIT'),
    );
    if (finalesDone) return 'podium';
  }
  return 'parties';
}

export default function PublicDisplayPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('parties');
  const [tourActif, setTourActif] = useState(1);
  const [autoRotate, setAutoRotate] = useState(true);
  const [progress, setProgress] = useState(0);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaultViewInitialized = useRef(false);

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

  const podiumVisible = useMemo(
    () => (concours?.format === 'COUPE' || concours?.format === 'CHAMPIONNAT') && semiFinalsDone(parties),
    [concours?.format, parties],
  );

  const poulesVisible = useMemo(
    () => concours?.format === 'CHAMPIONNAT' && (concours?.poules?.length ?? 0) > 0,
    [concours?.format, concours?.poules],
  );

  const availableViews = useMemo((): View[] => {
    const views: View[] = ['parties'];
    if (poulesVisible) views.push('poules');
    if (podiumVisible) views.push('podium');
    views.push('classement');
    return views;
  }, [poulesVisible, podiumVisible]);

  useEffect(() => {
    if (!concours || defaultViewInitialized.current) return;
    defaultViewInitialized.current = true;
    setView(getSmartDefaultView(concours, parties, podiumVisible));
  }, [concours, parties, podiumVisible]);

  useEffect(() => {
    if (podiumVisible && !availableViews.includes(view)) {
      setView('parties');
    }
  }, [podiumVisible, availableViews, view]);

  const handleManualViewChange = useCallback(
    (v: View) => {
      setView(v);
      setAutoRotate(false);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      const duration = VIEW_DURATIONS[v] * 2;
      pauseTimeoutRef.current = setTimeout(() => {
        setAutoRotate(true);
      }, duration);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!autoRotate) {
      setProgress(0);
      return;
    }

    const duration = VIEW_DURATIONS[view];
    const startTime = performance.now();
    let animFrame: number;

    const tick = (now: number): void => {
      const elapsed = now - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
      if (pct < 100) {
        animFrame = requestAnimationFrame(tick);
      }
    };
    animFrame = requestAnimationFrame(tick);

    const timer = setTimeout(() => {
      const currentIndex = availableViews.indexOf(view);
      const nextView = availableViews[(currentIndex + 1) % availableViews.length];
      setView(nextView);
    }, duration);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animFrame);
    };
  }, [view, autoRotate, availableViews]);

  if (loadingConcours || !concours) {
    return (
      <div className="min-h-screen bg-dark-500 flex items-center justify-center">
        <Spinner size="lg" className="text-primary-500" />
      </div>
    );
  }

  const partiesDuTour = parties.filter((p) => p.tour === tourActif);
  const hasConsolante = !!concours.params?.consolante;

  return (
    <div className="min-h-screen bg-dark-500 flex flex-col">
      <ConvocationBanner concours={concours} />

      <div className="flex items-center gap-1 px-6 pt-4 border-b border-dark-300 relative">
        {availableViews.map((v) => (
          <button
            key={v}
            onClick={() => handleManualViewChange(v)}
            className={cn(
              'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              view === v
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-dark-50 hover:text-gray-100',
            )}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}

        {view === 'parties' && tours.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 pb-1 mr-2">
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

        <button
          onClick={() => {
            const next = !autoRotate;
            setAutoRotate(next);
            if (pauseTimeoutRef.current) {
              clearTimeout(pauseTimeoutRef.current);
              pauseTimeoutRef.current = null;
            }
          }}
          className={cn(
            'ml-auto flex items-center gap-1.5 pb-1 text-xs transition-colors',
            view !== 'parties' || tours.length === 0 ? 'ml-auto' : '',
            autoRotate ? 'text-dark-100 hover:text-gray-100' : 'text-primary-400 hover:text-primary-300',
          )}
          title={autoRotate ? 'Mettre en pause la rotation' : 'Reprendre la rotation automatique'}
        >
          {autoRotate ? <Pause size={13} /> : <Play size={13} />}
          <span>{autoRotate ? 'Pause' : 'Auto'}</span>
        </button>

        {autoRotate && (
          <div
            className="absolute bottom-0 left-0 h-0.5 bg-primary-500/60 transition-none"
            style={{ width: `${progress}%` }}
          />
        )}
      </div>

      <div
        key={view}
        className="flex-1 overflow-auto animate-fade-in"
      >
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

        {view === 'poules' && (
          <PublicPouleView
            poules={concours.poules || []}
            parties={parties.filter((p) => p.type === 'CHAMPIONNAT_POULE')}
          />
        )}

        {view === 'podium' && (
          <PublicPodiumView
            parties={parties}
            hasConsolante={hasConsolante}
          />
        )}

        {view === 'classement' && (
          <div className="px-4 py-5">
            <ClassementTable
              classements={classements}
              mode={concours.modeConstitution === 'MELEE_DEMELEE' ? 'joueur' : 'equipe'}
            />
          </div>
        )}
      </div>

      <footer className="px-6 py-3 border-t border-dark-300 flex items-center justify-between text-xs text-dark-100">
        <span>Affichage public — mise à jour automatique</span>
        <div className="flex items-center gap-3">
          {availableViews.length > 1 && autoRotate && (
            <span className="text-dark-100">
              Prochain :{' '}
              <span className="text-gray-300">
                {VIEW_LABELS[availableViews[(availableViews.indexOf(view) + 1) % availableViews.length]]}
              </span>{' '}
              dans{' '}
              <span className="text-gray-300 tabular-nums">
                {Math.ceil(((100 - progress) / 100) * VIEW_DURATIONS[view] / 1000)}s
              </span>
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
            Temps réel
          </span>
        </div>
      </footer>
    </div>
  );
}
