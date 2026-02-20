import { cn } from '@/lib/utils';

interface ProgressBarProps {
  valueA: number;
  valueB: number;
  className?: string;
}

export function ProgressBar({ valueA, valueB, className }: ProgressBarProps): JSX.Element {
  const total = valueA + valueB;
  const pctA = total === 0 ? 50 : Math.round((valueA / total) * 100);

  return (
    <div className={cn('progress-bar', className)}>
      <div className="progress-fill" style={{ width: `${pctA}%` }} />
    </div>
  );
}
