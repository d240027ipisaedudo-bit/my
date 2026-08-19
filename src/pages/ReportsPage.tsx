import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { BarChart, DonutChart, LineChart } from '@/components/ui/Charts';
import { useToast } from '@/context/ToastContext';
import { exportToCsv, exportToExcel, exportToPdf } from '@/utils/export';
import { formatCurrency, formatDate, fullName, formatMonthYear } from '@/utils/format';
import type { Employee, Department, PayrollPeriod, PayrollItem } from '@/types';
import { FileText, FileSpreadsheet, FileType, Users, DollarSign, Clock, TrendingUp, Download } from 'lucide-react';

type ReportType = 'employees' | 'payroll' | 'attendance' | 'departments';

export function ReportsPage() {
  const { showToast } = useToast();
  const [reportType, setReportType] = useState<ReportType>('employees');
  const [employees, setEmployees] = useState<(Employee & { departments: { name: string } | null; positions: { name: string } | null })[]>([]);
  const [payrollItems, setPayrollItems] = useState<(PayrollItem & { employees: { first_name: string; last_name: string; code: string }; payroll_periods: { name: string } })[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [loading, setLoading] = useState(true);
  const [deptStats, setDeptStats] = useState<{ label: string; value: number }[]>([]);
  const [payrollByMonth, setPayrollByMonth] = useState<{ label: string; value: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    if (reportType === 'employees') {
      const { data } = await supabase.from('employees').select('*, departments(name), positions(name)').order('first_name');
      setEmployees((data ?? []) as (Employee & { departments: { name: string } | null; positions: { name: string } | null })[]);
    } else if (reportType === 'payroll') {
      let q = supabase.from('payroll_items').select('*, employees(first_name, last_name, code), payroll_periods(name)').order('generated_at', { ascending: false });
      if (selectedPeriod) q = q.eq('period_id', selectedPeriod);
      const { data } = await q.limit(200);
      setPayrollItems((data ?? []) as (PayrollItem & { employees: { first_name: string; last_name: string; code: string }; payroll_periods: { name: string } })[]);
    } else if (reportType === 'departments') {
      const { data: depts } = await supabase.from('departments').select('*').order('name');
      setDepartments(depts ?? []);
      const { data: emps } = await supabase.from('employees').select('department_id, status, departments(name)');
      const stats: Record<string, number> = {};
      (emps ?? []).forEach((r) => {
        const dept = r.departments as unknown as { name: string } | null;
        const name = dept?.name ?? 'Sin departamento';
        stats[name] = (stats[name] ?? 0) + 1;
      });
      setDeptStats(Object.entries(stats).map(([label, value]) => ({ label, value })));
    }
    setLoading(false);
  }, [reportType, selectedPeriod]);

  useEffect(() => {
    supabase.from('payroll_periods').select('*').order('start_date', { ascending: false }).then(({ data }) => setPeriods(data ?? []));
  }, []);

  useEffect(() => {
    supabase.from('payroll_periods').select('name, total_net, start_date').order('start_date', { ascending: true }).limit(6).then(({ data }) => {
      setPayrollByMonth((data ?? []).map((p: { name: string; total_net: number; start_date: string }) => ({ label: formatMonthYear(p.start_date).split(' ')[0].slice(0, 3), value: p.total_net })));
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleExport(format: 'pdf' | 'excel' | 'csv') {
    let headers: string[] = [];
    let rows: Record<string, string | number | boolean | null>[] = [];
    let title = '';
    let subtitle = '';

    if (reportType === 'employees') {
      title = 'Reporte de Empleados';
      subtitle = `${employees.length} empleados registrados`;
      headers = ['Código', 'Nombre', 'Departamento', 'Puesto', 'Estado', 'Correo', 'Teléfono', 'Ingreso'];
      rows = employees.map((e) => ({
        Código: e.code, Nombre: fullName(e.first_name, e.last_name),
        Departamento: e.departments?.name ?? '—', Puesto: e.positions?.name ?? '—',
        Estado: e.status, Correo: e.email ?? '—', Teléfono: e.phone ?? '—', Ingreso: formatDate(e.hire_date),
      }));
    } else if (reportType === 'payroll') {
      title = 'Reporte de Nómina';
      subtitle = periods.find((p) => p.id === selectedPeriod)?.name ?? 'Todos los períodos';
      headers = ['Empleado', 'Código', 'Período', 'Base', 'Extras', 'Bonif.', 'Bruto', 'AFP', 'SFS', 'ISR', 'Deducciones', 'Neto'];
      rows = payrollItems.map((i) => ({
        Empleado: fullName(i.employees.first_name, i.employees.last_name),
        'Código': i.employees.code,
        'Período': i.payroll_periods.name,
        Base: i.base_salary, Extras: i.overtime_pay, 'Bonif.': i.bonuses,
        Bruto: i.gross_salary, AFP: i.afp, SFS: i.sfs, ISR: i.income_tax,
        Deducciones: i.total_deductions, Neto: i.net_salary,
      }));
    } else if (reportType === 'departments') {
      title = 'Reporte por Departamento';
      subtitle = `${deptStats.length} departamentos`;
      headers = ['Departamento', 'Empleados'];
      rows = deptStats.map((d) => ({ Departamento: d.label, Empleados: d.value }));
    } else if (reportType === 'attendance') {
      title = 'Reporte de Asistencia';
      subtitle = 'Resumen mensual';
      headers = ['Métrica', 'Valor'];
      rows = [{ 'Métrica': 'Total registros', Valor: payrollItems.length }];
    }

    const filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
    if (format === 'csv') exportToCsv(`${filename}.csv`, headers, rows);
    else if (format === 'excel') exportToExcel(`${filename}.xls`, headers, rows);
    else exportToPdf(title, subtitle, headers, rows, {
      summary: reportType === 'payroll' ? [
        { label: 'Total Bruto', value: formatCurrency(payrollItems.reduce((s, i) => s + i.gross_salary, 0)) },
        { label: 'Total Neto', value: formatCurrency(payrollItems.reduce((s, i) => s + i.net_salary, 0)) },
        { label: 'Empleados', value: String(payrollItems.length) },
      ] : reportType === 'employees' ? [
        { label: 'Total', value: String(employees.length) },
        { label: 'Activos', value: String(employees.filter((e) => e.status === 'active').length) },
      ] : undefined,
    });
    showToast(`Exportado a ${format.toUpperCase()}`, 'success');
  }

  const reportTypes = [
    { id: 'employees' as ReportType, label: 'Empleados', icon: <Users className="h-5 w-5" />, desc: 'Listado completo de empleados' },
    { id: 'payroll' as ReportType, label: 'Nómina', icon: <DollarSign className="h-5 w-5" />, desc: 'Detalle de pagos por período' },
    { id: 'departments' as ReportType, label: 'Departamentos', icon: <TrendingUp className="h-5 w-5" />, desc: 'Distribución por área' },
    { id: 'attendance' as ReportType, label: 'Asistencia', icon: <Clock className="h-5 w-5" />, desc: 'Resumen de asistencia' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Reportes y Estadísticas</h1>
        <p className="text-sm text-slate-500 dark:text-ink-400 mt-1">Genera y exporta reportes en PDF, Excel y CSV</p>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {reportTypes.map((rt) => (
          <button
            key={rt.id}
            onClick={() => setReportType(rt.id)}
            className={`card p-5 text-left transition-all duration-200 ${
              reportType === rt.id ? 'ring-2 ring-brand-500 border-brand-300 dark:border-brand-700' : 'hover:shadow-md'
            }`}
          >
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${
              reportType === rt.id ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-500 dark:text-ink-400'
            }`}>{rt.icon}</div>
            <h3 className="font-display font-bold text-ink-900 dark:text-white">{rt.label}</h3>
            <p className="text-xs text-slate-400 dark:text-ink-500 mt-1">{rt.desc}</p>
          </button>
        ))}
      </div>

      {/* Charts */}
      {reportType === 'departments' && deptStats.length > 0 && (
        <Card padding="md">
          <h3 className="font-display font-bold text-ink-900 dark:text-white mb-4">Distribución de Empleados</h3>
          <div className="grid lg:grid-cols-2 gap-6">
            <BarChart data={deptStats.map((d, i) => ({ label: d.label, value: d.value, color: ['#f97316', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][i % 6] }))} formatValue={(v) => `${v} empleados`} />
            <DonutChart data={deptStats.map((d, i) => ({ label: d.label, value: d.value, color: ['#f97316', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][i % 6] }))} formatValue={(v) => String(v)} />
          </div>
        </Card>
      )}

      {reportType === 'payroll' && payrollByMonth.length > 0 && (
        <Card padding="md">
          <h3 className="font-display font-bold text-ink-900 dark:text-white mb-4">Tendencia de Nómina</h3>
          <LineChart data={payrollByMonth} formatValue={(v) => formatCurrency(v)} />
        </Card>
      )}

      {/* Export buttons */}
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-bold text-ink-900 dark:text-white">Exportar Reporte</h3>
            <p className="text-sm text-slate-500 dark:text-ink-400 mt-1">Descarga el reporte actual en el formato que prefieras</p>
          </div>
          {reportType === 'payroll' && (
            <div className="w-56">
              <Select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} placeholder="Todos los períodos" options={periods.map((p) => ({ value: p.id, label: p.name }))} />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('pdf')}><FileType className="h-4 w-4" /> PDF</Button>
            <Button variant="outline" onClick={() => handleExport('excel')}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            <Button variant="outline" onClick={() => handleExport('csv')}><Download className="h-4 w-4" /> CSV</Button>
          </div>
        </div>
      </Card>

      {/* Summary cards */}
      {reportType === 'employees' && !loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: employees.length, color: 'text-ink-900 dark:text-white' },
            { label: 'Activos', value: employees.filter((e) => e.status === 'active').length, color: 'text-emerald-600' },
            { label: 'Inactivos', value: employees.filter((e) => e.status !== 'active').length, color: 'text-amber-600' },
            { label: 'Departamentos', value: new Set(employees.map((e) => e.departments?.name).filter(Boolean)).size, color: 'text-sky-600' },
          ].map((s, i) => (
            <Card key={i} padding="md">
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className={`text-2xl font-bold font-display mt-1 ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {reportType === 'payroll' && !loading && payrollItems.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card padding="md"><p className="text-xs text-slate-400">Total Bruto</p><p className="text-xl font-bold text-ink-900 dark:text-white mt-1">{formatCurrency(payrollItems.reduce((s, i) => s + i.gross_salary, 0))}</p></Card>
          <Card padding="md"><p className="text-xs text-slate-400">Total Deducciones</p><p className="text-xl font-bold text-rose-600 mt-1">{formatCurrency(payrollItems.reduce((s, i) => s + i.total_deductions, 0))}</p></Card>
          <Card padding="md"><p className="text-xs text-slate-400">Total Neto</p><p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(payrollItems.reduce((s, i) => s + i.net_salary, 0))}</p></Card>
        </div>
      )}
    </div>
  );
}
