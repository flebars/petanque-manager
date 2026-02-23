import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MapPin, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Partie } from '@/types';
import { nomEquipe, isTbdTeam, isByeTeam } from '@/lib/utils';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import { partiesApi } from '@/api/parties';

interface BracketViewProps {
  parties: Partie[];
  type: 'COUPE_PRINCIPALE' | 'COUPE_CONSOLANTE';
  concoursId: string;
  onMatchClick?: (match: Partie) => void;
}

interface PlaceholderMatch {
  id: string;
  isPlaceholder: true;
  bracketRonde: number;
  bracketPos: number;
  sourceMatches: number[];
}

type DisplayMatch = Partie | PlaceholderMatch;

interface GroupedRounds {
  [ronde: string]: DisplayMatch[];
}

function isPlaceholder(match: DisplayMatch): match is PlaceholderMatch {
  return 'isPlaceholder' in match && match.isPlaceholder === true;
}

function calculateExpectedMatchesForRound(bracketRonde: number, firstRoundMatchCount: number): number {
  if (bracketRonde >= 6) {
    return 2;
  }
  if (bracketRonde === 5) {
    return 2;
  }
  if (bracketRonde === 4) {
    return 4;
  }
  if (bracketRonde === 3) {
    return 8;
  }
  if (bracketRonde === 2) {
    return 16;
  }
  let powerOf2 = 1;
  while (powerOf2 < firstRoundMatchCount) {
    powerOf2 *= 2;
  }
  return powerOf2;
}

function calculateMaxBracketRonde(firstRoundMatchCount: number, minRound: number): number {
  let powerOf2 = 1;
  while (powerOf2 < firstRoundMatchCount) {
    powerOf2 *= 2;
  }
  let rounds = 0;
  let remaining = powerOf2;
  while (remaining >= 2) {
    remaining = remaining / 2;
    rounds++;
  }
  return minRound + rounds;
}

export function BracketView({ parties, type, concoursId, onMatchClick }: BracketViewProps) {
  const { rounds, allRoundKeys, minRound, maxRound } = useMemo(() => {
    const grouped: GroupedRounds = {};
    
    parties.forEach((p) => {
      const round = String(p.bracketRonde ?? 1);
      if (!grouped[round]) grouped[round] = [];
      grouped[round].push(p);
    });

    if (Object.keys(grouped).length === 0) {
      return { rounds: {}, allRoundKeys: [], minRound: 1, maxRound: 1 };
    }

    const allRoundKeys = Object.keys(grouped).map(k => parseInt(k));
    const minRound = Math.min(...allRoundKeys);
    const firstRoundMatches = grouped[String(minRound)];
    const firstRoundCount = firstRoundMatches.length;
    const maxBracketRonde = calculateMaxBracketRonde(firstRoundCount, minRound);
    
    for (let bracketRonde = minRound; bracketRonde <= maxBracketRonde; bracketRonde++) {
      const roundKey = String(bracketRonde);
      if (!grouped[roundKey]) {
        grouped[roundKey] = [];
      }
      
      const expectedMatches = calculateExpectedMatchesForRound(bracketRonde, firstRoundCount);
      const existingCount = grouped[roundKey].length;
      
      for (let i = existingCount; i < expectedMatches; i++) {
        grouped[roundKey].push({
          id: `placeholder-${bracketRonde}-${i}`,
          isPlaceholder: true,
          bracketRonde: bracketRonde,
          bracketPos: i,
          sourceMatches: [i * 2, i * 2 + 1],
        });
      }
    }

    const sortedKeys = Object.keys(grouped).sort((a, b) => parseInt(a) - parseInt(b));
    const sortedRounds: GroupedRounds = {};
    sortedKeys.forEach((key) => {
      sortedRounds[key] = grouped[key].sort((a, b) => (a.bracketPos ?? 0) - (b.bracketPos ?? 0));
    });

    return { 
      rounds: sortedRounds, 
      allRoundKeys: sortedKeys.map(k => parseInt(k)),
      minRound,
      maxRound: maxBracketRonde
    };
  }, [parties]);

  const [activeRound, setActiveRound] = useState<number>(minRound);

  if (parties.length === 0) {
    if (type === 'COUPE_CONSOLANTE') {
      return (
        <div className="bracket-container">
          <h3 className="text-2xl font-bold mb-6 text-primary-500">
            🎖️ Consolante
          </h3>
          <div className="text-center py-12 text-dark-100 bg-dark-400 rounded-lg border border-dashed border-dark-200">
            <p className="text-lg">Tableau Consolante</p>
            <p className="text-sm mt-2">Sera créé automatiquement avec les perdants du Tour 1</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="text-center py-12 text-dark-100">
        <p>Tableau principal non lancé</p>
      </div>
    );
  }

  const currentRoundMatches = rounds[String(activeRound)] || [];
  const nextRoundMatches = rounds[String(activeRound + 1)] || [];
  const hasNextRound = activeRound < maxRound;

  return (
    <div className="bracket-container">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-primary-500">
          {type === 'COUPE_PRINCIPALE' ? '🏆 Tableau Principal' : '🎖️ Consolante'}
        </h3>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveRound(Math.max(minRound, activeRound - 1))}
            disabled={activeRound === minRound}
            className={cn(
              'p-2 rounded-lg transition-colors',
              activeRound === minRound
                ? 'text-dark-200 cursor-not-allowed'
                : 'text-primary-400 hover:bg-dark-400'
            )}
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex gap-1.5">
            {allRoundKeys.map((round) => (
              <button
                key={round}
                onClick={() => setActiveRound(round)}
                className={cn(
                  'min-w-[2.5rem] h-10 px-3 rounded-lg text-sm font-medium transition-colors',
                  activeRound === round
                    ? 'bg-primary-500 text-white'
                    : 'bg-dark-400 text-dark-50 hover:text-gray-100'
                )}
              >
                {getRoundShortLabel(round)}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setActiveRound(Math.min(maxRound, activeRound + 1))}
            disabled={activeRound === maxRound}
            className={cn(
              'p-2 rounded-lg transition-colors',
              activeRound === maxRound
                ? 'text-dark-200 cursor-not-allowed'
                : 'text-primary-400 hover:bg-dark-400'
            )}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <div className="text-xl font-bold text-gray-100 mb-4">
            {getRoundLabel(String(activeRound), currentRoundMatches.filter(m => !isPlaceholder(m)) as Partie[])}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {currentRoundMatches.map((match) => (
              <div
                key={isPlaceholder(match) ? match.id : match.id}
                className={cn(
                  'bracket-match',
                  !isPlaceholder(match) && match.statut === 'EN_COURS' && 'bracket-match-active cursor-pointer',
                  !isPlaceholder(match) && match.statut === 'TERMINEE' && 'bracket-match-finished',
                  isPlaceholder(match) && 'bracket-match-placeholder',
                )}
                onClick={() => !isPlaceholder(match) && match.statut === 'EN_COURS' && onMatchClick?.(match)}
              >
                {isPlaceholder(match) ? (
                  <PlaceholderMatchCard 
                    placeholder={match} 
                    isFinale={activeRound === 6 && (match.bracketPos === 0 || match.bracketPos === 1)}
                  />
                ) : (
                  <BracketMatchCard 
                    match={match}
                    concoursId={concoursId}
                    isFinale={match.bracketRonde === 6 && (match.bracketPos === 0 || match.bracketPos === 1)} 
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {hasNextRound && nextRoundMatches.length > 0 && (
          <div className="border-t border-dark-300 pt-6">
            <div className="text-lg font-semibold text-dark-100 mb-4 flex items-center gap-2">
              <span>Projection :</span>
              <span className="text-primary-400">
                {getRoundLabel(String(activeRound + 1), nextRoundMatches.filter(m => !isPlaceholder(m)) as Partie[])}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {nextRoundMatches.map((match) => (
                <div
                  key={isPlaceholder(match) ? match.id : match.id}
                  className="bracket-match bracket-match-placeholder cursor-default"
                >
                  {isPlaceholder(match) ? (
                    <PlaceholderMatchCard 
                      placeholder={match} 
                      showProjectionLabel 
                      isFinale={(activeRound + 1) === 6 && (match.bracketPos === 0 || match.bracketPos === 1)}
                    />
                  ) : (
                    <BracketMatchCard 
                      match={match}
                      concoursId={concoursId}
                      isFinale={match.bracketRonde === 6 && (match.bracketPos === 0 || match.bracketPos === 1)} 
                      preview 
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getRoundLabel(ronde: string, matches: Partie[]): string {
  const roundNum = parseInt(ronde);
  const matchCount = matches.length;
  
  switch (roundNum) {
    case 6:
      return matchCount === 2 ? 'Finales' : 'Finale';
    case 5:
      return 'Demi-finales';
    case 4:
      return 'Quarts de finale';
    case 3:
      return 'Huitièmes de finale';
    case 2:
      return 'Seizièmes de finale';
    case 1:
      return 'Trente-deuxièmes de finale';
    default:
      return `Tour ${ronde}`;
  }
}

function getRoundShortLabel(round: number): string {
  if (round >= 6) {
    return 'F';
  }
  switch (round) {
    case 5:
      return '1/2';
    case 4:
      return '1/4';
    case 3:
      return '1/8';
    case 2:
      return '1/16';
    case 1:
      return '1/32';
    default:
      return `T${round}`;
  }
}

interface BracketMatchCardProps {
  match: Partie;
  concoursId: string;
  isFinale?: boolean;
  preview?: boolean;
}

function BracketMatchCard({ match, concoursId, isFinale = false, preview = false }: BracketMatchCardProps) {
  const queryClient = useQueryClient();
  const { equipeA, equipeB, scoreA, scoreB, statut, terrain } = match;

  const demarrerMutation = useMutation({
    mutationFn: () => partiesApi.demarrer(match.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties', concoursId] });
      toast.success('Partie démarrée');
    },
    onError: () => toast.error('Impossible de démarrer la partie'),
  });

  // Check if it's a bye match (equipeB is the __BYE__ placeholder)
  const isBye = isByeTeam(equipeB) || (equipeA && isByeTeam(equipeA));
  
  // Check if both teams are TBD (waiting for both teams)
  const bothTbd = isTbdTeam(equipeA) && isTbdTeam(equipeB);
  
  // Placeholder means waiting for opponent (one real team, one TBD)
  const isPlaceholder = !isBye && !bothTbd && 
    (isTbdTeam(equipeA) || isTbdTeam(equipeB)) && 
    statut === 'A_MONTER';
  
  const winner =
    !isBye && scoreA !== null && scoreB !== null && scoreA !== undefined && scoreB !== undefined
      ? scoreA > scoreB
        ? 'A'
        : scoreB > scoreA
          ? 'B'
          : null
      : null;

  const isGrandeFinale = isFinale && match.bracketPos === 0;
  const isPetiteFinale = isFinale && match.bracketPos === 1;
  
  const hasTeamA = equipeA && equipeA.id && !isTbdTeam(equipeA);
  const hasTeamB = equipeB && equipeB.id && !isTbdTeam(equipeB);
  const hasBothRealTeams = hasTeamA && hasTeamB && !isBye;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 px-1">
        {!preview && terrain && (
          <div className="flex items-center gap-1 text-xs text-dark-100">
            <MapPin size={11} className="text-primary-400" />
            <span className="font-display font-bold text-xs text-gray-100">
              T{terrain.numero}
            </span>
          </div>
        )}
        {!preview && hasBothRealTeams && !terrain && (
          <div className="flex items-center gap-1 text-xs text-dark-200 italic">
            <span>En attente de terrain</span>
          </div>
        )}
        {preview && (
          <div className="text-xs text-dark-200 italic">Projection</div>
        )}
        {isGrandeFinale && (
          <Badge variant={preview ? "gray" : "orange"} size="sm">
            🏆 Grande Finale
          </Badge>
        )}
        {isPetiteFinale && (
          <Badge variant="gray" size="sm">
            🥉 Petite Finale
          </Badge>
        )}
      </div>

      {isBye ? (
        <div className="text-center py-2">
          <div className={cn("bracket-team", preview ? "" : "bracket-team-winner")}>
            <span className="bracket-team-name">{isByeTeam(equipeA!) ? nomEquipe(equipeB!) : nomEquipe(equipeA!)}</span>
            {!preview && (
              <Badge variant="green" size="sm">
                Bye
              </Badge>
            )}
          </div>
        </div>
      ) : bothTbd ? (
        <>
          <div className="bracket-team bracket-team-placeholder">
            <span className="bracket-team-name text-light-200 italic">À déterminer</span>
            <span className="bracket-team-score text-dark-300">-</span>
          </div>
          <div className="bracket-team bracket-team-placeholder">
            <span className="bracket-team-name text-light-200 italic">À déterminer</span>
            <span className="bracket-team-score text-dark-300">-</span>
          </div>
        </>
      ) : isPlaceholder ? (
        <>
          <div className={cn('bracket-team', !hasTeamA && 'bracket-team-placeholder')}>
            <span className="bracket-team-name">{hasTeamA ? nomEquipe(equipeA!) : <span className="text-light-200 italic">En attente de l'adversaire</span>}</span>
            <span className="bracket-team-score">-</span>
          </div>
          <div className={cn('bracket-team', !hasTeamB && 'bracket-team-placeholder')}>
            <span className="bracket-team-name">{hasTeamB ? nomEquipe(equipeB!) : <span className="text-light-200 italic">En attente de l'adversaire</span>}</span>
            <span className="bracket-team-score text-dark-300">-</span>
          </div>
        </>
      ) : (
        <>
          <div className={cn('bracket-team', winner === 'A' && !preview && 'bracket-team-winner')}>
            <span className="bracket-team-name">
              {hasTeamA ? nomEquipe(equipeA!) : <span className="text-light-200 italic">En attente de l'adversaire</span>}
            </span>
            <span className="bracket-team-score">{preview ? '-' : (scoreA ?? '-')}</span>
          </div>

          <div className={cn('bracket-team', winner === 'B' && !preview && 'bracket-team-winner')}>
            <span className="bracket-team-name">
              {hasTeamB ? nomEquipe(equipeB!) : <span className="text-dark-200 italic">À déterminer</span>}
            </span>
            <span className="bracket-team-score">{preview ? '-' : (scoreB ?? '-')}</span>
          </div>
        </>
      )}

      {!preview && hasBothRealTeams && statut === 'A_JOUER' && (
        <div className="mt-2 pt-2 border-t border-dark-300" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="success"
            className="w-full"
            onClick={() => demarrerMutation.mutate()}
            loading={demarrerMutation.isPending}
          >
            <Play size={13} /> Démarrer
          </Button>
        </div>
      )}
      {!preview && statut === 'EN_COURS' && (
        <div className="text-center mt-1">
          <Badge variant="orange" size="sm">
            En cours
          </Badge>
        </div>
      )}
      {!preview && statut === 'A_JOUER' && !hasBothRealTeams && (
        <div className="text-center mt-1">
          <Badge variant="gray" size="sm">
            À jouer
          </Badge>
        </div>
      )}
    </div>
  );
}

interface PlaceholderMatchCardProps {
  placeholder: PlaceholderMatch;
  showProjectionLabel?: boolean;
  isFinale?: boolean;
}

function PlaceholderMatchCard({ placeholder, showProjectionLabel = false, isFinale = false }: PlaceholderMatchCardProps) {
  const isGrandeFinale = isFinale && placeholder.bracketPos === 0;
  const isPetiteFinale = isFinale && placeholder.bracketPos === 1;

  return (
    <div className="space-y-1">
      {showProjectionLabel && (
        <div className="flex items-center justify-center gap-2 px-1 mb-1">
          <div className="text-xs text-dark-200 italic">Projection</div>
        </div>
      )}
      
      {(isGrandeFinale || isPetiteFinale) && (
        <div className="flex items-center justify-center gap-2 px-1">
          {isGrandeFinale && (
            <Badge variant="gray" size="sm">
              🏆 Grande Finale
            </Badge>
          )}
          {isPetiteFinale && (
            <Badge variant="gray" size="sm">
              🥉 Petite Finale
            </Badge>
          )}
        </div>
      )}

      <div className="bracket-team bracket-team-placeholder">
        <span className="bracket-team-name text-dark-200">À venir</span>
        <span className="bracket-team-score text-dark-300">-</span>
      </div>

      <div className="bracket-team bracket-team-placeholder">
        <span className="bracket-team-name text-dark-200">À venir</span>
        <span className="bracket-team-score text-dark-300">-</span>
      </div>
    </div>
  );
}
