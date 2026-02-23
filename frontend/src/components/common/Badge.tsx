import { cn } from '@/lib/utils';

type BadgeVariant = 'blue' | 'green' | 'orange' | 'red' | 'gray' | 'purple';
type BadgeSize = 'xs' | 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = 'gray', size = 'md', className, children }: BadgeProps): JSX.Element {
  const variantClass: Record<BadgeVariant, string> = {
    blue:   'badge-primary',
    green:  'badge-success',
    orange: 'badge-warning',
    red:    'badge-error',
    gray:   'badge-secondary',
    purple: 'badge bg-purple-600/20 text-purple-400 border border-purple-600/30',
  };
  
  const sizeClass: Record<BadgeSize, string> = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };
  
  return (
    <span className={cn('badge', variantClass[variant], sizeClass[size], className)}>
      {children}
    </span>
  );
}
