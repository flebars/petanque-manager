import type { Terrain, Partie } from '@/types';
import { TerrainCard } from './TerrainCard';

interface TerrainListProps {
  terrains: Terrain[];
  parties: Partie[];
  concoursId: string;
}

export function TerrainList({ terrains, parties, concoursId }: TerrainListProps): JSX.Element {
  if (terrains.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-dark-300 p-8 text-center text-dark-50 text-sm">
        Aucun terrain configuré pour ce concours
      </div>
    );
  }

  const sortedTerrains = [...terrains].sort((a, b) => a.numero - b.numero);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedTerrains.map((terrain) => {
        const terrainParties = parties.filter((p) => p.terrainId === terrain.id);
        return (
          <TerrainCard
            key={terrain.id}
            terrain={terrain}
            parties={terrainParties}
            concoursId={concoursId}
          />
        );
      })}
    </div>
  );
}
