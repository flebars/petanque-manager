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
  Shuffle,
  Trophy,
  MapPin,
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
import { PouleView } from '@/components/match/PouleView';
import { BracketView } from '@/components/match/BracketView';
import { ScoreForm } from '@/components/match/ScoreForm';
import { ClassementTable } from '@/components/classement/ClassementTable';
import { CoupePodiumsTab } from '@/components/match/CoupePodiumsTab';
import { TerrainList } from '@/components/terrains/TerrainList';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/stores/authStore';
import {
  FORMAT_LABELS,
  TYPE_EQUIPE_LABELS,
  MODE_CONSTITUTION_LABELS,
  formatDate,
  cn,
  nomEquipe,
  isByeTeam,
  isTbdTeam,
} from '@/lib/utils';

type Tab = 'inscriptions' | 'parties' | 'classement' | 'podiums' | 'infos' | 'terrains';
type BracketTab = 'principale' | 'consolante';

const MELEE_TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'inscriptions', label: 'Inscriptions', icon: Users },
  { id: 'parties', label: 'Parties', icon: PlayCircle },
  { id: 'terrains', label: 'Terrains', icon: MapPin },
  { id: 'classement', label: 'Classement', icon: BarChart2 },
  { id: 'infos', label: 'Infos', icon: Info },
];

const COUPE_TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'inscriptions', label: 'Inscriptions', icon: Users },
  { id: 'parties', label: 'Parties', icon: PlayCircle },
  { id: 'terrains', label: 'Terrains', icon: MapPin },
  { id: 'podiums', label: 'Podiums', icon: Trophy },
  { id: 'classement', label: 'Statistiques', icon: BarChart2 },
  { id: 'infos', label: 'Infos', icon: Info },
];

const CHAMPIONNAT_TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'inscriptions', label: 'Inscriptions', icon: Users },
  { id: 'parties', label: 'Parties', icon: PlayCircle },
  { id: 'terrains', label: 'Terrains', icon: MapPin },
  { id: 'podiums', label: 'Podiums', icon: Trophy },
  { id: 'classement', label: 'Statistiques', icon: BarChart2 },
  { id: 'infos', label: 'Infos', icon: Info },
];

export default function ConcoursDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('inscriptions');
  const [activeBracketTab, setActiveBracketTab] = useState<BracketTab>('principale');
  const [tourActif, setTourActif] = useState(1);
  const [selectedBracketMatch, setSelectedBracketMatch] = useState<Partie | null>(null);

  const user = useAuthStore((s) => s.user);
  const hasRole = useAuthStore((s) => s.hasRole);

  const { data: concours, isLoading: loadingConcours } = useQuery<Concours>({
    queryKey: ['concours', id],
    queryFn: () => concoursApi.get(id!),
    enabled: !!id,
  });

  const isOrganisateur = concours?.organisateurId === user?.sub;
  const canManageTournament = isOrganisateur || hasRole('SUPER_ADMIN');
  const canManageMatches = hasRole('SUPER_ADMIN', 'ORGANISATEUR', 'ARBITRE');

  const isCoupe = concours?.format === 'COUPE';
  const isChampionnat = concours?.format === 'CHAMPIONNAT';

  const { data: parties = [], isLoading: loadingParties } = useQuery<Partie[]>({
    queryKey: ['parties', id],
    queryFn: () => partiesApi.listByConcours(id!),
    enabled: !!id && (activeTab === 'parties' || activeTab === 'podiums' || activeTab === 'terrains'),
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
    socket.on('score_valide', refresh);
    socket.on('tour_demarre', refresh);
    return () => {
      socket.off('score_valide', refresh);
      socket.off('tour_demarre', refresh);
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
      setActiveTab(isCoupe ? 'podiums' : 'classement');
    },
    onError: () => toast.error('Impossible de terminer le concours'),
  });

  const lancerNextTourMutation = useMutation({
    mutationFn: () => partiesApi.lancerTourMelee(id!, nextTour),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties', id] });
      queryClient.invalidateQueries({ queryKey: ['classement', id] });
      toast.success(`Tour ${nextTour} lancé`);
      setTourActif(nextTour);
    },
    onError: () => toast.error(`Impossible de lancer le tour ${nextTour}`),
  });

  const lancerTourCoupeMutation = useMutation({
    mutationFn: (tour: number) => partiesApi.lancerTourCoupe(id!, tour),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties', id] });
      queryClient.invalidateQueries({ queryKey: ['classement', id] });
      queryClient.invalidateQueries({ queryKey: ['concours', id] });
      toast.success('Tableau lancé avec succès');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors du lancement du tableau');
    },
  });

  const lancerPhaseFinaleMutation = useMutation({
    mutationFn: () => partiesApi.lancerPhaseFinale(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties', id] });
      queryClient.invalidateQueries({ queryKey: ['concours', id] });
      toast.success('Phase finale lancée !');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors du lancement de la phase finale');
    },
  });

  const lancerPoulesMutation = useMutation({
    mutationFn: () => partiesApi.lancerPoules(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties', id] });
      queryClient.invalidateQueries({ queryKey: ['concours', id] });
      toast.success('Poules lancées !');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors du lancement des poules');
    },
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

  // Count real teams (excluding __BYE__ and __TBD__ placeholder teams)
  const realTeamsCount = useMemo(() => {
    return (concours?.equipes || []).filter((e) => !isByeTeam(e) && !isTbdTeam(e)).length;
  }, [concours?.equipes]);

  if (loadingConcours || !concours) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" className="text-primary-500" />
      </div>
    );
  }

  const TABS = isCoupe ? COUPE_TABS : isChampionnat ? CHAMPIONNAT_TABS : MELEE_TABS;
  const partiesDuTour = parties.filter((p) => p.tour === tourActif);
  const isCurrentTour = tourActif === maxTour || tours.length === 0;
  const hasConsolante = !!concours.params?.consolante;

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

          {canManageTournament && concours.statut === 'INSCRIPTION' && (
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

          {canManageTournament && concours.statut === 'EN_COURS' && (
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
                  {realTeamsCount}
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
          ) : concours.format === 'CHAMPIONNAT' ? (
            <div className="space-y-6">
              {/* Championship Phase Selector */}
              {parties.some((p) => p.type === 'CHAMPIONNAT_FINALE') && (
                <div className="border-b border-dark-300">
                  <nav className="flex gap-1 -mb-px">
                    <button
                      onClick={() => setActiveBracketTab('principale')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                        activeBracketTab === 'principale'
                          ? 'border-primary-500 text-primary-500'
                          : 'border-transparent text-dark-50 hover:text-gray-100 hover:border-dark-300',
                      )}
                    >
                      🏆 Phase Finale
                    </button>
                    <button
                      onClick={() => setActiveBracketTab('consolante')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                        activeBracketTab === 'consolante'
                          ? 'border-primary-500 text-primary-500'
                          : 'border-transparent text-dark-50 hover:text-gray-100 hover:border-dark-300',
                      )}
                    >
                      📊 Poules
                    </button>
                  </nav>
                </div>
              )}

              {/* Show Poules if in Poule phase or if Poule tab selected */}
              {(!parties.some((p) => p.type === 'CHAMPIONNAT_FINALE') || activeBracketTab === 'consolante') ? (
                <>
                  {/* Button to launch pools if they don't exist yet */}
                  {concours.statut === 'EN_COURS' && 
                   (!concours.poules || concours.poules.length === 0) &&
                   parties.filter(p => p.type === 'CHAMPIONNAT_POULE').length === 0 && (
                    <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col items-center gap-4">
                      <div className="text-center">
                        <h4 className="text-lg font-bold text-gray-100">Prêt à lancer les poules</h4>
                        <p className="text-sm text-dark-100 mt-1">
                          Les équipes sont inscrites. Vous pouvez maintenant créer les poules et générer les matchs.
                        </p>
                      </div>
                      <Button
                        size="lg"
                        onClick={() => {
                          if (confirm('Lancer les poules ? Les équipes seront réparties et les matchs de poule seront créés.')) {
                            lancerPoulesMutation.mutate();
                          }
                        }}
                        loading={lancerPoulesMutation.isPending}
                      >
                        <Shuffle size={18} className="mr-2" />
                        Lancer les Poules
                      </Button>
                    </div>
                  )}

                  {/* Button to launch final phase if all pool matches are done */}
                  {concours.statut === 'EN_COURS' && 
                   !parties.some((p) => p.type === 'CHAMPIONNAT_FINALE') &&
                   parties.filter(p => p.type === 'CHAMPIONNAT_POULE').length > 0 &&
                   parties.filter(p => p.type === 'CHAMPIONNAT_POULE').every(p => p.statut === 'TERMINEE' || p.statut === 'FORFAIT') && (
                    <div className="p-6 bg-primary-500/10 border border-primary-500/20 rounded-xl flex flex-col items-center gap-4">
                      <div className="text-center">
                        <h4 className="text-lg font-bold text-gray-100">Phase de poules terminée !</h4>
                        <p className="text-sm text-dark-100 mt-1">
                          Toutes les rencontres sont finies. Vous pouvez maintenant lancer la phase finale par élimination.
                        </p>
                      </div>
                      <Button
                        size="lg"
                        onClick={() => {
                          if (confirm('Lancer la phase finale ? Les 2 premiers de chaque poule seront qualifiés.')) {
                            lancerPhaseFinaleMutation.mutate();
                          }
                        }}
                        loading={lancerPhaseFinaleMutation.isPending}
                      >
                        <Trophy size={18} className="mr-2" />
                        Lancer la Phase Finale
                      </Button>
                    </div>
                  )}

                  <PouleView
                    poules={concours.poules || []}
                    parties={parties.filter((p) => p.type === 'CHAMPIONNAT_POULE')}
                    concoursId={id!}
                    readonly={concours.statut === 'TERMINE'}
                  />
                </>
              ) : (
                /* Show Bracket for Final Phase */
                <BracketView
                  parties={parties.filter((p) => p.type === 'CHAMPIONNAT_FINALE')}
                  type="CHAMPIONNAT_FINALE"
                  concoursId={id!}
                  onMatchClick={(match) => setSelectedBracketMatch(match)}
                />
              )}
            </div>
          ) : concours.format === 'COUPE' ? (
            <div className="space-y-6">
              {concours.statut === 'EN_COURS' && parties.length === 0 && (
                <div className="flex justify-between items-center bg-dark-400 p-4 rounded-lg">
                  <div>
                    <h2 className="text-xl font-semibold">Lancer le Tableau Principal</h2>
                    <p className="text-sm text-dark-100 mt-1">
                      Créer le bracket d'élimination avec toutes les équipes inscrites
                    </p>
                  </div>

                  <Button
                    onClick={() => lancerTourCoupeMutation.mutate(1)}
                    loading={lancerTourCoupeMutation.isPending}
                    size="lg"
                  >
                    Lancer Tableau
                  </Button>
                </div>
              )}

              {parties.length > 0 && (
                <>
                  {/* Bracket Sub-Tabs */}
                  <div className="border-b border-dark-300">
                    <nav className="flex gap-1 -mb-px">
                      <button
                        onClick={() => setActiveBracketTab('principale')}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                          activeBracketTab === 'principale'
                            ? 'border-primary-500 text-primary-500'
                            : 'border-transparent text-dark-50 hover:text-gray-100 hover:border-dark-300',
                        )}
                      >
                        🏆 Tableau Principal
                        <span className="text-xs bg-dark-300 text-dark-50 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                          {parties.filter((p) => p.type === 'COUPE_PRINCIPALE').length}
                        </span>
                      </button>
                      
                      {concours.params?.consolante && parties.some((p) => p.type === 'COUPE_CONSOLANTE') && (
                        <button
                          onClick={() => setActiveBracketTab('consolante')}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                            activeBracketTab === 'consolante'
                              ? 'border-primary-500 text-primary-500'
                              : 'border-transparent text-dark-50 hover:text-gray-100 hover:border-dark-300',
                          )}
                        >
                          🎖️ Consolante
                          <span className="text-xs bg-dark-300 text-dark-50 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                            {parties.filter((p) => p.type === 'COUPE_CONSOLANTE').length}
                          </span>
                        </button>
                      )}
                    </nav>
                  </div>

                  {/* Bracket Content */}
                  {activeBracketTab === 'principale' && parties.some((p) => p.type === 'COUPE_PRINCIPALE') && (
                    <BracketView
                      parties={parties.filter((p) => p.type === 'COUPE_PRINCIPALE')}
                      type="COUPE_PRINCIPALE"
                      concoursId={id!}
                      onMatchClick={(match) => setSelectedBracketMatch(match)}
                    />
                  )}

                  {activeBracketTab === 'consolante' && (
                    <>
                      {parties.some((p) => p.type === 'COUPE_CONSOLANTE') ? (
                        <BracketView
                          parties={parties.filter((p) => p.type === 'COUPE_CONSOLANTE')}
                          type="COUPE_CONSOLANTE"
                          concoursId={id!}
                          onMatchClick={(match) => setSelectedBracketMatch(match)}
                        />
                      ) : (
                        <div className="text-center py-12 text-dark-100 bg-dark-400 rounded-lg border border-dashed border-dark-200">
                          <p className="text-lg">Tableau Consolante</p>
                          <p className="text-sm mt-2">Sera créé automatiquement avec les perdants du premier tour</p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {parties.length === 0 && (
                <div className="text-center py-16 text-dark-100">
                  <p className="text-lg">Aucun tableau lancé</p>
                  <p className="text-sm mt-2">Cliquez sur "Lancer Tableau" pour démarrer le concours</p>
                </div>
              )}
            </div>
          ) : (
            // MELEE format: Existing tour panel
            <>
              {allTours.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {allTours.map((t) => {
                      const tourLaunched = tours.includes(t);
                      const partiesTour = parties.filter((p) => p.tour === t);
                      const isComplete =
                        tourLaunched &&
                        partiesTour.length > 0 &&
                        partiesTour.every((p) => p.statut === 'TERMINEE' || p.statut === 'FORFAIT');
                      const isInProgress =
                        tourLaunched && partiesTour.some((p) => p.statut === 'EN_COURS' || p.statut === 'A_JOUER');

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

              {partiesDuTour.length > 0 &&
                partiesDuTour.every((p) => p.statut === 'TERMINEE' || p.statut === 'FORFAIT') &&
                canLancerNext &&
                isCurrentTour &&
                tourActif !== nextTour &&
                concours.statut !== 'TERMINE' && (
                  <div className="rounded-xl border border-dashed border-success-500/30 bg-success-500/5 p-6 text-center">
                    <p className="text-sm text-dark-50 mb-4">
                      Toutes les parties du tour {tourActif} sont terminées
                    </p>
                    {canManageTournament && (
                      <Button
                        onClick={() => lancerNextTourMutation.mutate()}
                        loading={lancerNextTourMutation.isPending}
                        variant="success"
                      >
                        <Shuffle size={15} /> Lancer le tour {nextTour}
                      </Button>
                    )}
                  </div>
                )}

              <TourPanel
                concoursId={id!}
                tour={tourActif}
                parties={partiesDuTour}
                isCurrentTour={isCurrentTour}
                canLancer={
                  canManageTournament &&
                  ((tours.length === 0 && tourActif === 1 && concours.statut === 'EN_COURS') ||
                    (isCurrentTour && canLancerNext && tourActif === nextTour))
                }
                canManageMatches={canManageMatches}
                readonly={concours.statut === 'TERMINE'}
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'podiums' && (isCoupe || isChampionnat) && (
        <div className="flex flex-col gap-4">
          {loadingParties ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" className="text-primary-500" />
            </div>
          ) : (
            <CoupePodiumsTab parties={parties} hasConsolante={hasConsolante} />
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

      {activeTab === 'terrains' && (
        <div className="flex flex-col gap-4">
          {loadingParties ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" className="text-primary-500" />
            </div>
          ) : (
            <TerrainList
              terrains={concours?.terrains || []}
              parties={parties}
              concoursId={id!}
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
                value={`${realTeamsCount}${concours.maxParticipants ? ` / ${concours.maxParticipants}` : ''}`}
              />
            </dl>
          </div>
        </div>
      )}
      
      {/* Score Form Modal for Bracket Matches */}
      {selectedBracketMatch && (
        <ScoreForm
          open={!!selectedBracketMatch}
          onClose={() => setSelectedBracketMatch(null)}
          partie={selectedBracketMatch}
          equipeANom={selectedBracketMatch.equipeA ? nomEquipe(selectedBracketMatch.equipeA) : '—'}
          equipeBNom={selectedBracketMatch.equipeB ? nomEquipe(selectedBracketMatch.equipeB) : '—'}
          onSuccess={() => {
            setSelectedBracketMatch(null);
            queryClient.invalidateQueries({ queryKey: ['parties', id] });
            queryClient.invalidateQueries({ queryKey: ['classement', id] });
          }}
        />
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
