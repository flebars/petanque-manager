import { Badge } from '@/components/common/Badge';
import type { StatutConcours } from '@/types';
import { STATUT_CONCOURS_LABELS } from '@/lib/utils';

interface ConcoursStatusBadgeProps {
  statut: StatutConcours;
}

export function ConcoursStatusBadge({ statut }: ConcoursStatusBadgeProps): JSX.Element {
  const variantMap: Record<StatutConcours, 'orange' | 'green' | 'gray'> = {
    INSCRIPTION: 'orange',
    EN_COURS: 'green',
    TERMINE: 'gray',
  };
  return <Badge variant={variantMap[statut]}>{STATUT_CONCOURS_LABELS[statut]}</Badge>;
}
