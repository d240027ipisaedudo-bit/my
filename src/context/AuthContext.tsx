import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { AppUser, UserRole } from '@/types';

interface AuthContextValue {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, username: string, role: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchAppUser(authId: string): Promise<AppUser | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .maybeSingle();
    if (error || !data) return null;
    return data as AppUser;
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        fetchAppUser(session.user.id).then((u) => {
          if (!mounted) return;
          setUser(u);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        (async () => {
          const u = await fetchAppUser(session.user.id);
          setUser(u);
        })();
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string, _remember: boolean) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }

  async function signUp(email: string, password: string, fullName: string, username: string, role: UserRole) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: translateAuthError(error.message) };
    if (!data.user) return { error: 'No se pudo crear la cuenta.' };

    const { error: profileError } = await supabase.from('users').insert({
      auth_id: data.user.id,
      username,
      full_name: fullName,
      email,
      role,
      is_active: true,
    });
    if (profileError) return { error: 'Cuenta creada pero falló el registro de perfil.' };

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }

  async function refreshUser() {
    if (session?.user) {
      const u = await fetchAppUser(session.user.id);
      setUser(u);
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('user already registered')) return 'Ya existe una cuenta con este correo.';
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('email')) return 'El correo electrónico no es válido.';
  if (m.includes('rate limit')) return 'Demasiados intentos. Intenta más tarde.';
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}
