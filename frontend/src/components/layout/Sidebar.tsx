import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord', end: true },
  { to: '/concours', icon: Trophy, label: 'Concours', end: false },
];

export function Sidebar(): JSX.Element {
  return (
    <aside className="hidden md:flex w-64 flex-col bg-dark-400 border-r border-dark-300 shrink-0">
      <div className="flex items-center h-16 px-6 border-b border-dark-300 shrink-0">
        <span className="font-display text-xl font-bold text-gray-100 tracking-wide">
          Pétanque Manager
        </span>
      </div>

      <nav className="flex-1 py-4 flex flex-col gap-1 px-3">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors relative',
                isActive
                  ? 'bg-primary-600 text-white border-l-4 border-primary-400'
                  : 'text-dark-50 hover:bg-dark-300 hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={cn('shrink-0', isActive ? 'text-white' : '')} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-dark-300">
        <p className="text-xs text-dark-50 text-center">v1.0.0</p>
      </div>
    </aside>
  );
}
