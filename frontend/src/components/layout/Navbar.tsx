import { Menu, LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/api/auth';

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps): JSX.Element {
  const { user, logout } = useAuthStore();

  const handleLogout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      logout();
    }
  };

  return (
    <header className="h-16 bg-[#0A1219] border-b border-[#1C2B38] flex items-center px-4 gap-4 shrink-0 md:hidden">
      <button
        onClick={onMenuClick}
        className="text-[#7A9BB5] hover:text-[#E8EDF2] transition-colors p-1 rounded-lg hover:bg-[#1C2B38]"
      >
        <Menu size={20} />
      </button>
      <span className="font-bold text-[#E8EDF2] text-sm flex-1">Pétanque Manager</span>
      {user && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-[#7A9BB5] text-sm">
            <User size={16} />
            <span className="hidden sm:inline">{user.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-[#7A9BB5] hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-[#1C2B38]"
            title="Déconnexion"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </header>
  );
}
