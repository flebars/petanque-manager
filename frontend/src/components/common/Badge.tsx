import { cn } from '@/lib/utils';

type BadgeVariant = 'blue' | 'green' | 'orange' | 'red' | 'gray' | 'purple';

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = 'gray', className, children }: BadgeProps): JSX.Element {
  const variantClass: Record<BadgeVariant, string> = {
    blue:   'badge-primary',
    green:  'badge-success',
    orange: 'badge-warning',
    red:    'badge-error',
    gray:   'badge-secondary',
    purple: 'badge bg-purple-600/20 text-purple-400 border border-purple-600/30',
  };
  return (
    <span className={cn('badge', variantClass[variant], className)}>
      {children}
    </span>
  );
}
