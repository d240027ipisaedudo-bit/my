export type UserRole = 'admin' | 'hr_manager' | 'payroll_analyst' | 'employee';

export type EmployeeStatus = 'active' | 'inactive' | 'suspended' | 'terminated';
export type ContractType = 'indefinite' | 'fixed_term' | 'probation' | 'consultant' | 'intern';
export type AttendanceType = 'work' | 'permission' | 'leave' | 'vacation' | 'absence' | 'holiday' | 'overtime';
export type PayrollStatus = 'draft' | 'processing' | 'approved' | 'paid' | 'cancelled';
export type PayrollItemStatus = 'calculated' | 'approved' | 'paid' | 'cancelled';
export type LoanStatus = 'active' | 'paid' | 'cancelled';
export type AdvanceStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type ComponentType = 'earning' | 'deduction';

export interface AppUser {
  id: string;
  auth_id: string | null;
  employee_id: string | null;
  username: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  is_active: boolean;
  last_login: string | null;
}

export interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  logo_url: string | null;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Position {
  id: string;
  name: string;
  department_id: string | null;
  base_salary: number;
  description: string | null;
  created_at: string;
}

export interface Contract {
  id: string;
  employee_id: string;
  contract_type: ContractType;
  start_date: string;
  end_date: string | null;
  base_salary: number;
  currency: string;
  work_schedule: string | null;
  notes: string | null;
  status: 'active' | 'expired' | 'terminated';
  created_at: string;
}

export interface Employee {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  gender: 'M' | 'F' | 'O' | null;
  id_document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  hire_date: string;
  termination_date: string | null;
  status: EmployeeStatus;
  department_id: string | null;
  position_id: string | null;
  contract_id: string | null;
  bank_name: string | null;
  bank_account: string | null;
  photo_url: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  name: string;
  doc_type: string;
  file_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface EmployeeHistory {
  id: string;
  employee_id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  record_date: string;
  check_in: string | null;
  check_out: string | null;
  record_type: AttendanceType;
  hours: number;
  notes: string | null;
  approved: boolean;
  created_at: string;
}

export interface PayrollPeriod {
  id: string;
  name: string;
  period_type: 'weekly' | 'biweekly' | 'monthly';
  start_date: string;
  end_date: string;
  pay_date: string;
  status: PayrollStatus;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  created_at: string;
  updated_at: string;
}

export interface PayrollItem {
  id: string;
  period_id: string;
  employee_id: string;
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
  status: PayrollItemStatus;
  generated_at: string;
}

export interface PayslipComponent {
  id: string;
  payroll_item_id: string;
  name: string;
  component_type: ComponentType;
  amount: number;
  is_fixed: boolean;
  sort_order: number;
}

export interface Loan {
  id: string;
  employee_id: string;
  principal: number;
  interest_rate: number;
  installments: number;
  paid_installments: number;
  balance: number;
  status: LoanStatus;
  start_date: string;
  notes: string | null;
  created_at: string;
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  payroll_item_id: string | null;
  created_at: string;
}

export interface Advance {
  id: string;
  employee_id: string;
  amount: number;
  request_date: string;
  reason: string | null;
  status: AdvanceStatus;
  payroll_item_id: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  username: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
  updated_at: string;
}

export interface Backup {
  id: string;
  file_name: string;
  file_size: number;
  backup_type: 'manual' | 'automatic';
  status: 'completed' | 'failed' | 'restored';
  created_by: string | null;
  created_at: string;
}

export interface PayrollConfig {
  afp_rate: number;
  sfs_rate: number;
  isr_enabled: boolean;
  overtime_multiplier: number;
  work_hours_per_day: number;
  work_days_per_month: number;
  min_salary: number;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  hr_manager: 'Gerente de RRHH',
  payroll_analyst: 'Analista de Nómina',
  employee: 'Empleado',
};

export const STATUS_LABELS = {
  active: 'Activo',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
  terminated: 'Desvinculado',
} as const;

export const ATTENDANCE_LABELS: Record<AttendanceType, string> = {
  work: 'Trabajo',
  permission: 'Permiso',
  leave: 'Licencia',
  vacation: 'Vacaciones',
  absence: 'Ausencia',
  holiday: 'Feriado',
  overtime: 'Horas Extras',
};

export const CONTRACT_LABELS: Record<ContractType, string> = {
  indefinite: 'Indefinido',
  fixed_term: 'Tiempo Determinado',
  probation: 'Prueba',
  consultant: 'Consultor',
  intern: 'Pasante',
};

export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  draft: 'Borrador',
  processing: 'Procesando',
  approved: 'Aprobado',
  paid: 'Pagado',
  cancelled: 'Cancelado',
};

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  active: 'Activo',
  paid: 'Pagado',
  cancelled: 'Cancelado',
};

export const ADVANCE_STATUS_LABELS: Record<AdvanceStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  paid: 'Pagado',
};
