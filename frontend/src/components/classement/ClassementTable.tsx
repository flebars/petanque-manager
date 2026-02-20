import type { Classement } from '@/types';
import { PodiumBadge } from '@/components/common/PodiumBadge';
import { nomEquipe } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ClassementTableProps {
  classements: Classement[];
  highlightEquipeId?: string;
}

export function ClassementTable({
  classements,
  highlightEquipeId,
}: ClassementTableProps): JSX.Element {
  if (classements.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-dark-300 p-8 text-center text-dark-50 text-sm">
        Aucun classement disponible pour le moment.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-dark-300">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dark-300 bg-dark-500">
            <th className="py-3 px-4 text-left font-medium text-dark-50 w-12">Rang</th>
            <th className="py-3 px-4 text-left font-medium text-dark-50">Équipe</th>
            <th className="py-3 px-4 text-center font-medium text-dark-50 w-16">V</th>
            <th className="py-3 px-4 text-center font-medium text-dark-50 w-16">D</th>
            <th className="py-3 px-4 text-center font-medium text-dark-50 w-20">Pts +</th>
            <th className="py-3 px-4 text-center font-medium text-dark-50 w-20">Pts -</th>
            <th className="py-3 px-4 text-center font-medium text-dark-50 w-24">Quotient</th>
          </tr>
        </thead>
        <tbody>
          {classements.map((cl, idx) => {
            const rang = cl.rang ?? idx + 1;
            const isHighlighted = highlightEquipeId === cl.equipeId;
            const equipeNom = cl.equipe ? nomEquipe(cl.equipe) : cl.equipeId;
            const joueurs = cl.equipe?.joueurs ?? [];
            const club = joueurs[0]?.joueur?.club;

            return (
              <tr
                key={cl.id}
                className={cn(
                  'border-b border-dark-400 transition-colors',
                  isHighlighted
                    ? 'bg-primary-600/40'
                    : rang % 2 === 0
                      ? 'bg-dark-500/50'
                      : 'bg-transparent',
                  'hover:bg-dark-400',
                )}
              >
                <td className="py-3 px-4">
                  <PodiumBadge rang={rang} />
                </td>
                <td className="py-3 px-4">
                  <p className="font-medium text-gray-100 truncate max-w-[200px]">{equipeNom}</p>
                  {club && (
                    <p className="text-xs text-dark-100 truncate max-w-[200px]">{club}</p>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="font-barlow-condensed font-bold text-base text-success-500">
                    {cl.victoires}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="font-barlow-condensed font-bold text-base text-dark-50">
                    {cl.defaites}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="font-barlow-condensed font-bold text-base text-gray-100">
                    {cl.pointsMarques}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="font-barlow-condensed font-bold text-base text-dark-100">
                    {cl.pointsEncaisses}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={cn(
                      'inline-block font-barlow-condensed font-bold text-sm px-2 py-0.5 rounded-md tabular-nums',
                      cl.quotient >= 1
                        ? 'bg-success-600/20 text-success-500'
                        : 'bg-dark-300 text-dark-50',
                    )}
                  >
                    {cl.quotient.toFixed(2)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
