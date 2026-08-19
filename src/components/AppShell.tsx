import { type ReactNode, useState } from 'react';
import {
  LayoutDashboard, Users, Clock, DollarSign, BarChart3,
  Settings, Wrench, UserCircle, LogOut, Menu, X, Moon, Sun,
  ChevronRight, Bell,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { ROLE_LABELS, type UserRole } from '@/types';
import { getInitials } from '@/utils/format';

export type PageId =
  | 'dashboard' | 'hr' | 'attendance' | 'payroll'
  | 'reports' | 'admin' | 'tools' | 'profile';

interface NavItem {
  id: PageId;
  label: string;
  icon: ReactNode;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'hr', label: 'Recursos Humanos', icon: <Users className="h-5 w-5" /> },
  { id: 'attendance', label: 'Asistencia', icon: <Clock className="h-5 w-5" /> },
  { id: 'payroll', label: 'Nómina', icon: <DollarSign className="h-5 w-5" /> },
  { id: 'reports', label: 'Reportes', icon: <BarChart3 className="h-5 w-5" /> },
  { id: 'admin', label: 'Administración', icon: <Settings className="h-5 w-5" />, roles: ['admin'] },
  { id: 'tools', label: 'Herramientas', icon: <Wrench className="h-5 w-5" /> },
  { id: 'profile', label: 'Perfil', icon: <UserCircle className="h-5 w-5" /> },
];

const PAGE_TITLES: Record<PageId, string> = {
  dashboard: 'Dashboard',
  hr: 'Recursos Humanos',
  attendance: 'Asistencia',
  payroll: 'Nómina',
  reports: 'Reportes',
  admin: 'Administración',
  tools: 'Herramientas',
  profile: 'Mi Perfil',
};

interface ShellProps {
  current: PageId;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}

export function AppShell({ current, onNavigate, children }: ShellProps) {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role ?? 'employee';
  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  function handleSignOut() {
    signOut();
    showToast('Sesión cerrada correctamente', 'info');
  }

  const NavList = () => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {visibleItems.map((item) => {
        const active = current === item.id;
        return (
          <button
            key={item.id}
            onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
              active
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                : 'text-ink-300 hover:bg-ink-800 hover:text-white'
            }`}
          >
            <span className={`transition-transform duration-200 ${active ? '' : 'group-hover:scale-110'}`}>{item.icon}</span>
            <span>{item.label}</span>
            {active && <ChevronRight className="h-4 w-4 ml-auto" />}
          </button>
        );
      })}
    </nav>
  );

  const Sidebar = () => (
    <aside className="bg-ink-900 flex flex-col h-full w-[260px] flex-shrink-0">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-ink-800">
        <div className="h-10 w-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
          <DollarSign className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-display font-bold text-white text-lg leading-none">NovaNómina</h1>
          <p className="text-[11px] text-ink-400 mt-1">Sistema de Nómina</p>
        </div>
      </div>
      <NavList />
      <div className="px-3 py-4 border-t border-ink-800">
        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-ink-800/50">
          <div className="h-9 w-9 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-400 font-semibold text-sm flex-shrink-0">
            {user ? getInitials(user.full_name.split(' ')[0] ?? 'U', user.full_name.split(' ')[1] ?? '') : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{user?.full_name ?? 'Usuario'}</p>
            <p className="text-[11px] text-ink-400 truncate">{ROLE_LABELS[role]}</p>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-ink-950">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full animate-slide-in-right">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-5 lg:px-8 bg-brand-500 text-white flex-shrink-0 shadow-md shadow-brand-500/10">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <h2 className="font-display font-bold text-lg leading-none">{PAGE_TITLES[current]}</h2>
              <p className="text-[11px] text-white/80 mt-1 hidden sm:block">
                {new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="relative p-2.5 rounded-xl hover:bg-white/10 transition">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-white rounded-full ring-2 ring-brand-500" />
            </button>
            <button onClick={toggleTheme} className="p-2.5 rounded-xl hover:bg-white/10 transition" title="Cambiar tema">
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <div className="hidden sm:block w-px h-6 bg-white/20 mx-1" />
            <button onClick={handleSignOut} className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-white/10 transition" title="Cerrar sesión">
              <LogOut className="h-5 w-5" />
              <span className="hidden md:inline text-sm font-medium">Salir</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div key={current} className="page-enter p-5 lg:p-8 max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
