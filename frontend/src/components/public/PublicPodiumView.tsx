import type { Partie } from '@/types';
import { nomEquipe, isByeTeam, isTbdTeam, cn } from '@/lib/utils';

interface PublicPodiumViewProps {
  parties: Partie[];
  hasConsolante: boolean;
}

interface PodiumPlace {
  place: number;
  equipeNom: string;
  label: string;
  pending?: boolean;
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
  } else {
    const maxSemi = maxRonde - 1;
    const semis = matchesByType.filter((p) => p.bracketRonde === maxSemi);
    const semiLosers = semis
      .filter((p) => p.statut === 'TERMINEE' || p.statut === 'FORFAIT')
      .map(getLoser)
      .filter((n): n is string => n !== null);
    if (semiLosers[0]) {
      places.push({ place: 3, equipeNom: semiLosers[0], label: 'Petite Finale', pending: true });
    }
    if (semiLosers[1]) {
      places.push({ place: 4, equipeNom: semiLosers[1], label: 'Petite Finale', pending: true });
    }
  }

  return places;
}

const MEDAL_CONFIG: Record<
  number,
  { bg: string; border: string; text: string; badge: string; emoji: string }
> = {
  1: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-400/50',
    text: 'text-amber-200',
    badge: 'bg-amber-400 text-amber-900',
    emoji: '🥇',
  },
  2: {
    bg: 'bg-slate-400/10',
    border: 'border-slate-300/40',
    text: 'text-slate-200',
    badge: 'bg-slate-300 text-slate-900',
    emoji: '🥈',
  },
  3: {
    bg: 'bg-orange-700/10',
    border: 'border-orange-500/40',
    text: 'text-orange-300',
    badge: 'bg-orange-600 text-white',
    emoji: '🥉',
  },
  4: {
    bg: 'bg-dark-400',
    border: 'border-dark-300',
    text: 'text-dark-50',
    badge: 'bg-dark-300 text-dark-50',
    emoji: '4',
  },
};

interface PodiumCardProps extends PodiumPlace {
  size: 'lg' | 'sm';
}

function PodiumCard({ place, equipeNom, label, pending, size }: PodiumCardProps): JSX.Element {
  const cfg = MEDAL_CONFIG[place] ?? MEDAL_CONFIG[4];
  const isLarge = size === 'lg';

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border text-center',
        cfg.bg,
        cfg.border,
        isLarge ? (place <= 2 ? 'p-8' : 'p-6') : (place <= 2 ? 'p-5' : 'p-4'),
      )}
    >
      <span
        className={cn(
          'leading-none select-none',
          isLarge ? (place <= 2 ? 'text-8xl' : 'text-6xl') : (place <= 2 ? 'text-5xl' : 'text-4xl'),
        )}
      >
        {cfg.emoji}
      </span>
      <span
        className={cn(
          'inline-block rounded-full px-3 py-0.5 font-bold uppercase tracking-wide',
          cfg.badge,
          isLarge ? 'text-sm' : 'text-xs',
        )}
      >
        {label}
      </span>
      <p
        className={cn(
          'font-barlow-condensed font-black leading-snug break-words text-center max-w-[16rem]',
          cfg.text,
          isLarge ? (place <= 2 ? 'text-4xl' : 'text-3xl') : (place <= 2 ? 'text-2xl' : 'text-xl'),
        )}
      >
        {equipeNom}
      </p>
      {pending && (
        <span className="text-xs text-dark-100 italic">petite finale à venir</span>
      )}
    </div>
  );
}

interface PodiumSectionProps {
  title: string;
  places: PodiumPlace[];
  size: 'lg' | 'sm';
}

function PodiumSection({ title, places, size }: PodiumSectionProps): JSX.Element {
  if (places.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-dark-300 p-10 text-center text-dark-100 text-base">
        Résultats disponibles à la fin du tableau
      </div>
    );
  }

  const top2 = places.filter((p) => p.place <= 2);
  const bottom2 = places.filter((p) => p.place >= 3);

  return (
    <div className="flex flex-col items-center gap-6">
      {title && (
        <h3
          className={cn(
            'font-barlow-condensed font-bold uppercase tracking-widest text-dark-50',
            size === 'lg' ? 'text-2xl' : 'text-lg',
          )}
        >
          {title}
        </h3>
      )}
      <div className="flex flex-col items-center gap-4 w-full">
        <div className="flex justify-center gap-4 flex-wrap">
          {top2.map((p) => (
            <PodiumCard key={p.place} {...p} size={size} />
          ))}
        </div>
        {bottom2.length > 0 && (
          <div className="flex justify-center gap-4 flex-wrap">
            {bottom2.map((p) => (
              <PodiumCard key={p.place} {...p} size={size} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PublicPodiumView({ parties, hasConsolante }: PublicPodiumViewProps): JSX.Element {
  const principaleParties = parties.filter(
    (p) => p.type === 'COUPE_PRINCIPALE' || p.type === 'CHAMPIONNAT_FINALE'
  );
  const consolanteParties = parties.filter((p) => p.type === 'COUPE_CONSOLANTE');

  const principalePodium = extractPodium(principaleParties);
  const consolantePodium = extractPodium(consolanteParties);

  const showConsolante = hasConsolante && consolanteParties.length > 0;

  if (principaleParties.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 text-dark-100 text-lg">
        Le tableau n'a pas encore été lancé.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-12 px-8 py-10">
      <PodiumSection
        title={showConsolante ? 'Tableau Principal' : ''}
        places={principalePodium}
        size={showConsolante ? 'sm' : 'lg'}
      />
      {showConsolante && (
        <>
          <div className="w-full max-w-3xl border-t border-dark-300" />
          <PodiumSection
            title="Consolante"
            places={consolantePodium}
            size="sm"
          />
        </>
      )}
    </div>
  );
}
