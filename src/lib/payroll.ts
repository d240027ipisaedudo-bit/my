import { supabase } from '@/lib/supabase';
import type { PayrollConfig, PayrollItem, PayslipComponent, Attendance } from '@/types';

export async function loadPayrollConfig(): Promise<PayrollConfig> {
  const { data } = await supabase
    .from('system_config')
    .select('key, value')
    .in('key', [
      'afp_rate',
      'sfs_rate',
      'isr_enabled',
      'overtime_multiplier',
      'work_hours_per_day',
      'work_days_per_month',
      'min_salary',
    ]);

  const cfg: Record<string, string> = {};
  (data ?? []).forEach((row: { key: string; value: string }) => {
    cfg[row.key] = row.value;
  });

  return {
    afp_rate: parseFloat(cfg.afp_rate ?? '0.0287'),
    sfs_rate: parseFloat(cfg.sfs_rate ?? '0.0304'),
    isr_enabled: cfg.isr_enabled === 'true',
    overtime_multiplier: parseFloat(cfg.overtime_multiplier ?? '1.5'),
    work_hours_per_day: parseFloat(cfg.work_hours_per_day ?? '8'),
    work_days_per_month: parseFloat(cfg.work_days_per_month ?? '23.83'),
    min_salary: parseFloat(cfg.min_salary ?? '23880'),
  };
}

/**
 * ISR scale for the Dominican Republic (2024, monthly).
 * Returns the tax for a given monthly taxable base (gross - AFP - SFS).
 */
export function calculateISR(taxableBase: number): number {
  if (taxableBase <= 416220) return 0;
  if (taxableBase <= 624329) return (taxableBase - 416220) * 0.15;
  if (taxableBase <= 867123) return 31216.35 + (taxableBase - 624329) * 0.20;
  return 79776.07 + (taxableBase - 867123) * 0.25;
}

export interface PayrollInput {
  baseSalary: number;
  overtimeHours: number;
  bonuses: number;
  otherDeductions: number;
  loanPayment: number;
  advancePayment: number;
  config: PayrollConfig;
}

export interface PayrollResult {
  base_salary: number;
  overtime_pay: number;
  bonuses: number;
  gross_salary: number;
  afp: number;
  sfs: number;
  income_tax: number;
  loan_payment: number;
  advance_payment: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  components: Omit<PayslipComponent, 'id' | 'payroll_item_id'>[];
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const { baseSalary, overtimeHours, bonuses, otherDeductions, loanPayment, advancePayment, config } = input;
  const hourlyRate = baseSalary / (config.work_days_per_month * config.work_hours_per_day);
  const overtimePay = overtimeHours * hourlyRate * config.overtime_multiplier;

  const grossSalary = baseSalary + overtimePay + bonuses;
  const afp = grossSalary * config.afp_rate;
  const sfs = grossSalary * config.sfs_rate;
  const taxableBase = grossSalary - afp - sfs;
  const incomeTax = config.isr_enabled ? calculateISR(taxableBase) : 0;

  const totalDeductions = afp + sfs + incomeTax + loanPayment + advancePayment + otherDeductions;
  const netSalary = grossSalary - totalDeductions;

  const components: Omit<PayslipComponent, 'id' | 'payroll_item_id'>[] = [
    { name: 'Salario Base', component_type: 'earning' as const, amount: baseSalary, is_fixed: true, sort_order: 1 },
    { name: 'Horas Extras', component_type: 'earning' as const, amount: overtimePay, is_fixed: false, sort_order: 2 },
    { name: 'Bonificaciones', component_type: 'earning' as const, amount: bonuses, is_fixed: false, sort_order: 3 },
    { name: 'AFP (2.87%)', component_type: 'deduction' as const, amount: afp, is_fixed: true, sort_order: 4 },
    { name: 'SFS (3.04%)', component_type: 'deduction' as const, amount: sfs, is_fixed: true, sort_order: 5 },
    { name: 'Impuesto Sobre la Renta', component_type: 'deduction' as const, amount: incomeTax, is_fixed: false, sort_order: 6 },
    { name: 'Cuota de Préstamo', component_type: 'deduction' as const, amount: loanPayment, is_fixed: false, sort_order: 7 },
    { name: 'Anticipo', component_type: 'deduction' as const, amount: advancePayment, is_fixed: false, sort_order: 8 },
    { name: 'Otros Descuentos', component_type: 'deduction' as const, amount: otherDeductions, is_fixed: false, sort_order: 9 },
  ].filter((c) => c.amount > 0);

  return {
    base_salary: baseSalary,
    overtime_pay: overtimePay,
    bonuses,
    gross_salary: grossSalary,
    afp,
    sfs,
    income_tax: incomeTax,
    loan_payment: loanPayment,
    advance_payment: advancePayment,
    other_deductions: otherDeductions,
    total_deductions: totalDeductions,
    net_salary: netSalary,
    components,
  };
}

export async function getMonthlyOvertime(employeeId: string, startDate: string, endDate: string): Promise<number> {
  const { data, error } = await supabase
    .from('attendance')
    .select('hours')
    .eq('employee_id', employeeId)
    .eq('record_type', 'overtime')
    .eq('approved', true)
    .gte('record_date', startDate)
    .lte('record_date', endDate);
  if (error) return 0;
  return (data ?? []).reduce((sum, r) => sum + (r.hours ?? 0), 0);
}

export async function getPendingAdvanceForEmployee(employeeId: string): Promise<number> {
  const { data, error } = await supabase
    .from('advances')
    .select('amount')
    .eq('employee_id', employeeId)
    .eq('status', 'approved');
  if (error) return 0;
  return (data ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0);
}

export async function getActiveLoanForEmployee(employeeId: string): Promise<{ id: string; balance: number; installments: number; paidInstallments: number } | null> {
  const { data, error } = await supabase
    .from('loans')
    .select('id, balance, installments, paid_installments')
    .eq('employee_id', employeeId)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    balance: data.balance,
    installments: data.installments,
    paidInstallments: data.paid_installments,
  };
}

export function buildPayrollItem(
  periodId: string,
  employeeId: string,
  result: PayrollResult,
  status: PayrollItem['status'] = 'calculated'
): Omit<PayrollItem, 'id'> {
  return {
    period_id: periodId,
    employee_id: employeeId,
    base_salary: result.base_salary,
    overtime_pay: result.overtime_pay,
    bonuses: result.bonuses,
    gross_salary: result.gross_salary,
    afp: result.afp,
    sfs: result.sfs,
    income_tax: result.income_tax,
    loan_payment: result.loan_payment,
    advance_payment: result.advance_payment,
    other_deductions: result.other_deductions,
    total_deductions: result.total_deductions,
    net_salary: result.net_salary,
    status,
    generated_at: new Date().toISOString(),
  };
}

export async function fetchAttendanceForMonth(employeeId: string, startDate: string, endDate: string): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('record_date', startDate)
    .lte('record_date', endDate)
    .order('record_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
