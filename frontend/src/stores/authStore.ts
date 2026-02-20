import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { JwtUser, Role } from '@/types';

interface AuthStore {
  accessToken: string | null;
  refreshToken: string | null;
  user: JwtUser | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: JwtUser) => void;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

function parseJwt(token: string): JwtUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { sub: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      setTokens: (accessToken, refreshToken) => {
        const user = parseJwt(accessToken);
        set({ accessToken, refreshToken, isAuthenticated: true, user: user ?? get().user });
      },
      setUser: (user) => set({ user }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false }),
      hasRole: (...roles) => {
        const { user } = get();
        return user ? roles.includes(user.role) : false;
      },
    }),
    {
      name: 'auth-store',
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          state.isAuthenticated = true;
        }
      },
    },
  ),
);
