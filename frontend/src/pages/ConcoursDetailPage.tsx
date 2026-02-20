import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Users,
  PlayCircle,
  BarChart2,
  Info,
  ArrowLeft,
  Play,
  CheckCircle,
  Tv,
  Trash2,
} from 'lucide-react';
import { concoursApi } from '@/api/concours';
import { partiesApi } from '@/api/parties';
import { classementApi } from '@/api/classement';
import type { Concours, Partie } from '@/types';
import { Spinner } from '@/components/common/Spinner';
import { Button } from '@/components/common/Button';
import { ConcoursStatusBadge } from '@/components/concours/ConcoursStatusBadge';
import { EquipeList } from '@/components/equipes/EquipeList';
import { TourPanel } from '@/components/match/TourPanel';
import { ClassementTable } from '@/components/classement/ClassementTable';
import { useSocket } from '@/hooks/useSocket';
import {
  FORMAT_LABELS,
  TYPE_EQUIPE_LABELS,
  MODE_CONSTITUTION_LABELS,
  formatDate,
  cn,
} from '@/lib/utils';

type Tab = 'inscriptions' | 'parties' | 'classement' | 'infos';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'inscriptions', label: 'Inscriptions', icon: Users },
  { id: 'parties', label: 'Parties', icon: PlayCircle },
  { id: 'classement', label: 'Classement', icon: BarChart2 },
  { id: 'infos', label: 'Infos', icon: Info },
];

export default function ConcoursDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('inscriptions');
  const [tourActif, setTourActif] = useState(1);

  const { data: concours, isLoading: loadingConcours } = useQuery<Concours>({
    queryKey: ['concours', id],
    queryFn: () => concoursApi.get(id!),
    enabled: !!id,
  });

  const { data: parties = [], isLoading: loadingParties } = useQuery<Partie[]>({
    queryKey: ['parties', id],
    queryFn: () => partiesApi.listByConcours(id!),
    enabled: !!id && activeTab === 'parties',
  });

  const { data: classements = [], isLoading: loadingClassement } = useQuery({
    queryKey: ['classement', id],
    queryFn: () => classementApi.getByConcours(id!),
    enabled: !!id && activeTab === 'classement',
  });

  const socket = useSocket(id ?? null);

  useMemo(() => {
    if (!socket) return;
    const refresh = (): void => {
      queryClient.invalidateQueries({ queryKey: ['parties', id] });
      queryClient.invalidateQueries({ queryKey: ['classement', id] });
      queryClient.invalidateQueries({ queryKey: ['concours', id] });
    };
    socket.on('partieUpdated', refresh);
    socket.on('tourLance', refresh);
    return () => {
      socket.off('partieUpdated', refresh);
      socket.off('tourLance', refresh);
    };
  }, [socket, id, queryClient]);

  const demarrerMutation = useMutation({
    mutationFn: () => concoursApi.demarrer(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours', id] });
      queryClient.invalidateQueries({ queryKey: ['concours'] });
      toast.success('Concours démarré');
      setActiveTab('parties');
    },
    onError: () => toast.error('Impossible de démarrer le concours'),
  });

  const terminerMutation = useMutation({
    mutationFn: () => concoursApi.terminer(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours', id] });
      queryClient.invalidateQueries({ queryKey: ['concours'] });
      toast.success('Concours terminé');
      setActiveTab('classement');
    },
    onError: () => toast.error('Impossible de terminer le concours'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => concoursApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concours'] });
      toast.success('Concours supprimé');
      navigate('/concours');
    },
    onError: () => toast.error('Impossible de supprimer le concours'),
  });

  const tours = useMemo(() => {
    const set = new Set(parties.map((p) => p.tour).filter((t): t is number => t !== undefined));
    return Array.from(set).sort((a, b) => a - b);
  }, [parties]);

  const nbToursConfig = concours?.params?.nbTours ?? 0;
  
  // Generate all configured tours (1 to nbToursConfig), or only existing tours if nbTours not set
  const allTours = useMemo(() => {
    if (nbToursConfig > 0) {
      return Array.from({ length: nbToursConfig }, (_, i) => i + 1);
    }
    return tours;
  }, [nbToursConfig, tours]);
  const maxTour = Math.max(...(tours.length ? tours : [0]), tourActif);
  const nextTour = maxTour + 1;
  const allCurrentDone =
    tours.length === 0 ||
    parties
      .filter((p) => p.tour === maxTour)
      .every((p) => p.statut === 'TERMINEE' || p.statut === 'FORFAIT');
  const canLancerNext =
    concours?.statut === 'EN_COURS' &&
    allCurrentDone &&
    (nbToursConfig === 0 || nextTour <= nbToursConfig);

  if (loadingConcours || !concours) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" className="text-primary-500" />
      </div>
    );
  }

  const partiesDuTour = parties.filter((p) => p.tour === tourActif);
  const isCurrentTour = tourActif === maxTour || tours.length === 0;

  return (
    <div className="flex flex-col gap-0 w-full">
      <div className="flex items-start gap-3 mb-6 flex-wrap">
        <button
          onClick={() => navigate('/concours')}
          className="mt-1 text-dark-50 hover:text-gray-100 transition-colors"
          aria-label="Retour"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-100 truncate">{concours.nom}</h1>
            <ConcoursStatusBadge statut={concours.statut} />
          </div>
          <p className="text-sm text-dark-50 mt-0.5">
            {FORMAT_LABELS[concours.format]} · {TYPE_EQUIPE_LABELS[concours.typeEquipe]} ·{' '}
            {formatDate(concours.dateDebut)}
            {concours.lieu && ` · ${concours.lieu}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(`/public/${id}`, '_blank')}
          >
            <Tv size={14} /> Affichage public
          </Button>

          {concours.statut === 'INSCRIPTION' && (
            <>
              <Button
                size="sm"
                onClick={() => {
                  if (confirm('Démarrer le concours ?')) demarrerMutation.mutate();
                }}
                loading={demarrerMutation.isPending}
                variant="success"
              >
                <Play size={14} /> Démarrer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm('Supprimer ce concours définitivement ?')) deleteMutation.mutate();
                }}
              >
                <Trash2 size={14} />
              </Button>
            </>
          )}

          {concours.statut === 'EN_COURS' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (confirm('Terminer le concours et figer le classement ?'))
                  terminerMutation.mutate();
              }}
              loading={terminerMutation.isPending}
            >
              <CheckCircle size={14} /> Terminer
            </Button>
          )}
        </div>
      </div>

      <div className="border-b border-dark-300 mb-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                activeTab === tabId
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-dark-50 hover:text-gray-100 hover:border-dark-300',
              )}
            >
              <Icon size={15} />
              {label}
              {tabId === 'inscriptions' && (
                <span className="text-xs bg-dark-300 text-dark-50 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {concours.equipes?.length ?? 0}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'inscriptions' && <EquipeList concours={concours} />}

      {activeTab === 'parties' && (
        <div className="flex flex-col gap-5">
          {loadingParties ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" className="text-primary-500" />
            </div>
          ) : (
            <>
              {allTours.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {allTours.map((t) => {
                      const tourLaunched = tours.includes(t);
                      const partiesTour = parties.filter((p) => p.tour === t);
                      const isComplete = tourLaunched && partiesTour.length > 0 && partiesTour.every((p) => p.statut === 'TERMINEE' || p.statut === 'FORFAIT');
                      const isInProgress = tourLaunched && partiesTour.some((p) => p.statut === 'EN_COURS' || p.statut === 'A_JOUER');
                      
                      return (
                        <button
                          key={t}
                          onClick={() => setTourActif(t)}
                          disabled={!tourLaunched}
                          className={cn(
                            'min-w-[2.5rem] h-10 px-3 rounded-lg text-sm font-medium transition-colors relative',
                            tourActif === t
                              ? 'bg-primary-500 text-white'
                              : tourLaunched
                                ? 'bg-dark-400 text-dark-50 hover:text-gray-100'
                                : 'bg-dark-400/30 text-dark-200 cursor-not-allowed',
                          )}
                        >
                          <span className="relative">
                            Tour {t}
                            {isComplete && (
                              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-success-500 rounded-full" />
                            )}
                            {isInProgress && (
                              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-warning-500 rounded-full animate-pulse" />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <TourPanel
                concoursId={id!}
                tour={tourActif}
                parties={partiesDuTour}
                isCurrentTour={isCurrentTour}
                canLancer={
                  (tours.length === 0 && tourActif === 1 && concours.statut === 'EN_COURS') ||
                  (isCurrentTour && canLancerNext && tourActif === nextTour)
                }
                readonly={concours.statut === 'TERMINE'}
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'classement' && (
        <div className="flex flex-col gap-4">
          {loadingClassement ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" className="text-primary-500" />
            </div>
          ) : (
            <ClassementTable 
              classements={classements} 
              mode={concours.modeConstitution === 'MELEE_DEMELEE' ? 'joueur' : 'equipe'}
            />
          )}
        </div>
      )}

      {activeTab === 'infos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-dark-400 border border-dark-300 rounded-xl p-5 flex flex-col gap-4">
            <h3 className="font-semibold text-gray-100">Informations générales</h3>
            <dl className="flex flex-col gap-3 text-sm">
              <InfoRow label="Format" value={FORMAT_LABELS[concours.format]} />
              <InfoRow label="Type d'équipe" value={TYPE_EQUIPE_LABELS[concours.typeEquipe]} />
              <InfoRow
                label="Constitution"
                value={MODE_CONSTITUTION_LABELS[concours.modeConstitution]}
              />
              <InfoRow label="Date début" value={formatDate(concours.dateDebut)} />
              <InfoRow label="Date fin" value={formatDate(concours.dateFin)} />
              {concours.lieu && <InfoRow label="Lieu" value={concours.lieu} />}
              {concours.maxParticipants && (
                <InfoRow label="Max participants" value={String(concours.maxParticipants)} />
              )}
            </dl>
          </div>

          <div className="bg-dark-400 border border-dark-300 rounded-xl p-5 flex flex-col gap-4">
            <h3 className="font-semibold text-gray-100">Paramètres du concours</h3>
            <dl className="flex flex-col gap-3 text-sm">
              <InfoRow label="Terrains" value={String(concours.nbTerrains)} />
              {concours.params?.nbTours !== undefined && concours.params.nbTours > 0 && (
                <InfoRow label="Nombre de tours" value={String(concours.params.nbTours)} />
              )}
              {concours.params?.consolante !== undefined && (
                <InfoRow
                  label="Consolante"
                  value={concours.params.consolante ? 'Oui' : 'Non'}
                />
              )}
              <InfoRow
                label="Équipes inscrites"
                value={`${concours.equipes?.length ?? 0}${concours.maxParticipants ? ` / ${concours.maxParticipants}` : ''}`}
              />
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-dark-50 shrink-0">{label}</dt>
      <dd className="text-gray-100 text-right">{value}</dd>
    </div>
  );
}
