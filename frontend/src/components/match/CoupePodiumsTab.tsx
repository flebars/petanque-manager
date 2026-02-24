import type { Partie } from '@/types';
import { nomEquipe, isByeTeam, isTbdTeam, cn } from '@/lib/utils';

interface CoupePodiumsTabProps {
  parties: Partie[];
  hasConsolante: boolean;
}

interface PodiumPlace {
  place: number;
  equipeNom: string;
  label: string;
}

function resolveName(partie: Partie, slot: 'A' | 'B'): string | null {
  const equipe = slot === 'A' ? partie.equipeA : partie.equipeB;
  if (!equipe || isTbdTeam(equipe) || isByeTeam(equipe)) return null;
  return nomEquipe(equipe);
}

function getWinner(partie: Partie): string | null {
  if (partie.statut !== 'TERMINEE' && partie.statut !== 'FORFAIT') return null;
  if (partie.scoreA == null || partie.scoreB == null) return null;
  return partie.scoreA > partie.scoreB ? resolveName(partie, 'A') : resolveName(partie, 'B');
}

function getLoser(partie: Partie): string | null {
  if (partie.statut !== 'TERMINEE' && partie.statut !== 'FORFAIT') return null;
  if (partie.scoreA == null || partie.scoreB == null) return null;
  return partie.scoreA < partie.scoreB ? resolveName(partie, 'A') : resolveName(partie, 'B');
}

function extractPodium(matchesByType: Partie[]): PodiumPlace[] {
  if (matchesByType.length === 0) return [];

  const maxRonde = Math.max(...matchesByType.map((p) => p.bracketRonde ?? 0));
  const finales = matchesByType.filter((p) => p.bracketRonde === maxRonde);

  const grandeFinale = finales.find((p) => p.bracketPos === 0) ?? finales[0];
  const petiteFinale = finales.find((p) => p.bracketPos === 1);

  const places: PodiumPlace[] = [];

  if (grandeFinale) {
    const winner = getWinner(grandeFinale);
    const runner = getLoser(grandeFinale);
    if (winner) places.push({ place: 1, equipeNom: winner, label: 'Champion' });
    if (runner) places.push({ place: 2, equipeNom: runner, label: 'Finaliste' });
  }

  if (petiteFinale) {
    const third = getWinner(petiteFinale);
    const fourth = getLoser(petiteFinale);
    if (third) places.push({ place: 3, equipeNom: third, label: '3ème place' });
    if (fourth) places.push({ place: 4, equipeNom: fourth, label: '4ème place' });
  } else if (grandeFinale) {
    // No petite finale yet: show semi-final losers as TBD 3rd place
    const maxSemi = maxRonde - 1;
    const semis = matchesByType.filter((p) => p.bracketRonde === maxSemi);
    const semiLosers = semis
      .filter((p) => p.statut === 'TERMINEE' || p.statut === 'FORFAIT')
      .map(getLoser)
      .filter((n): n is string => n !== null);
    if (semiLosers.length > 0) {
      places.push({ place: 3, equipeNom: semiLosers[0], label: '3ème place (petite finale à venir)' });
      if (semiLosers[1]) {
        places.push({ place: 4, equipeNom: semiLosers[1], label: '4ème place (petite finale à venir)' });
      }
    }
  }

  return places;
}

const MEDAL_CONFIG: Record<number, { bg: string; border: string; text: string; badge: string; size: string }> = {
  1: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-400/40',
    text: 'text-amber-300',
    badge: 'bg-amber-400 text-amber-900',
    size: 'text-5xl',
  },
  2: {
    bg: 'bg-slate-400/10',
    border: 'border-slate-300/40',
    text: 'text-slate-300',
    badge: 'bg-slate-300 text-slate-900',
    size: 'text-4xl',
  },
  3: {
    bg: 'bg-orange-700/10',
    border: 'border-orange-600/40',
    text: 'text-orange-400',
    badge: 'bg-orange-600 text-white',
    size: 'text-3xl',
  },
  4: {
    bg: 'bg-dark-400',
    border: 'border-dark-300',
    text: 'text-dark-50',
    badge: 'bg-dark-300 text-dark-50',
    size: 'text-2xl',
  },
};

const MEDAL_EMOJI: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
  4: '4',
};

function PodiumCard({ place, equipeNom, label }: PodiumPlace): JSX.Element {
  const cfg = MEDAL_CONFIG[place] ?? MEDAL_CONFIG[4];
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border p-6 text-center',
        cfg.bg,
        cfg.border,
        place <= 2 ? 'py-8' : '',
      )}
    >
      <span className={cn('font-barlow-condensed font-black leading-none', cfg.size)}>
        {MEDAL_EMOJI[place]}
      </span>
      <span
        className={cn(
          'inline-block rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wide',
          cfg.badge,
        )}
      >
        {label}
      </span>
      <p className={cn('font-semibold text-base leading-snug max-w-[14rem]', cfg.text)}>
        {equipeNom}
      </p>
    </div>
  );
}

function PodiumSection({
  title,
  places,
  pending,
}: {
  title: string;
  places: PodiumPlace[];
  pending: boolean;
}): JSX.Element {
  if (pending && places.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-dark-300 p-10 text-center text-dark-100 text-sm">
        {title} — résultats disponibles à la fin du tableau
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-semibold text-gray-100">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {places.map((p) => (
          <PodiumCard key={p.place} {...p} />
        ))}
        {places.length === 0 && (
          <p className="col-span-4 text-center text-dark-100 text-sm py-6">
            Résultats non disponibles
          </p>
        )}
      </div>
    </div>
  );
}

export function CoupePodiumsTab({ parties, hasConsolante }: CoupePodiumsTabProps): JSX.Element {
  // Support both COUPE and CHAMPIONNAT formats
  const principaleParties = parties.filter(
    (p) => p.type === 'COUPE_PRINCIPALE' || p.type === 'CHAMPIONNAT_FINALE'
  );
  const consolanteParties = parties.filter((p) => p.type === 'COUPE_CONSOLANTE');

  const principalePodium = extractPodium(principaleParties);
  const consolantePodium = extractPodium(consolanteParties);

  const principaleDone = principaleParties.some(
    (p) => (p.bracketRonde ?? 0) >= 6 && (p.statut === 'TERMINEE' || p.statut === 'FORFAIT'),
  );
  const consolanteDone =
    consolanteParties.length > 0 &&
    consolanteParties.some(
      (p) => (p.bracketRonde ?? 0) >= 6 && (p.statut === 'TERMINEE' || p.statut === 'FORFAIT'),
    );

  if (parties.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-dark-300 p-12 text-center text-dark-100 text-sm">
        Le tableau n'a pas encore été lancé. Les podiums seront affichés ici au fur et à mesure de l'avancement du tournoi.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PodiumSection
        title="Tableau Principal"
        places={principalePodium}
        pending={!principaleDone}
      />
      {hasConsolante && (
        <PodiumSection
          title="Consolante"
          places={consolantePodium}
          pending={!consolanteDone}
        />
      )}
    </div>
  );
}
