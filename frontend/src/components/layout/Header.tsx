import { LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/api/auth';

export function Header(): JSX.Element {
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
    <header className="h-16 bg-dark-400 border-b border-dark-300 flex items-center px-6 gap-4 shrink-0">
      <div className="md:hidden font-display text-xl font-bold text-gray-100">
        Pétanque Manager
      </div>

      <div className="flex-1" />

      {user && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-dark-50 text-sm">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
              <User size={14} className="text-primary-300" />
            </div>
            <span className="hidden sm:block">{user.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-dark-50 hover:bg-dark-300 hover:text-white transition-colors"
            title="Déconnexion"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </header>
  );
}
