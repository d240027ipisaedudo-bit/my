import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Badge, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { logAudit } from '@/utils/audit';
import { formatCurrency, formatDate, formatMonthYear, fullName, classForStatus } from '@/utils/format';
import { exportToPdf, printPayslip } from '@/utils/export';
import {
  PAYROLL_STATUS_LABELS, LOAN_STATUS_LABELS, ADVANCE_STATUS_LABELS,
  type PayrollPeriod, type PayrollItem, type Employee, type Loan, type Advance,
  type LoanStatus, type AdvanceStatus,
} from '@/types';
import {
  loadPayrollConfig, calculatePayroll, buildPayrollItem, getMonthlyOvertime,
  getPendingAdvanceForEmployee, getActiveLoanForEmployee,
} from '@/lib/payroll';
import {
  Plus, Pencil, Trash2, Calculator, Eye, FileText, DollarSign,
  HandCoins, Landmark, CheckCircle2, XCircle, Printer, Calendar,
} from 'lucide-react';

type Tab = 'periods' | 'payslips' | 'loans' | 'advances';

export function PayrollPage() {
  const [tab, setTab] = useState<Tab>('periods');
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-ink-800">
        {([
          { id: 'periods' as Tab, label: 'Períodos', icon: <Calendar className="h-4 w-4" /> },
          { id: 'payslips' as Tab, label: 'Recibos', icon: <FileText className="h-4 w-4" /> },
          { id: 'loans' as Tab, label: 'Préstamos', icon: <Landmark className="h-4 w-4" /> },
          { id: 'advances' as Tab, label: 'Anticipos', icon: <HandCoins className="h-4 w-4" /> },
        ]).map((t) => (
          <button
            key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              tab === t.id ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-ink-800 dark:hover:text-ink-200'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {tab === 'periods' && <PeriodsTab />}
      {tab === 'payslips' && <PayslipsTab />}
      {tab === 'loans' && <LoansTab />}
      {tab === 'advances' && <AdvancesTab />}
    </div>
  );
}

/* ============ PERIODS ============ */

function PeriodsTab() {
  const { showToast } = useToast();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PayrollPeriod | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [detailPeriod, setDetailPeriod] = useState<PayrollPeriod | null>(null);
  const [detailItems, setDetailItems] = useState<(PayrollItem & { employees: { first_name: string; last_name: string; code: string } })[]>([]);

  const [form, setForm] = useState({
    name: '', period_type: 'monthly', start_date: '', end_date: '', pay_date: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('payroll_periods').select('*').order('start_date', { ascending: false });
    if (error) showToast('Error al cargar períodos', 'error');
    setPeriods(data ?? []);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const pay = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    setForm({
      name: formatMonthYear(start),
      period_type: 'monthly',
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      pay_date: pay.toISOString().slice(0, 10),
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.start_date || !form.end_date || !form.pay_date) {
      showToast('Completa todos los campos', 'error'); return;
    }
    setSaving(true);
    const { data, error } = await supabase.from('payroll_periods').insert({
      ...form, status: 'draft',
    }).select().single();
    if (error) { showToast('Error al crear período', 'error'); setSaving(false); return; }
    await logAudit('Crear período de nómina', 'payroll_periods', data.id, { name: form.name });
    showToast('Período creado', 'success');
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleGenerate(period: PayrollPeriod) {
    setGenerating(period.id);
    try {
      const config = await loadPayrollConfig();
      const { data: employees } = await supabase
        .from('employees')
        .select('*, contracts(base_salary)')
        .eq('status', 'active');

      if (!employees || employees.length === 0) {
        showToast('No hay empleados activos', 'warning');
        setGenerating(null);
        return;
      }

      const { error: delError } = await supabase.from('payroll_items').delete().eq('period_id', period.id);
      if (delError) throw delError;

      const items: Omit<PayrollItem, 'id'>[] = [];
      for (const emp of employees) {
        const baseSalary = (emp.contracts as { base_salary: number } | null)?.base_salary ?? 0;
        const overtimeHours = await getMonthlyOvertime(emp.id, period.start_date, period.end_date);
        const advance = await getPendingAdvanceForEmployee(emp.id);
        const loan = await getActiveLoanForEmployee(emp.id);
        const loanPayment = loan ? loan.balance / (loan.installments - loan.paidInstallments) : 0;

        const result = calculatePayroll({
          baseSalary, overtimeHours, bonuses: 0, otherDeductions: 0,
          loanPayment, advancePayment: advance, config,
        });
        items.push(buildPayrollItem(period.id, emp.id, result));
      }

      if (items.length > 0) {
        const { error: insError } = await supabase.from('payroll_items').insert(items);
        if (insError) throw insError;
      }

      const totalGross = items.reduce((s, i) => s + i.gross_salary, 0);
      const totalDeductions = items.reduce((s, i) => s + i.total_deductions, 0);
      const totalNet = items.reduce((s, i) => s + i.net_salary, 0);

      await supabase.from('payroll_periods').update({
        total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet,
        status: 'processing', updated_at: new Date().toISOString(),
      }).eq('id', period.id);

      await logAudit('Generar nómina', 'payroll_periods', period.id, { employees: items.length, total: totalNet });
      showToast(`Nómina generada para ${items.length} empleados`, 'success');
      load();
    } catch {
      showToast('Error al generar nómina', 'error');
    }
    setGenerating(null);
  }

  async function handleApprove(period: PayrollPeriod) {
    const { error } = await supabase.from('payroll_periods').update({ status: 'approved' }).eq('id', period.id);
    if (error) { showToast('Error al aprobar', 'error'); return; }
    await supabase.from('payroll_items').update({ status: 'approved' }).eq('period_id', period.id);
    await logAudit('Aprobar nómina', 'payroll_periods', period.id);
    showToast('Nómina aprobada', 'success');
    load();
  }

  async function handlePay(period: PayrollPeriod) {
    const { error } = await supabase.from('payroll_periods').update({ status: 'paid' }).eq('id', period.id);
    if (error) { showToast('Error al marcar como pagado', 'error'); return; }
    await supabase.from('payroll_items').update({ status: 'paid' }).eq('period_id', period.id);
    await logAudit('Pagar nómina', 'payroll_periods', period.id);
    showToast('Nómina marcada como pagada', 'success');
    load();
  }

  async function openDetail(period: PayrollPeriod) {
    const { data } = await supabase
      .from('payroll_items')
      .select('*, employees(first_name, last_name, code)')
      .eq('period_id', period.id)
      .order('net_salary', { ascending: false });
    setDetailItems((data ?? []) as (PayrollItem & { employees: { first_name: string; last_name: string; code: string } })[]);
    setDetailPeriod(period);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('payroll_periods').delete().eq('id', deleteTarget.id);
    if (error) { showToast('Error al eliminar', 'error'); return; }
    await logAudit('Eliminar período', 'payroll_periods', deleteTarget.id);
    showToast('Período eliminado', 'success');
    setDeleteTarget(null);
    load();
  }

  const columns: Column<PayrollPeriod>[] = [
    { key: 'name', header: 'Período', sortable: true, render: (r) => <span className="font-medium text-ink-900 dark:text-white">{r.name}</span> },
    { key: 'start_date', header: 'Inicio', sortable: true, render: (r) => formatDate(r.start_date) },
    { key: 'end_date', header: 'Fin', render: (r) => formatDate(r.end_date) },
    { key: 'pay_date', header: 'Pago', render: (r) => formatDate(r.pay_date) },
    { key: 'total_gross', header: 'Bruto', sortable: true, render: (r) => formatCurrency(r.total_gross) },
    { key: 'total_net', header: 'Neto', sortable: true, render: (r) => <span className="font-semibold">{formatCurrency(r.total_net)}</span> },
    { key: 'status', header: 'Estado', sortable: true, render: (r) => <Badge className={classForStatus(r.status)}>{PAYROLL_STATUS_LABELS[r.status]}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-ink-400">{periods.length} períodos</p>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo Período</Button>
      </div>

      <DataTable
        columns={columns}
        data={periods}
        loading={loading}
        searchKeys={['name']}
        searchPlaceholder="Buscar período..."
        rowKey={(r) => r.id}
        actions={(row) => (
          <div className="flex items-center gap-1">
            {row.status === 'draft' && (
              <button onClick={() => handleGenerate(row)} disabled={generating === row.id} className="p-2 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition disabled:opacity-50" title="Generar">
                {generating === row.id ? <span className="block h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" /> : <Calculator className="h-4 w-4" />}
              </button>
            )}
            {row.status === 'processing' && (
              <button onClick={() => handleApprove(row)} className="p-2 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition" title="Aprobar"><CheckCircle2 className="h-4 w-4" /></button>
            )}
            {row.status === 'approved' && (
              <button onClick={() => handlePay(row)} className="p-2 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition" title="Marcar pagado"><DollarSign className="h-4 w-4" /></button>
            )}
            <button onClick={() => openDetail(row)} className="p-2 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition" title="Ver detalle"><Eye className="h-4 w-4" /></button>
            {row.status === 'draft' && (
              <button onClick={() => setDeleteTarget(row)} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
        )}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo Período de Nómina" size="md"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={handleSave} loading={saving}>Crear</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Input label="Nombre" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <Select label="Tipo" value={form.period_type} onChange={(e) => setForm({ ...form, period_type: e.target.value })} options={[{ value: 'weekly', label: 'Semanal' }, { value: 'biweekly', label: 'Quincenal' }, { value: 'monthly', label: 'Mensual' }]} />
          <div />
          <Input label="Fecha inicio" type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <Input label="Fecha fin" type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          <div className="col-span-2"><Input label="Fecha de pago" type="date" required value={form.pay_date} onChange={(e) => setForm({ ...form, pay_date: e.target.value })} /></div>
        </div>
      </Modal>

      <Modal open={!!detailPeriod} onClose={() => setDetailPeriod(null)} title={detailPeriod?.name ?? ''} description="Detalle de nómina del período" size="xl">
        {detailPeriod && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4"><p className="text-xs text-slate-400">Total Bruto</p><p className="text-lg font-bold text-ink-900 dark:text-white">{formatCurrency(detailPeriod.total_gross)}</p></div>
              <div className="card p-4"><p className="text-xs text-slate-400">Deducciones</p><p className="text-lg font-bold text-rose-600">{formatCurrency(detailPeriod.total_deductions)}</p></div>
              <div className="card p-4"><p className="text-xs text-slate-400">Total Neto</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(detailPeriod.total_net)}</p></div>
            </div>
            <DataTable
              columns={[
                { key: 'employees', header: 'Empleado', render: (r) => fullName(r.employees.first_name, r.employees.last_name) },
                { key: 'base_salary', header: 'Base', render: (r) => formatCurrency(r.base_salary) },
                { key: 'overtime_pay', header: 'Extras', render: (r) => formatCurrency(r.overtime_pay) },
                { key: 'total_deductions', header: 'Deducciones', render: (r) => <span className="text-rose-600">{formatCurrency(r.total_deductions)}</span> },
                { key: 'net_salary', header: 'Neto', render: (r) => <span className="font-semibold text-emerald-600">{formatCurrency(r.net_salary)}</span> },
              ] as Column<PayrollItem & { employees: { first_name: string; last_name: string; code: string } }>[]}
              data={detailItems}
              pageSize={8}
              searchKeys={[]}
              searchable={false}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Eliminar Período" message={`¿Eliminar el período "${deleteTarget?.name}"?`} />
    </div>
  );
}

/* ============ PAYSLIPS ============ */

function PayslipsTab() {
  const { showToast } = useToast();
  const [items, setItems] = useState<(PayrollItem & { employees: { first_name: string; last_name: string; code: string; id_document: string | null; bank_name: string | null; bank_account: string | null }; payroll_periods: { name: string } })[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [viewing, setViewing] = useState<PayrollItem & { employees: { first_name: string; last_name: string; code: string; id_document: string | null; bank_name: string | null; bank_account: string | null }; payroll_periods: { name: string } } | null>(null);
  const [components, setComponents] = useState<{ name: string; component_type: string; amount: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('payroll_items')
      .select('*, employees(first_name, last_name, code, id_document, bank_name, bank_account), payroll_periods(name)')
      .order('generated_at', { ascending: false });
    if (selectedPeriod) query = query.eq('period_id', selectedPeriod);
    const { data, error } = await query.limit(100);
    if (error) showToast('Error al cargar recibos', 'error');
    setItems((data ?? []) as (PayrollItem & { employees: { first_name: string; last_name: string; code: string; id_document: string | null; bank_name: string | null; bank_account: string | null }; payroll_periods: { name: string } })[]);
    setLoading(false);
  }, [showToast, selectedPeriod]);

  const loadPeriods = useCallback(async () => {
    const { data } = await supabase.from('payroll_periods').select('*').order('start_date', { ascending: false });
    setPeriods(data ?? []);
  }, []);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);
  useEffect(() => { load(); }, [load]);

  async function openView(item: typeof items[number]) {
    setViewing(item);
    const { data } = await supabase.from('payslip_components').select('name, component_type, amount').eq('payroll_item_id', item.id).order('sort_order');
    setComponents((data ?? []) as { name: string; component_type: string; amount: number }[]);
  }

  function handlePrint(item: typeof items[number]) {
    const earnings = components.filter((c) => c.component_type === 'earning');
    const deductions = components.filter((c) => c.component_type === 'deduction');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Recibo de Pago</title>
    <style>
      @page { margin: 1cm; }
      * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
      body { color: #1a1d29; padding: 24px; }
      .header { display: flex; justify-content: space-between; border-bottom: 3px solid #f97316; padding-bottom: 16px; margin-bottom: 20px; }
      .header h1 { font-size: 20px; } .header .sub { color: #6b7280; font-size: 12px; }
      .info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
      .info-item { font-size: 12px; } .info-item span { color: #6b7280; } .info-item strong { display: block; font-size: 14px; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
      th { background: #1a1d29; color: white; padding: 8px; text-align: left; } td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
      .totals { margin-left: auto; width: 300px; } .totals div { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
      .totals .net { border-top: 2px solid #f97316; margin-top: 8px; padding-top: 10px; font-size: 16px; font-weight: bold; }
      .footer { margin-top: 24px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    </style></head><body>
    <div class="header">
      <div><h1>NovaCorp</h1><div class="sub">Recibo de Pago · ${item.payroll_periods.name}</div></div>
      <div class="sub" style="text-align:right">Generado: ${formatDate(new Date(), true)}</div>
    </div>
    <div class="info">
      <div class="info-item"><span>Empleado</span><strong>${fullName(item.employees.first_name, item.employees.last_name)}</strong></div>
      <div class="info-item"><span>Código</span><strong>${item.employees.code}</strong></div>
      <div class="info-item"><span>Cédula</span><strong>${item.employees.id_document ?? '—'}</strong></div>
      <div class="info-item"><span>Cuenta</span><strong>${item.employees.bank_name ?? '—'} ${item.employees.bank_account ?? ''}</strong></div>
    </div>
    <table><thead><tr><th>Devengados</th><th style="text-align:right">Monto</th></tr></thead>
    <tbody>${earnings.map((e) => `<tr><td>${e.name}</td><td style="text-align:right">${formatCurrency(e.amount)}</td></tr>`).join('')}</tbody></table>
    <table><thead><tr><th>Deducciones</th><th style="text-align:right">Monto</th></tr></thead>
    <tbody>${deductions.map((d) => `<tr><td>${d.name}</td><td style="text-align:right">${formatCurrency(d.amount)}</td></tr>`).join('')}</tbody></table>
    <div class="totals">
      <div><span>Salario Bruto</span><strong>${formatCurrency(item.gross_salary)}</strong></div>
      <div><span>Total Deducciones</span><strong>-${formatCurrency(item.total_deductions)}</strong></div>
      <div class="net"><span>Salario Neto</span><strong>${formatCurrency(item.net_salary)}</strong></div>
    </div>
    <div class="footer">Este documento es generado automáticamente por NovaNómina · NovaCorp SRL</div>
    <script>setTimeout(() => window.print(), 300);</script>
    </body></html>`;
    printPayslip(html);
  }

  function handleExport() {
    if (items.length === 0) { showToast('No hay recibos para exportar', 'warning'); return; }
    exportToPdf(
      'Recibos de Pago',
      periods.find((p) => p.id === selectedPeriod)?.name ?? 'Todos los períodos',
      ['Empleado', 'Código', 'Período', 'Salario Base', 'Horas Extras', 'Bruto', 'Deducciones', 'Neto'],
      items.map((i) => ({
        Empleado: fullName(i.employees.first_name, i.employees.last_name),
        Código: i.employees.code,
        Período: i.payroll_periods.name,
        'Salario Base': i.base_salary,
        'Horas Extras': i.overtime_pay,
        Bruto: i.gross_salary,
        Deducciones: i.total_deductions,
        Neto: i.net_salary,
      })),
      { summary: [
        { label: 'Total Bruto', value: formatCurrency(items.reduce((s, i) => s + i.gross_salary, 0)) },
        { label: 'Total Neto', value: formatCurrency(items.reduce((s, i) => s + i.net_salary, 0)) },
        { label: 'Empleados', value: String(items.length) },
      ]}
    );
    showToast('PDF exportado', 'success');
  }

  const columns: Column<typeof items[number]>[] = [
    { key: 'employees', header: 'Empleado', sortable: true, render: (r) => <span className="font-medium text-ink-900 dark:text-white">{fullName(r.employees.first_name, r.employees.last_name)}</span> },
    { key: 'payroll_periods', header: 'Período', render: (r) => r.payroll_periods.name },
    { key: 'base_salary', header: 'Base', sortable: true, render: (r) => formatCurrency(r.base_salary) },
    { key: 'gross_salary', header: 'Bruto', sortable: true, render: (r) => formatCurrency(r.gross_salary) },
    { key: 'total_deductions', header: 'Deducciones', render: (r) => <span className="text-rose-600">{formatCurrency(r.total_deductions)}</span> },
    { key: 'net_salary', header: 'Neto', sortable: true, render: (r) => <span className="font-semibold text-emerald-600">{formatCurrency(r.net_salary)}</span> },
    { key: 'status', header: 'Estado', render: (r) => <Badge className={classForStatus(r.status)}>{r.status === 'calculated' ? 'Calculado' : r.status === 'approved' ? 'Aprobado' : r.status === 'paid' ? 'Pagado' : 'Cancelado'}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-64">
          <Select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} placeholder="Todos los períodos" options={periods.map((p) => ({ value: p.id, label: p.name }))} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><FileText className="h-4 w-4" /> Exportar PDF</Button>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        searchKeys={[]}
        searchable={false}
        rowKey={(r) => r.id}
        actions={(row) => (
          <>
            <button onClick={() => openView(row)} className="p-2 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition" title="Ver"><Eye className="h-4 w-4" /></button>
            <button onClick={() => handlePrint(row)} className="p-2 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition" title="Imprimir"><Printer className="h-4 w-4" /></button>
          </>
        )}
      />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Recibo de Pago" size="lg">
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-ink-800 pb-4">
              <div>
                <h3 className="font-display font-bold text-lg text-ink-900 dark:text-white">{fullName(viewing.employees.first_name, viewing.employees.last_name)}</h3>
                <p className="text-sm text-slate-500">{viewing.employees.code} · {viewing.payroll_periods.name}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handlePrint(viewing)}><Printer className="h-4 w-4" /> Imprimir</Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4">
                <h4 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">Devengados</h4>
                <div className="space-y-2">
                  {components.filter((c) => c.component_type === 'earning').map((c, i) => (
                    <div key={i} className="flex justify-between text-sm"><span className="text-slate-600 dark:text-ink-400">{c.name}</span><span className="font-medium">{formatCurrency(c.amount)}</span></div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-ink-700 text-sm font-bold"><span>Total</span><span className="text-emerald-600">{formatCurrency(viewing.gross_salary)}</span></div>
                </div>
              </div>
              <div className="card p-4">
                <h4 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">Deducciones</h4>
                <div className="space-y-2">
                  {components.filter((c) => c.component_type === 'deduction').map((c, i) => (
                    <div key={i} className="flex justify-between text-sm"><span className="text-slate-600 dark:text-ink-400">{c.name}</span><span className="font-medium text-rose-600">-{formatCurrency(c.amount)}</span></div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-ink-700 text-sm font-bold"><span>Total</span><span className="text-rose-600">-{formatCurrency(viewing.total_deductions)}</span></div>
                </div>
              </div>
            </div>
            <div className="card p-5 bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800">
              <div className="flex justify-between items-center">
                <span className="font-display font-bold text-lg text-ink-900 dark:text-white">Salario Neto a Pagar</span>
                <span className="font-display font-bold text-2xl text-emerald-600">{formatCurrency(viewing.net_salary)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============ LOANS ============ */

function LoansTab() {
  const { showToast } = useToast();
  const [loans, setLoans] = useState<(Loan & { employees: { first_name: string; last_name: string; code: string } })[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Loan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employee_id: '', principal: '', interest_rate: '0', installments: '1', start_date: new Date().toISOString().slice(0, 10), notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('loans').select('*, employees(first_name, last_name, code)').order('created_at', { ascending: false });
    if (error) showToast('Error al cargar préstamos', 'error');
    setLoans((data ?? []) as (Loan & { employees: { first_name: string; last_name: string; code: string } })[]);
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    load();
    supabase.from('employees').select('*').eq('status', 'active').order('first_name').then(({ data }) => setEmployees(data ?? []));
  }, [load]);

  function openCreate() { setEditing(null); setForm({ employee_id: '', principal: '', interest_rate: '0', installments: '1', start_date: new Date().toISOString().slice(0, 10), notes: '' }); setModalOpen(true); }
  function openEdit(l: Loan) { setEditing(l); setForm({ employee_id: l.employee_id, principal: String(l.principal), interest_rate: String(l.interest_rate), installments: String(l.installments), start_date: l.start_date, notes: l.notes ?? '' }); setModalOpen(true); }

  async function handleSave() {
    if (!form.employee_id || !form.principal) { showToast('Completa los campos obligatorios', 'error'); return; }
    setSaving(true);
    const principal = parseFloat(form.principal);
    const installments = parseInt(form.installments) || 1;
    const balance = principal;
    const payload = { employee_id: form.employee_id, principal, interest_rate: parseFloat(form.interest_rate) || 0, installments, balance, start_date: form.start_date, notes: form.notes || null, status: 'active' as LoanStatus };
    if (editing) {
      const { error } = await supabase.from('loans').update(payload).eq('id', editing.id);
      if (error) { showToast('Error al actualizar', 'error'); setSaving(false); return; }
      await logAudit('Actualizar préstamo', 'loans', editing.id);
      showToast('Préstamo actualizado', 'success');
    } else {
      const { data, error } = await supabase.from('loans').insert(payload).select().single();
      if (error) { showToast('Error al crear', 'error'); setSaving(false); return; }
      await logAudit('Crear préstamo', 'loans', data.id);
      showToast('Préstamo creado', 'success');
    }
    setSaving(false); setModalOpen(false); load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('loans').delete().eq('id', deleteTarget.id);
    if (error) { showToast('Error al eliminar', 'error'); return; }
    await logAudit('Eliminar préstamo', 'loans', deleteTarget.id);
    showToast('Préstamo eliminado', 'success');
    setDeleteTarget(null); load();
  }

  const columns: Column<Loan & { employees: { first_name: string; last_name: string; code: string } }>[] = [
    { key: 'employees', header: 'Empleado', sortable: true, render: (r) => <span className="font-medium text-ink-900 dark:text-white">{fullName(r.employees.first_name, r.employees.last_name)}</span> },
    { key: 'principal', header: 'Principal', sortable: true, render: (r) => formatCurrency(r.principal) },
    { key: 'installments', header: 'Cuotas', render: (r) => `${r.paid_installments}/${r.installments}` },
    { key: 'balance', header: 'Balance', sortable: true, render: (r) => <span className="font-semibold">{formatCurrency(r.balance)}</span> },
    { key: 'interest_rate', header: 'Interés', render: (r) => `${r.interest_rate}%` },
    { key: 'start_date', header: 'Inicio', sortable: true, render: (r) => formatDate(r.start_date) },
    { key: 'status', header: 'Estado', render: (r) => <Badge className={classForStatus(r.status === 'active' ? 'active' : r.status === 'paid' ? 'approved' : 'cancelled')}>{LOAN_STATUS_LABELS[r.status]}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-ink-400">{loans.length} préstamos</p>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo Préstamo</Button>
      </div>
      <DataTable columns={columns} data={loans} loading={loading} searchKeys={[]} searchable={false} rowKey={(r) => r.id}
        actions={(row) => (<>
          <button onClick={() => openEdit(row)} className="p-2 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => setDeleteTarget(row)} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"><Trash2 className="h-4 w-4" /></button>
        </>)}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Préstamo' : 'Nuevo Préstamo'} size="md"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Guardar' : 'Crear'}</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Select label="Empleado" required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="Selecciona..." options={employees.map((e) => ({ value: e.id, label: `${e.code} · ${fullName(e.first_name, e.last_name)}` }))} /></div>
          <Input label="Monto principal" type="number" step="0.01" required value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} />
          <Input label="Tasa de interés (%)" type="number" step="0.01" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} />
          <Input label="Número de cuotas" type="number" value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} />
          <Input label="Fecha de inicio" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <div className="col-span-2"><Textarea label="Notas" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Eliminar Préstamo" message="¿Eliminar este préstamo?" />
    </div>
  );
}

/* ============ ADVANCES ============ */

function AdvancesTab() {
  const { showToast } = useToast();
  const [advances, setAdvances] = useState<(Advance & { employees: { first_name: string; last_name: string; code: string } })[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Advance | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employee_id: '', amount: '', request_date: new Date().toISOString().slice(0, 10), reason: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('advances').select('*, employees(first_name, last_name, code)').order('created_at', { ascending: false });
    if (error) showToast('Error al cargar anticipos', 'error');
    setAdvances((data ?? []) as (Advance & { employees: { first_name: string; last_name: string; code: string } })[]);
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    load();
    supabase.from('employees').select('*').eq('status', 'active').order('first_name').then(({ data }) => setEmployees(data ?? []));
  }, [load]);

  function openCreate() { setForm({ employee_id: '', amount: '', request_date: new Date().toISOString().slice(0, 10), reason: '' }); setModalOpen(true); }

  async function handleSave() {
    if (!form.employee_id || !form.amount) { showToast('Completa los campos obligatorios', 'error'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('advances').insert({
      employee_id: form.employee_id, amount: parseFloat(form.amount), request_date: form.request_date, reason: form.reason || null, status: 'pending' as AdvanceStatus,
    }).select().single();
    if (error) { showToast('Error al crear', 'error'); setSaving(false); return; }
    await logAudit('Crear anticipo', 'advances', data.id);
    showToast('Anticipo creado', 'success');
    setSaving(false); setModalOpen(false); load();
  }

  async function handleStatus(a: Advance, status: AdvanceStatus) {
    const { error } = await supabase.from('advances').update({ status }).eq('id', a.id);
    if (error) { showToast('Error al actualizar', 'error'); return; }
    await logAudit(`Anticipo ${status}`, 'advances', a.id);
    showToast('Estado actualizado', 'success');
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('advances').delete().eq('id', deleteTarget.id);
    if (error) { showToast('Error al eliminar', 'error'); return; }
    await logAudit('Eliminar anticipo', 'advances', deleteTarget.id);
    showToast('Anticipo eliminado', 'success');
    setDeleteTarget(null); load();
  }

  const columns: Column<Advance & { employees: { first_name: string; last_name: string; code: string } }>[] = [
    { key: 'employees', header: 'Empleado', sortable: true, render: (r) => <span className="font-medium text-ink-900 dark:text-white">{fullName(r.employees.first_name, r.employees.last_name)}</span> },
    { key: 'amount', header: 'Monto', sortable: true, render: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span> },
    { key: 'request_date', header: 'Solicitud', sortable: true, render: (r) => formatDate(r.request_date) },
    { key: 'reason', header: 'Motivo', render: (r) => r.reason ?? '—' },
    { key: 'status', header: 'Estado', render: (r) => <Badge className={classForStatus(r.status)}>{ADVANCE_STATUS_LABELS[r.status]}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-ink-400">{advances.length} anticipos</p>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo Anticipo</Button>
      </div>
      <DataTable columns={columns} data={advances} loading={loading} searchKeys={[]} searchable={false} rowKey={(r) => r.id}
        actions={(row) => (
          <div className="flex items-center gap-1">
            {row.status === 'pending' && (<>
              <button onClick={() => handleStatus(row, 'approved')} className="p-2 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition" title="Aprobar"><CheckCircle2 className="h-4 w-4" /></button>
              <button onClick={() => handleStatus(row, 'rejected')} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition" title="Rechazar"><XCircle className="h-4 w-4" /></button>
            </>)}
            <button onClick={() => setDeleteTarget(row)} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo Anticipo" size="md"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={handleSave} loading={saving}>Crear</Button></>}>
        <div className="space-y-4">
          <Select label="Empleado" required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="Selecciona..." options={employees.map((e) => ({ value: e.id, label: `${e.code} · ${fullName(e.first_name, e.last_name)}` }))} />
          <Input label="Monto" type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Input label="Fecha de solicitud" type="date" value={form.request_date} onChange={(e) => setForm({ ...form, request_date: e.target.value })} />
          <Textarea label="Motivo" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Eliminar Anticipo" message="¿Eliminar este anticipo?" />
    </div>
  );
}
