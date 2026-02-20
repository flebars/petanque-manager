import { cn } from '@/lib/utils';

interface PodiumBadgeProps {
  rang: number;
  className?: string;
}

export function PodiumBadge({ rang, className }: PodiumBadgeProps): JSX.Element {
  if (rang === 1) {
    return (
      <span className={cn('position-badge position-badge-gold', className)}>1</span>
    );
  }
  if (rang === 2) {
    return (
      <span className={cn('position-badge position-badge-silver', className)}>2</span>
    );
  }
  if (rang === 3) {
    return (
      <span className={cn('position-badge position-badge-bronze', className)}>3</span>
    );
  }
  return (
    <span className={cn('position-badge position-badge-default', className)}>{rang}</span>
  );
}
