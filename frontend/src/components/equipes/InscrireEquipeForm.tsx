import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Search, X, UserPlus } from 'lucide-react';
import { equipesApi } from '@/api/equipes';
import { joueursApi } from '@/api/joueurs';
import type { Concours, Joueur } from '@/types';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { CreateJoueurModal } from '@/components/joueurs/CreateJoueurModal';

const TYPE_SIZES: Record<string, number> = {
  TETE_A_TETE: 1,
  DOUBLETTE: 2,
  TRIPLETTE: 3,
};

interface InscrireEquipeFormProps {
  open: boolean;
  onClose: () => void;
  concours: Concours;
  onSuccess: () => void;
}

export function InscrireEquipeForm({ open, onClose, concours, onSuccess }: InscrireEquipeFormProps): JSX.Element {
  const maxJoueurs = TYPE_SIZES[concours.typeEquipe] ?? 3;
  const [joueurs, setJoueurs] = useState<Joueur[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<Joueur | null | 'not_found'>(null);
  const [nom, setNom] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      equipesApi.inscrire({
        concoursId: concours.id,
        nom: nom.trim() || undefined,
        joueurIds: joueurs.map((j) => j.id),
      }),
    onSuccess: () => {
      toast.success('Équipe inscrite');
      onSuccess();
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Erreur lors de l'inscription");
    },
  });

  const handleClose = (): void => {
    setJoueurs([]);
    setSearchEmail('');
    setSearchResult(null);
    setNom('');
    onClose();
  };

  const searchJoueur = async (): Promise<void> => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const results = await joueursApi.list(searchEmail.trim());
      setSearchResult(results.length > 0 ? results[0] : 'not_found');
    } catch {
      setSearchResult('not_found');
    } finally {
      setSearching(false);
    }
  };

  const addJoueur = (joueur: Joueur): void => {
    if (joueurs.some((j) => j.id === joueur.id)) {
      toast.error('Ce joueur est déjà dans l\'équipe');
      return;
    }
    if (joueurs.length >= maxJoueurs) {
      toast.error(`Maximum ${maxJoueurs} joueur(s) pour ce format`);
      return;
    }
    setJoueurs((prev) => [...prev, joueur]);
    setSearchEmail('');
    setSearchResult(null);
  };

  const handleJoueurCreated = (joueur: Joueur): void => {
    setShowCreateModal(false);
    addJoueur(joueur);
  };

  const typeLabel = concours.typeEquipe.replace(/_/g, ' ').toLowerCase();

  return (
    <>
      <Modal open={open} onClose={handleClose} title="Inscrire une équipe" size="md">
        <div className="flex flex-col gap-5">
          <p className="text-sm text-dark-50">
            Format :{' '}
            <span className="text-gray-100">{typeLabel}</span>
            {' — '}Ajoutez {maxJoueurs} joueur{maxJoueurs > 1 ? 's' : ''} par équipe
          </p>

          {joueurs.length < maxJoueurs && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-dark-50 uppercase tracking-wide">
                Rechercher un joueur par email
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchJoueur()}
                    placeholder="joueur@email.com"
                    className="w-full px-3 py-2 pr-9 rounded-lg bg-dark-500 border border-dark-300 text-gray-100 placeholder-dark-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {searching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Spinner size="sm" className="text-dark-50" />
                    </span>
                  )}
                </div>
                <Button size="sm" variant="secondary" onClick={searchJoueur} disabled={searching}>
                  <Search size={14} />
                </Button>
              </div>

              {searchResult && searchResult !== 'not_found' && (
                <div className="flex items-center justify-between bg-dark-500 border border-primary-500/50 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-100">
                      {searchResult.prenom} {searchResult.nom}
                    </p>
                    <p className="text-xs text-dark-50">
                      {searchResult.email}
                      {searchResult.club ? ` · ${searchResult.club}` : ''}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => addJoueur(searchResult as Joueur)}>
                    <UserPlus size={13} /> Ajouter
                  </Button>
                </div>
              )}

              {searchResult === 'not_found' && (
                <div className="flex flex-col gap-2 bg-dark-500 border border-dark-300 rounded-lg px-3 py-3">
                  <p className="text-sm text-dark-50">
                    Aucun joueur trouvé pour{' '}
                    <span className="text-gray-100">{searchEmail}</span>.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <UserPlus size={13} /> Créer ce joueur
                  </Button>
                </div>
              )}
            </div>
          )}

          {joueurs.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-dark-50 uppercase tracking-wide">
                Joueurs sélectionnés ({joueurs.length}/{maxJoueurs})
              </p>
              <div className="flex flex-col gap-1.5">
                {joueurs.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between bg-dark-500 border border-dark-300 rounded-lg px-3 py-2"
                  >
                    <div>
                      <span className="text-sm text-gray-100">
                        {j.prenom} {j.nom}
                      </span>
                      {j.club && (
                        <span className="text-xs text-dark-50 ml-2">{j.club}</span>
                      )}
                    </div>
                    <button
                      onClick={() => setJoueurs((prev) => prev.filter((jj) => jj.id !== j.id))}
                      className="text-dark-50 hover:text-red-400 transition-colors p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Input
            label="Nom d'équipe (optionnel)"
            placeholder="Les Champions"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />

          <div className="flex gap-3 justify-end pt-1">
            <Button variant="secondary" onClick={handleClose}>
              Annuler
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={joueurs.length === 0 || joueurs.length > maxJoueurs}
              loading={mutation.isPending}
            >
              Inscrire l'équipe
            </Button>
          </div>
        </div>
      </Modal>

      <CreateJoueurModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        initialEmail={searchEmail}
        onSuccess={handleJoueurCreated}
      />
    </>
  );
}
