import { api } from './client';
import { AuthTokens, JwtUser } from '@/types';

export const authApi = {
  login: (email: string, password: string): Promise<AuthTokens> =>
    api.post<AuthTokens>('/auth/login', { email, password }).then((r) => r.data),

  register: (data: {
    email: string;
    password: string;
    nom: string;
    prenom: string;
    genre: string;
  }): Promise<AuthTokens> =>
    api.post<AuthTokens>('/auth/register', data).then((r) => r.data),

  me: (): Promise<JwtUser> => api.get<JwtUser>('/auth/me').then((r) => r.data),

  logout: (): Promise<void> => api.post('/auth/logout').then(() => undefined),
};
