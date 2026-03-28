import { useMemo } from 'react';
import { PlayCircle, Users, FileDown } from 'lucide-react';
import type { Partie, Poule, Equipe } from '@/types';
import { MatchCard } from './MatchCard';
import { Button } from '@/components/common/Button';
import { pdfApi } from '@/api/pdf';
import { nomEquipe, cn } from '@/lib/utils';

interface PouleViewProps {
  poules: Poule[];
  parties: Partie[];
  concoursId: string;
  readonly?: boolean;
  allParties?: Partie[];
}

export function PouleView({ poules, parties, concoursId, readonly, allParties }: PouleViewProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {poules.map((poule) => (
        <PouleCard
          key={poule.id}
          poule={poule}
          parties={parties.filter((p) => p.pouleId === poule.id)}
          concoursId={concoursId}
          readonly={readonly}
          allParties={allParties}
        />
      ))}
    </div>
  );
}

function PouleCard({ poule, parties, concoursId, readonly, allParties }: { 
  poule: Poule; 
  parties: Partie[]; 
  concoursId: string;
  readonly?: boolean;
  allParties?: Partie[];
}) {
  const sortedParties = useMemo(() => {
    return [...parties].sort((a, b) => {
      const terrainA = a.terrain?.numero ?? 999;
      const terrainB = b.terrain?.numero ?? 999;
      if (terrainA !== terrainB) return terrainA - terrainB;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });
  }, [parties]);

  const handleDownloadFiches = async (): Promise<void> => {
    try {
      await pdfApi.downloadFichesPartiePoule(poule.id, poule.numero.toString());
    } catch (error) {
      // Error is already handled in pdfApi
    }
  };

  const rankings = useMemo(() => {
    const stats = new Map<string, { 
      equipe: Equipe; 
      victoires: number; 
      pointsMarques: number; 
      pointsEncaisses: number;
      quotient: number;
    }>();

    poule.equipes.forEach(({ equipe }) => {
      stats.set(equipe.id, { 
        equipe, 
        victoires: 0, 
        pointsMarques: 0, 
        pointsEncaisses: 0,
        quotient: 0
      });
    });

    parties.forEach((p) => {
      if (p.statut !== 'TERMINEE' && p.statut !== 'FORFAIT') return;
      
      const sA = stats.get(p.equipeAId);
      const sB = stats.get(p.equipeBId);
      if (!sA || !sB) return;

      sA.pointsMarques += p.scoreA || 0;
      sA.pointsEncaisses += p.scoreB || 0;
      sB.pointsMarques += p.scoreB || 0;
      sB.pointsEncaisses += p.scoreA || 0;

      if ((p.scoreA || 0) > (p.scoreB || 0)) {
        sA.victoires++;
      } else {
        sB.victoires++;
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

  return (
    <div className="bg-dark-400 rounded-xl border border-dark-300 overflow-hidden flex flex-col">
      <div className="bg-dark-300 px-5 py-3 flex items-center justify-between border-b border-dark-200">
        <div className="flex items-center gap-3">
          <h3 className="font-barlow-condensed font-bold text-xl text-gray-100 tracking-wide flex items-center gap-2">
            <Users size={18} className="text-primary-500" />
            Poule {poule.numero}
          </h3>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            poule.statut === 'TERMINE' ? "bg-success-500/10 text-success-500" : "bg-warning-500/10 text-warning-500"
          )}>
            {poule.statut === 'TERMINE' ? 'Terminée' : 'En cours'}
          </span>
        </div>
        {!readonly && parties.length > 0 && (
          <Button onClick={handleDownloadFiches} variant="secondary" size="sm">
            <FileDown size={14} /> Fiches ({parties.length})
          </Button>
        )}
      </div>

      <div className="p-5 flex flex-col gap-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="text-dark-100 border-b border-dark-300">
                <th className="py-2 pr-4 font-semibold">Pos</th>
                <th className="py-2 pr-4 font-semibold">Équipe</th>
                <th className="py-2 pr-4 font-semibold text-center">V</th>
                <th className="py-2 pr-4 font-semibold text-center">+/-</th>
                <th className="py-2 font-semibold text-center">Q</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((rank, idx) => (
                <tr key={rank.equipe.id} className="border-b border-dark-300/50 last:border-0 group">
                  <td className="py-2.5 pr-4">
                    <span className={cn(
                      "w-6 h-6 rounded flex items-center justify-center font-bold text-xs",
                      idx < 2 ? "bg-success-500/10 text-success-500" : "bg-dark-300 text-dark-100"
                    )}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 font-medium text-gray-100">
                    {nomEquipe(rank.equipe)}
                  </td>
                  <td className="py-2.5 pr-4 text-center font-bold">{rank.victoires}</td>
                  <td className="py-2.5 pr-4 text-center text-dark-100">
                    {rank.pointsMarques - rank.pointsEncaisses > 0 ? '+' : ''}
                    {rank.pointsMarques - rank.pointsEncaisses}
                  </td>
                  <td className="py-2.5 text-center text-dark-100">
                    {rank.quotient.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold text-dark-100 uppercase tracking-wider flex items-center gap-1.5">
            <PlayCircle size={14} />
            Rencontres
          </h4>
          <div className="flex flex-col gap-2">
            {sortedParties.map((partie) => (
              <MatchCard
                key={partie.id}
                partie={partie}
                concoursId={concoursId}
                readonly={readonly}
                compact
                allParties={allParties}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
