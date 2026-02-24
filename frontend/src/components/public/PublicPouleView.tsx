import { useMemo } from 'react';
import { Users } from 'lucide-react';
import type { Partie, Poule, Equipe } from '@/types';
import { nomEquipe, cn } from '@/lib/utils';

interface PublicPouleViewProps {
  poules: Poule[];
  parties: Partie[];
}

export function PublicPouleView({ poules, parties }: PublicPouleViewProps) {
  if (poules.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 text-dark-100 text-lg">
        Les poules ne sont pas encore créées.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
      {poules.map((poule) => (
        <PouleCard
          key={poule.id}
          poule={poule}
          parties={parties.filter((p) => p.pouleId === poule.id)}
        />
      ))}
    </div>
  );
}

function PouleCard({ poule, parties }: { poule: Poule; parties: Partie[] }) {
  const rankings = useMemo(() => {
    const stats = new Map<string, { 
      equipe: Equipe; 
      victoires: number; 
      pointsMarques: number; 
      pointsEncaisses: number;
      quotient: number;
      matchsJoues: number;
      matchsTotal: number;
    }>();

    poule.equipes.forEach(({ equipe }) => {
      stats.set(equipe.id, { 
        equipe, 
        victoires: 0, 
        pointsMarques: 0, 
        pointsEncaisses: 0,
        quotient: 0,
        matchsJoues: 0,
        matchsTotal: poule.equipes.length - 1,
      });
    });

    parties.forEach((p) => {
      const sA = stats.get(p.equipeAId);
      const sB = stats.get(p.equipeBId);
      if (!sA || !sB) return;

      if (p.statut === 'TERMINEE' || p.statut === 'FORFAIT') {
        sA.matchsJoues++;
        sB.matchsJoues++;
        
        sA.pointsMarques += p.scoreA || 0;
        sA.pointsEncaisses += p.scoreB || 0;
        sB.pointsMarques += p.scoreB || 0;
        sB.pointsEncaisses += p.scoreA || 0;

        if ((p.scoreA || 0) > (p.scoreB || 0)) {
          sA.victoires++;
        } else {
          sB.victoires++;
        }
      }
    });

    return Array.from(stats.values())
      .map(s => {
        s.quotient = s.pointsEncaisses === 0 ? s.pointsMarques : s.pointsMarques / s.pointsEncaisses;
        return s;
      })
      .sort((a, b) => {
        if (a.victoires !== b.victoires) return b.victoires - a.victoires;
        if (a.quotient !== b.quotient) return b.quotient - a.quotient;
        return b.pointsMarques - a.pointsMarques;
      });
  }, [poule, parties]);

  const allMatchesDone = parties.length > 0 && parties.every(p => p.statut === 'TERMINEE' || p.statut === 'FORFAIT');
  const someMatchesDone = parties.some(p => p.statut === 'TERMINEE' || p.statut === 'FORFAIT');

  return (
    <div className="bg-dark-400 rounded-2xl border border-dark-300 overflow-hidden flex flex-col">
      <div className="bg-dark-300 px-6 py-4 flex items-center justify-between border-b border-dark-200">
        <h3 className="font-barlow-condensed font-bold text-2xl text-gray-100 tracking-wide flex items-center gap-2">
          <Users size={22} className="text-primary-500" />
          Poule {poule.numero}
        </h3>
        <span className={cn(
          "text-sm px-3 py-1 rounded-full font-medium",
          allMatchesDone 
            ? "bg-success-500/10 text-success-500 border border-success-500/20" 
            : someMatchesDone
            ? "bg-warning-500/10 text-warning-500 border border-warning-500/20"
            : "bg-dark-200 text-dark-100 border border-dark-200"
        )}>
          {allMatchesDone ? 'Terminée' : someMatchesDone ? 'En cours' : 'À venir'}
        </span>
      </div>

      <div className="p-6">
        <table className="w-full text-base">
          <thead>
            <tr className="text-dark-100 border-b-2 border-dark-300">
              <th className="py-3 pr-4 font-semibold text-left">Pos</th>
              <th className="py-3 pr-4 font-semibold text-left">Équipe</th>
              <th className="py-3 pr-3 font-semibold text-center">V</th>
              <th className="py-3 pr-3 font-semibold text-center">M</th>
              <th className="py-3 pr-3 font-semibold text-center">+/-</th>
              <th className="py-3 font-semibold text-center">Q</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((rank, idx) => (
              <tr key={rank.equipe.id} className="border-b border-dark-300/50 last:border-0">
                <td className="py-4 pr-4">
                  <span className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg",
                    idx < 2 
                      ? "bg-success-500/15 text-success-400 border border-success-500/30" 
                      : "bg-dark-300 text-dark-100"
                  )}>
                    {idx + 1}
                  </span>
                </td>
                <td className="py-4 pr-4">
                  <p className="font-barlow-condensed font-bold text-xl text-gray-100 leading-tight">
                    {nomEquipe(rank.equipe)}
                  </p>
                </td>
                <td className="py-4 pr-3 text-center">
                  <span className="font-barlow-condensed font-black text-2xl text-primary-400">
                    {rank.victoires}
                  </span>
                </td>
                <td className="py-4 pr-3 text-center">
                  <span className="text-lg text-dark-100 tabular-nums">
                    {rank.matchsJoues}/{rank.matchsTotal}
                  </span>
                </td>
                <td className="py-4 pr-3 text-center">
                  <span className={cn(
                    "font-barlow-condensed font-bold text-xl tabular-nums",
                    rank.pointsMarques - rank.pointsEncaisses > 0 
                      ? "text-success-400" 
                      : rank.pointsMarques - rank.pointsEncaisses < 0
                      ? "text-red-400"
                      : "text-dark-100"
                  )}>
                    {rank.pointsMarques - rank.pointsEncaisses > 0 ? '+' : ''}
                    {rank.pointsMarques - rank.pointsEncaisses}
                  </span>
                </td>
                <td className="py-4 text-center">
                  <span className="text-lg text-gray-100 tabular-nums">
                    {rank.quotient.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {rankings.length > 0 && (
          <div className="mt-4 pt-4 border-t border-dark-300">
            <p className="text-sm text-dark-100 text-center">
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-success-500/15 border border-success-500/30"></span>
                Les 2 premiers sont qualifiés pour la phase finale
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
