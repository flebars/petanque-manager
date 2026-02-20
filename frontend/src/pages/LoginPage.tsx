import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Trophy } from 'lucide-react';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import type { JwtUser } from '@/types';

function parseJwt(token: string): JwtUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { sub: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court'),
});

const registerSchema = loginSchema.extend({
  nom: z.string().min(1, 'Nom requis'),
  prenom: z.string().min(1, 'Prénom requis'),
  genre: z.enum(['H', 'F']),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function LoginPage(): JSX.Element {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { genre: 'H' },
  });

  const onLogin = async (data: LoginForm): Promise<void> => {
    try {
      const tokens = await authApi.login(data.email, data.password);
      const user = parseJwt(tokens.accessToken);
      setTokens(tokens.accessToken, tokens.refreshToken);
      if (user) setUser(user);
      navigate('/');
    } catch {
      toast.error('Email ou mot de passe incorrect');
    }
  };

  const onRegister = async (data: RegisterForm): Promise<void> => {
    try {
      const tokens = await authApi.register(data);
      const user = parseJwt(tokens.accessToken);
      setTokens(tokens.accessToken, tokens.refreshToken);
      if (user) setUser(user);
      navigate('/');
    } catch {
      toast.error("Erreur lors de la création du compte");
    }
  };

  return (
    <div className="min-h-screen bg-dark-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary-600/20 flex items-center justify-center">
            <Trophy size={32} className="text-primary-400" />
          </div>
          <h1 className="text-gray-100">Pétanque Manager</h1>
          <p className="text-dark-50 text-sm">Gestion de concours FFPJP</p>
        </div>

        <div className="card border border-dark-300 p-0 overflow-hidden">
          <div className="flex border-b border-dark-300">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'text-primary-400 border-b-2 border-primary-500 bg-primary-600/10'
                    : 'text-dark-50 hover:text-gray-100'
                }`}
              >
                {t === 'login' ? 'Connexion' : 'Créer un compte'}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === 'login' ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="flex flex-col gap-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="votre@email.fr"
                  {...loginForm.register('email')}
                  error={loginForm.formState.errors.email?.message}
                />
                <Input
                  label="Mot de passe"
                  type="password"
                  placeholder="••••••••"
                  {...loginForm.register('password')}
                  error={loginForm.formState.errors.password?.message}
                />
                <Button
                  type="submit"
                  size="lg"
                  className="mt-2"
                  loading={loginForm.formState.isSubmitting}
                >
                  Se connecter
                </Button>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Prénom"
                    placeholder="Jean"
                    {...registerForm.register('prenom')}
                    error={registerForm.formState.errors.prenom?.message}
                  />
                  <Input
                    label="Nom"
                    placeholder="Dupont"
                    {...registerForm.register('nom')}
                    error={registerForm.formState.errors.nom?.message}
                  />
                </div>
                <Input
                  label="Email"
                  type="email"
                  placeholder="votre@email.fr"
                  {...registerForm.register('email')}
                  error={registerForm.formState.errors.email?.message}
                />
                <Input
                  label="Mot de passe"
                  type="password"
                  placeholder="••••••••"
                  {...registerForm.register('password')}
                  error={registerForm.formState.errors.password?.message}
                />
                <div className="flex flex-col gap-1">
                  <span className="label">Genre</span>
                  <div className="flex gap-3">
                    {(['H', 'F'] as const).map((g) => (
                      <label key={g} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value={g}
                          {...registerForm.register('genre')}
                          className="accent-primary-500"
                        />
                        <span className="text-sm text-gray-100">{g === 'H' ? 'Homme' : 'Femme'}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="mt-2"
                  loading={registerForm.formState.isSubmitting}
                >
                  Créer le compte
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
