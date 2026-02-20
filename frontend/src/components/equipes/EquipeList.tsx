import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserPlus, Users, Trash2, Flag, CheckCircle } from 'lucide-react';
import { equipesApi } from '@/api/equipes';
import type { Concours, Equipe, StatutEquipe } from '@/types';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Spinner } from '@/components/common/Spinner';
import { nomEquipe } from '@/lib/utils';
import { InscrireEquipeForm } from './InscrireEquipeForm';
import { InscrireJoueurForm } from './InscrireJoueurForm';

interface EquipeListProps {
  concours: Concours;
}

const STATUT_VARIANT: Record<StatutEquipe, 'green' | 'orange' | 'red' | 'gray'> = {
  INSCRITE: 'gray',
  PRESENTE: 'green',
  FORFAIT: 'red',
  DISQUALIFIEE: 'red',
};

const STATUT_LABEL: Record<StatutEquipe, string> = {
  INSCRITE: 'Inscrit',
  PRESENTE: 'Présent',
  FORFAIT: 'Forfait',
  DISQUALIFIEE: 'Disqualifié',
};

const STATUT_LABEL_EQUIPE: Record<StatutEquipe, string> = {
  INSCRITE: 'Inscrite',
  PRESENTE: 'Présente',
  FORFAIT: 'Forfait',
  DISQUALIFIEE: 'Disqualifiée',
};

export function EquipeList({ concours }: EquipeListProps): JSX.Element {
  const [showEquipeForm, setShowEquipeForm] = useState(false);
  const [showJoueurForm, setShowJoueurForm] = useState(false);
  const queryClient = useQueryClient();

  const isMeleeMode =
    concours.modeConstitution === 'MELEE' || concours.modeConstitution === 'MELEE_DEMELEE';

  const { data: equipes = [], isLoading } = useQuery<Equipe[]>({
    queryKey: ['equipes', concours.id],
    queryFn: () => equipesApi.listByConcours(concours.id),
  });

  // After team constitution (demarrer), mêlée equipes have multiple players.
  // Switch to the team view so all players are visible.
  const teamsAreFormed = isMeleeMode && equipes.some((e) => e.joueurs.length > 1);

  const removeMutation = useMutation({
    mutationFn: (id: string) => equipesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipes', concours.id] });
      queryClient.invalidateQueries({ queryKey: ['concours', concours.id] });
      toast.success(isMeleeMode ? 'Joueur supprimé' : 'Équipe supprimée');
    },
    onError: () =>
      toast.error(isMeleeMode ? 'Impossible de supprimer le joueur' : "Impossible de supprimer l'équipe"),
  });

  const presenteMutation = useMutation({
    mutationFn: (id: string) => equipesApi.updateStatut(id, 'PRESENTE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipes', concours.id] });
      toast.success('Statut mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  const forfaitMutation = useMutation({
    mutationFn: (id: string) => equipesApi.forfait(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipes', concours.id] });
      toast.success('Forfait enregistré');
    },
    onError: () => toast.error("Impossible d'enregistrer le forfait"),
  });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['equipes', concours.id] });
    queryClient.invalidateQueries({ queryKey: ['concours', concours.id] });
  };

  const canEdit = concours.statut === 'INSCRIPTION';

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="md" className="text-primary-500" />
      </div>
    );
  }

  const modeLabel =
    concours.modeConstitution === 'MELEE_DEMELEE'
      ? 'Mêlée-Démêlée'
      : concours.modeConstitution === 'MELEE'
        ? 'Mêlée'
        : 'Montée';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm text-dark-50">
            {isMeleeMode && !teamsAreFormed ? (
              <>
                {equipes.length} joueur{equipes.length !== 1 ? 's' : ''} inscrit{equipes.length !== 1 ? 's' : ''}
                {concours.maxParticipants ? ` / ${concours.maxParticipants} max` : ''}
              </>
            ) : (
              <>
                {equipes.length} équipe{equipes.length !== 1 ? 's' : ''} inscrite{equipes.length !== 1 ? 's' : ''}
                {concours.maxParticipants ? ` / ${concours.maxParticipants} max` : ''}
                {isMeleeMode && (
                  <span className="text-dark-100">
                    {' '}({equipes.reduce((sum, e) => sum + e.joueurs.length, 0)} joueurs)
                  </span>
                )}
              </>
            )}
          </p>
          <p className="text-xs text-dark-100">
            Mode <span className="text-dark-50">{modeLabel}</span>
            {isMeleeMode && (
              <span>
                {' — '}équipes constituées aléatoirement
                {concours.modeConstitution === 'MELEE_DEMELEE' ? ' à chaque tour' : ' au démarrage'}
              </span>
            )}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {isMeleeMode ? (
              <Button size="sm" onClick={() => setShowJoueurForm(true)}>
                <UserPlus size={14} /> Inscrire un joueur
              </Button>
            ) : (
              <Button size="sm" onClick={() => setShowEquipeForm(true)}>
                <Users size={14} /> Inscrire une équipe
              </Button>
            )}
          </div>
        )}
      </div>

      {equipes.length === 0 ? (
        <div className="text-center py-12 text-dark-50">
          {isMeleeMode ? (
            <p>Aucun joueur inscrit pour l'instant.</p>
          ) : (
            <p>Aucune équipe inscrite pour l'instant.</p>
          )}
        </div>
      ) : isMeleeMode && !teamsAreFormed ? (
        <JoueurTable
          equipes={equipes}
          canEdit={canEdit}
          onPresente={(id) => presenteMutation.mutate(id)}
          onForfait={(id) => forfaitMutation.mutate(id)}
          onRemove={(id) => removeMutation.mutate(id)}
        />
      ) : (
        <EquipeTable
          equipes={equipes}
          canEdit={canEdit}
          onPresente={(id) => presenteMutation.mutate(id)}
          onForfait={(id) => forfaitMutation.mutate(id)}
          onRemove={(id) => removeMutation.mutate(id)}
        />
      )}

      <InscrireJoueurForm
        open={showJoueurForm}
        onClose={() => setShowJoueurForm(false)}
        concours={concours}
        onSuccess={invalidate}
      />

      <InscrireEquipeForm
        open={showEquipeForm}
        onClose={() => setShowEquipeForm(false)}
        concours={concours}
        onSuccess={invalidate}
      />
    </div>
  );
}

interface TableProps {
  equipes: Equipe[];
  canEdit: boolean;
  onPresente: (id: string) => void;
  onForfait: (id: string) => void;
  onRemove: (id: string) => void;
}

function JoueurTable({ equipes, canEdit, onPresente, onForfait, onRemove }: TableProps): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dark-300">
            <th className="text-left py-2 px-3 text-dark-50 font-medium w-12">#</th>
            <th className="text-left py-2 px-3 text-dark-50 font-medium">Joueur</th>
            <th className="text-left py-2 px-3 text-dark-50 font-medium hidden sm:table-cell">Club</th>
            <th className="text-left py-2 px-3 text-dark-50 font-medium hidden sm:table-cell">Licence</th>
            <th className="text-left py-2 px-3 text-dark-50 font-medium">Statut</th>
            {canEdit && <th className="py-2 px-3 w-24" />}
          </tr>
        </thead>
        <tbody>
          {equipes.map((equipe) => {
            const joueur = equipe.joueurs[0]?.joueur;
            return (
              <tr
                key={equipe.id}
                className="border-b border-dark-300/50 hover:bg-dark-400/50 transition-colors"
              >
                <td className="py-2.5 px-3 text-dark-50 font-mono">
                  {equipe.numeroTirage ?? '—'}
                </td>
                <td className="py-2.5 px-3">
                  <p className="text-gray-100 font-medium">
                    {joueur ? `${joueur.prenom} ${joueur.nom}` : '—'}
                  </p>
                  {joueur?.email && (
                    <p className="text-xs text-dark-100">{joueur.email}</p>
                  )}
                </td>
                <td className="py-2.5 px-3 text-dark-50 hidden sm:table-cell">
                  {joueur?.club ?? '—'}
                </td>
                <td className="py-2.5 px-3 text-dark-50 hidden sm:table-cell font-mono text-xs">
                  {joueur?.licenceFfpjp ?? '—'}
                </td>
                <td className="py-2.5 px-3">
                  <Badge variant={STATUT_VARIANT[equipe.statut]}>
                    {STATUT_LABEL[equipe.statut]}
                  </Badge>
                </td>
                {canEdit && (
                  <RowActions
                    equipe={equipe}
                    onPresente={onPresente}
                    onForfait={onForfait}
                    onRemove={onRemove}
                    removeLabel="Supprimer ce joueur"
                    forfaitLabel="Forfait joueur"
                  />
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EquipeTable({ equipes, canEdit, onPresente, onForfait, onRemove }: TableProps): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dark-300">
            <th className="text-left py-2 px-3 text-dark-50 font-medium w-12">#</th>
            <th className="text-left py-2 px-3 text-dark-50 font-medium">Équipe</th>
            <th className="text-left py-2 px-3 text-dark-50 font-medium hidden sm:table-cell">Joueurs</th>
            <th className="text-left py-2 px-3 text-dark-50 font-medium">Statut</th>
            {canEdit && <th className="py-2 px-3 w-24" />}
          </tr>
        </thead>
        <tbody>
          {equipes.map((equipe) => (
            <tr
              key={equipe.id}
              className="border-b border-dark-300/50 hover:bg-dark-400/50 transition-colors"
            >
              <td className="py-2.5 px-3 text-dark-50 font-mono">
                {equipe.numeroTirage ?? '—'}
              </td>
              <td className="py-2.5 px-3 text-gray-100 font-medium">{nomEquipe(equipe)}</td>
              <td className="py-2.5 px-3 text-dark-50 hidden sm:table-cell">
                {equipe.joueurs.map((ej) => `${ej.joueur.prenom} ${ej.joueur.nom}`).join(', ')}
              </td>
              <td className="py-2.5 px-3">
                <Badge variant={STATUT_VARIANT[equipe.statut]}>
                  {STATUT_LABEL_EQUIPE[equipe.statut]}
                </Badge>
              </td>
              {canEdit && (
                <RowActions
                  equipe={equipe}
                  onPresente={onPresente}
                  onForfait={onForfait}
                  onRemove={onRemove}
                  removeLabel="Supprimer l'équipe"
                  forfaitLabel="Forfait équipe"
                />
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface RowActionsProps {
  equipe: Equipe;
  onPresente: (id: string) => void;
  onForfait: (id: string) => void;
  onRemove: (id: string) => void;
  removeLabel: string;
  forfaitLabel: string;
}

function RowActions({
  equipe,
  onPresente,
  onForfait,
  onRemove,
  removeLabel,
  forfaitLabel,
}: RowActionsProps): JSX.Element {
  return (
    <td className="py-2.5 px-3">
      <div className="flex items-center gap-1 justify-end">
        {equipe.statut === 'INSCRITE' && (
          <button
            onClick={() => onPresente(equipe.id)}
            className="p-1.5 text-dark-50 hover:text-success-500 transition-colors rounded"
            title="Marquer présent"
          >
            <CheckCircle size={14} />
          </button>
        )}
        {equipe.statut !== 'FORFAIT' && (
          <button
            onClick={() => {
              if (confirm(`${forfaitLabel} ?`)) {
                onForfait(equipe.id);
              }
            }}
            className="p-1.5 text-dark-50 hover:text-warning-500 transition-colors rounded"
            title={forfaitLabel}
          >
            <Flag size={14} />
          </button>
        )}
        <button
          onClick={() => {
            if (confirm(`${removeLabel} ?`)) {
              onRemove(equipe.id);
            }
          }}
          className="p-1.5 text-dark-50 hover:text-red-400 transition-colors rounded"
          title={removeLabel}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </td>
  );
}
