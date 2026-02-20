import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/concours', icon: Trophy, label: 'Concours', end: false },
];

export function BottomNav(): JSX.Element {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-dark-400 border-t border-dark-300 z-40">
      <div className="flex">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
                isActive ? 'text-primary-400 bg-primary-600/20' : 'text-dark-50',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} className={isActive ? 'text-primary-400' : ''} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
