import { useState, type FormEvent } from 'react';
import { DollarSign, Mail, Lock, User, Eye, EyeOff, Moon, Sun, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import { ROLE_LABELS, type UserRole } from '@/types';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === 'login') {
      const { error } = await signIn(email, password, remember);
      if (error) showToast(error, 'error');
      else showToast('Bienvenido de nuevo', 'success');
    } else {
      if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, username, role);
      if (error) showToast(error, 'error');
      else {
        showToast('Cuenta creada. Inicia sesión para continuar.', 'success');
        setMode('login');
        setPassword('');
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-ink-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #f97316 0, transparent 40%), radial-gradient(circle at 80% 70%, #ea580c 0, transparent 35%)' }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-brand-500 flex items-center justify-center shadow-xl shadow-brand-500/30">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl">NovaNómina</h1>
              <p className="text-ink-400 text-sm">Sistema de Nómina Profesional</p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="font-display font-bold text-4xl leading-tight">
                Gestiona tu nómina<br />con precisión y control.
              </h2>
              <p className="mt-4 text-ink-300 text-lg max-w-md">
                Administración completa de empleados, asistencia, cálculo de nómina y reportes en una sola plataforma.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 max-w-md">
              {[
                { icon: <Users className="h-5 w-5" />, label: 'Recursos Humanos' },
                { icon: <TrendingUp className="h-5 w-5" />, label: 'Cálculo Automático' },
                { icon: <ShieldCheck className="h-5 w-5" />, label: 'Seguro y Auditado' },
              ].map((f, i) => (
                <div key={i} className="rounded-xl bg-ink-800/60 border border-ink-700 p-4">
                  <div className="h-10 w-10 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-400 mb-3">{f.icon}</div>
                  <p className="text-xs text-ink-300 font-medium leading-snug">{f.label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-ink-500 text-xs">© 2025 NovaCorp · Todos los derechos reservados</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col bg-white dark:bg-ink-950 relative">
        <button onClick={toggleTheme} className="absolute top-5 right-5 p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800 transition">
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md animate-fade-in-up">
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="h-11 w-11 rounded-xl bg-brand-500 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <h1 className="font-display font-bold text-xl text-ink-900 dark:text-white">NovaNómina</h1>
            </div>

            <h2 className="font-display font-bold text-2xl text-ink-900 dark:text-white">
              {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-ink-400">
              {mode === 'login' ? 'Ingresa tus credenciales para acceder al sistema.' : 'Registra tu cuenta para comenzar.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {mode === 'signup' && (
                <>
                  <Input
                    label="Nombre completo"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Juan Pérez"
                    icon={<User className="h-4 w-4" />}
                  />
                  <Input
                    label="Nombre de usuario"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="juan.perez"
                    icon={<User className="h-4 w-4" />}
                  />
                </>
              )}
              <Input
                label="Correo electrónico"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                icon={<Mail className="h-4 w-4" />}
              />
              <div className="relative">
                <Input
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  icon={<Lock className="h-4 w-4" />}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-[38px] text-slate-400 hover:text-slate-600 dark:hover:text-ink-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="label-base">Rol</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="input-base">
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              )}

              {mode === 'login' && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500/40"
                    />
                    <span className="text-sm text-slate-600 dark:text-ink-300">Recordar usuario</span>
                  </label>
                  <button type="button" onClick={() => setForgotOpen(true)} className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full" size="lg">
                {mode === 'login' ? 'Ingresar' : 'Crear Cuenta'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500 dark:text-ink-400">
              {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <button
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="font-semibold text-brand-600 dark:text-brand-400 hover:underline"
              >
                {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </p>
          </div>
        </div>

        {forgotOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => setForgotOpen(false)} />
            <div className="relative card p-6 max-w-md w-full animate-scale-in">
              <h3 className="font-display font-bold text-lg text-ink-900 dark:text-white">Recuperar contraseña</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-ink-400">
                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <Input label="Correo" type="email" placeholder="tu@empresa.com" icon={<Mail className="h-4 w-4" />} className="mt-4" />
              <div className="mt-5 flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setForgotOpen(false)}>Cancelar</Button>
                <Button onClick={() => { showToast('Enlace de recuperación enviado', 'success'); setForgotOpen(false); }}>Enviar enlace</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
