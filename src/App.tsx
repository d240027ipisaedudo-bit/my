import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { AppShell, type PageId } from '@/components/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { HRPage } from '@/pages/HRPage';
import { AttendancePage } from '@/pages/AttendancePage';
import { PayrollPage } from '@/pages/PayrollPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AdminPage } from '@/pages/AdminPage';
import { ToolsPage } from '@/pages/ToolsPage';
import { ProfilePage } from '@/pages/ProfilePage';

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<PageId>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-ink-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <svg className="h-6 w-6 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">Cargando NovaNómina...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  // Restrict admin page to admins
  const effectivePage = page === 'admin' && user.role !== 'admin' ? 'dashboard' : page;

  return (
    <AppShell current={effectivePage} onNavigate={setPage}>
      {effectivePage === 'dashboard' && <DashboardPage onNavigate={setPage} />}
      {effectivePage === 'hr' && <HRPage />}
      {effectivePage === 'attendance' && <AttendancePage />}
      {effectivePage === 'payroll' && <PayrollPage />}
      {effectivePage === 'reports' && <ReportsPage />}
      {effectivePage === 'admin' && <AdminPage />}
      {effectivePage === 'tools' && <ToolsPage />}
      {effectivePage === 'profile' && <ProfilePage />}
    </AppShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
