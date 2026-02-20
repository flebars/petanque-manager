import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Search, UserPlus, UserCheck } from 'lucide-react';
import { equipesApi } from '@/api/equipes';
import { joueursApi } from '@/api/joueurs';
import type { Concours, Joueur } from '@/types';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { CreateJoueurModal } from '@/components/joueurs/CreateJoueurModal';

interface InscrireJoueurFormProps {
  open: boolean;
  onClose: () => void;
  concours: Concours;
  onSuccess: () => void;
}

export function InscrireJoueurForm({
  open,
  onClose,
  concours,
  onSuccess,
}: InscrireJoueurFormProps): JSX.Element {
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<Joueur | null | 'not_found'>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const mutation = useMutation({
    mutationFn: (joueur: Joueur) =>
      equipesApi.inscrire({
        concoursId: concours.id,
        joueurIds: [joueur.id],
      }),
    onSuccess: () => {
      toast.success('Joueur inscrit');
      onSuccess();
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Erreur lors de l'inscription");
    },
  });

  const handleClose = (): void => {
    setSearchEmail('');
    setSearchResult(null);
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

  const handleJoueurCreated = (joueur: Joueur): void => {
    setShowCreateModal(false);
    mutation.mutate(joueur);
  };

  const modeLabel =
    concours.modeConstitution === 'MELEE_DEMELEE' ? 'Mêlée-Démêlée' : 'Mêlée';

  return (
    <>
      <Modal open={open} onClose={handleClose} title="Inscrire un joueur" size="md">
        <div className="flex flex-col gap-5">
          <p className="text-sm text-dark-50">
            Mode{' '}
            <span className="text-gray-100 font-medium">{modeLabel}</span> — les équipes seront
            constituées aléatoirement
            {concours.modeConstitution === 'MELEE_DEMELEE' ? ' à chaque tour' : ' au démarrage du concours'}.
          </p>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-dark-50 uppercase tracking-wide">
              Rechercher par email
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
                    {searchResult.licenceFfpjp ? ` · Lic. ${searchResult.licenceFfpjp}` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => mutation.mutate(searchResult as Joueur)}
                  loading={mutation.isPending}
                >
                  <UserCheck size={13} /> Inscrire
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

          <div className="flex justify-end pt-1">
            <Button variant="secondary" onClick={handleClose}>
              Fermer
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
