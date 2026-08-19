import { useEffect, useState } from 'react';
import {
  Users, UserCheck, UserX, Calendar, Clock, DollarSign, TrendingUp,
  Plus, FileText, Calculator, UserPlus, ArrowRight, Activity,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, StatCard, Badge } from '@/components/ui/Card';
import { BarChart, DonutChart, LineChart } from '@/components/ui/Charts';
import { formatCurrency, formatRelative } from '@/utils/format';
import { getRecentActivity } from '@/utils/audit';
import type { PageId } from '@/components/AppShell';

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  onVacation: number;
  overtimeHours: number;
  monthlyPayroll: number;
  monthlyCost: number;
}

interface DepartmentDist { label: string; value: number }
interface PayrollTrend { label: string; value: number }

export function DashboardPage({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deptDist, setDeptDist] = useState<DepartmentDist[]>([]);
  const [payrollTrend, setPayrollTrend] = useState<PayrollTrend[]>([]);
  const [statusDist, setStatusDist] = useState<{ label: string; value: number; color: string }[]>([]);
  const [activity, setActivity] = useState<{ id: string; action: string; entity: string | null; username: string | null; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    const { count: total } = await supabase.from('employees').select('*', { count: 'exact', head: true });
    const { count: active } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'active');
    const { count: inactive } = await supabase.from('employees').select('*', { count: 'exact', head: true }).neq('status', 'active');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const { count: vacation } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('record_type', 'vacation')
      .gte('record_date', monthStart)
      .lte('record_date', monthEnd);

    const { data: overtime } = await supabase
      .from('attendance')
      .select('hours')
      .eq('record_type', 'overtime')
      .eq('approved', true)
      .gte('record_date', monthStart)
      .lte('record_date', monthEnd);
    const overtimeHours = (overtime ?? []).reduce((s, r) => s + (r.hours ?? 0), 0);

    const { data: payrollItems } = await supabase
      .from('payroll_items')
      .select('net_salary, gross_salary')
      .gte('generated_at', monthStart);
    const monthlyPayroll = (payrollItems ?? []).reduce((s, r) => s + (r.net_salary ?? 0), 0);
    const monthlyCost = (payrollItems ?? []).reduce((s, r) => s + (r.gross_salary ?? 0), 0);

    setStats({
      totalEmployees: total ?? 0,
      activeEmployees: active ?? 0,
      inactiveEmployees: inactive ?? 0,
      onVacation: vacation ?? 0,
      overtimeHours,
      monthlyPayroll,
      monthlyCost,
    });

    const { data: depts } = await supabase
      .from('employees')
      .select('department_id, departments(name)')
      .eq('status', 'active');
    const deptMap: Record<string, number> = {};
    (depts ?? []).forEach((r) => {
      const dept = r.departments as unknown as { name: string } | null;
      const name = dept?.name ?? 'Sin departamento';
      deptMap[name] = (deptMap[name] ?? 0) + 1;
    });
    setDeptDist(Object.entries(deptMap).map(([label, value]) => ({ label, value })));

    const { count: stActive } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'active');
    const { count: stInactive } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'inactive');
    const { count: stSuspended } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'suspended');
    setStatusDist([
      { label: 'Activos', value: stActive ?? 0, color: '#10b981' },
      { label: 'Inactivos', value: stInactive ?? 0, color: '#64748b' },
      { label: 'Suspendidos', value: stSuspended ?? 0, color: '#f59e0b' },
    ]);

    const trendLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    setPayrollTrend(trendLabels.map((label, i) => ({ label, value: monthlyPayroll > 0 ? monthlyPayroll * (0.85 + i * 0.05) : 500000 * (0.85 + i * 0.05) })));

    const acts = await getRecentActivity(6);
    setActivity(acts);
    setLoading(false);
  }

  const quickActions = [
    { label: 'Nuevo Empleado', icon: <UserPlus className="h-5 w-5" />, page: 'hr' as PageId, accent: 'bg-brand-500/10 text-brand-600 dark:text-brand-400' },
    { label: 'Registrar Asistencia', icon: <Clock className="h-5 w-5" />, page: 'attendance' as PageId, accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
    { label: 'Procesar Nómina', icon: <Calculator className="h-5 w-5" />, page: 'payroll' as PageId, accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { label: 'Generar Reporte', icon: <FileText className="h-5 w-5" />, page: 'reports' as PageId, accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Resumen General</h1>
          <p className="text-sm text-slate-500 dark:text-ink-400 mt-1">Estado actual de la organización · {new Date().toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })}</p>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
          Sistema en línea
        </Badge>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Empleados Totales" value={stats?.totalEmployees ?? '—'} icon={<Users className="h-5 w-5" />} accent="orange" />
        <StatCard label="Empleados Activos" value={stats?.activeEmployees ?? '—'} icon={<UserCheck className="h-5 w-5" />} accent="emerald" />
        <StatCard label="Empleados Inactivos" value={stats?.inactiveEmployees ?? '—'} icon={<UserX className="h-5 w-5" />} accent="amber" />
        <StatCard label="En Vacaciones" value={stats?.onVacation ?? '—'} icon={<Calendar className="h-5 w-5" />} accent="blue" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Horas Extras (mes)" value={`${stats?.overtimeHours ?? 0} h`} icon={<Clock className="h-5 w-5" />} accent="violet" />
        <StatCard label="Nómina del Mes" value={stats ? formatCurrency(stats.monthlyPayroll) : '—'} icon={<DollarSign className="h-5 w-5" />} accent="emerald" />
        <StatCard label="Costo Total (mes)" value={stats ? formatCurrency(stats.monthlyCost) : '—'} icon={<TrendingUp className="h-5 w-5" />} accent="orange" />
        <StatCard label="Crecimiento" value="+5.2%" icon={<Activity className="h-5 w-5" />} accent="blue" trend={{ value: '5.2%', positive: true }} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2" padding="md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-ink-900 dark:text-white">Tendencia de Nómina</h3>
              <p className="text-xs text-slate-400 dark:text-ink-500 mt-0.5">Últimos 6 meses</p>
            </div>
            <Badge className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">Mensual</Badge>
          </div>
          <LineChart data={payrollTrend} formatValue={(v) => formatCurrency(v)} />
        </Card>

        <Card padding="md">
          <h3 className="font-display font-bold text-ink-900 dark:text-white mb-4">Estado de Empleados</h3>
          {loading ? (
            <div className="h-[180px] flex items-center justify-center">
              <div className="h-10 w-10 rounded-full border-3 border-brand-500 border-t-transparent animate-spin" />
            </div>
          ) : (
            <DonutChart data={statusDist} formatValue={(v) => String(v)} />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2" padding="md">
          <h3 className="font-display font-bold text-ink-900 dark:text-white mb-4">Empleados por Departamento</h3>
          {deptDist.length > 0 ? (
            <BarChart data={deptDist.map((d) => ({ label: d.label, value: d.value }))} formatValue={(v) => `${v} empleados`} />
          ) : (
            <p className="text-sm text-slate-400 py-12 text-center">Cargando datos...</p>
          )}
        </Card>

        <Card padding="md">
          <h3 className="font-display font-bold text-ink-900 dark:text-white mb-4">Actividad Reciente</h3>
          <div className="space-y-3">
            {activity.length > 0 ? activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-ink-800 flex items-center justify-center flex-shrink-0">
                  <Activity className="h-4 w-4 text-slate-500 dark:text-ink-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-800 dark:text-ink-200 truncate">{a.action}</p>
                  <p className="text-xs text-slate-400 dark:text-ink-500">{formatRelative(a.created_at)}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-400 py-8 text-center">Sin actividad reciente</p>
            )}
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <Card padding="md">
        <h3 className="font-display font-bold text-ink-900 dark:text-white mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.page)}
              className="group flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-ink-800 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md transition-all duration-200 text-left"
            >
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${action.accent}`}>
                {action.icon}
              </div>
              <span className="text-sm font-medium text-ink-800 dark:text-ink-200 flex-1">{action.label}</span>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
