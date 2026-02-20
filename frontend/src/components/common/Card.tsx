import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  onClick?: () => void;
}

export function Card({ children, className, header, footer, onClick }: CardProps): JSX.Element {
  return (
    <div
      className={cn(
        'card border border-dark-300',
        onClick && 'cursor-pointer hover:border-primary-500 transition-colors',
        className,
      )}
      onClick={onClick}
    >
      {header && (
        <div className="-mx-6 -mt-6 px-6 py-4 border-b border-dark-300 mb-6">{header}</div>
      )}
      {children}
      {footer && (
        <div className="-mx-6 -mb-6 px-6 py-4 border-t border-dark-300 mt-6">{footer}</div>
      )}
    </div>
  );
}
