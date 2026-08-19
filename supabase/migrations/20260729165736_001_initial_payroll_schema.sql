/*
# Sistema de Nómina - Initial Schema

1. Overview
   Comprehensive payroll & HR system for a single company. Multi-user with sign-in:
   app users (auth.users) are linked to employee records via profiles. Roles:
   admin, hr_manager, payroll_analyst, employee (read-only for own data).

2. New Tables
   - companies           : company info (single row by convention)
   - departments         : organizational departments
   - positions           : job positions within departments
   - contracts           : employment contracts (salary, type, dates)
   - employees           : core employee records (links to auth user optionally)
   - employee_documents  : document attachments metadata
   - employee_history    : change log per employee
   - attendance          : daily check-in/out, permissions, leave, overtime
   - payroll_periods     : monthly pay periods (open/closed)
   - payroll_items       : per-employee payroll line for a period
   - payslip_components  : earnings/deductions breakdown per payslip
   - loans               : employee loans with installments
   - loan_payments       : scheduled loan installment payments
   - advances           : salary advances
   - users               : app users metadata (role, link to employee)
   - audit_log           : audit trail of user actions
   - system_config       : key/value system settings
   - backups             : backup metadata

3. Security
   - RLS enabled on every table.
   - Owner/role-scoped policies: authenticated users only.
   - admins full access; hr_manager/payroll_analyst scoped by role; employees see own rows.
   - Helper view for role checks via profiles.user_role.

4. Notes
   - All PKs are uuid DEFAULT gen_random_uuid().
   - Timestamps default to now().
   - Monetary values use numeric(12,2).
*/

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  tax_id text,
  address text,
  phone text,
  email text,
  currency text NOT NULL DEFAULT 'DOP',
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- POSITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_date date,
  gender text CHECK (gender IN ('M','F','O')),
  id_document text UNIQUE,
  email text,
  phone text,
  address text,
  hire_date date NOT NULL DEFAULT CURRENT_DATE,
  termination_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended','terminated')),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  position_id uuid REFERENCES positions(id) ON DELETE SET NULL,
  contract_id uuid,
  bank_name text,
  bank_account text,
  photo_url text,
  user_id uuid,  -- link to auth.users if employee logs in
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CONTRACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  contract_type text NOT NULL CHECK (contract_type IN ('indefinite','fixed_term','probation','consultant','intern')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'DOP',
  work_schedule text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','terminated')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE employees ADD CONSTRAINT employees_contract_fk FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL;

-- ============================================================
-- EMPLOYEE DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  name text NOT NULL,
  doc_type text NOT NULL,
  file_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- EMPLOYEE HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamptz,
  check_out timestamptz,
  record_type text NOT NULL DEFAULT 'work' CHECK (record_type IN ('work','permission','leave','vacation','absence','holiday','overtime')),
  hours numeric(5,2) NOT NULL DEFAULT 0,
  notes text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, record_date, record_type)
);

-- ============================================================
-- PAYROLL PERIODS
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  period_type text NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('weekly','biweekly','monthly')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  pay_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','processing','approved','paid','cancelled')),
  total_gross numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions numeric(14,2) NOT NULL DEFAULT 0,
  total_net numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PAYROLL ITEMS (one per employee per period)
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  overtime_pay numeric(12,2) NOT NULL DEFAULT 0,
  bonuses numeric(12,2) NOT NULL DEFAULT 0,
  gross_salary numeric(12,2) NOT NULL DEFAULT 0,
  afp numeric(12,2) NOT NULL DEFAULT 0,
  sfs numeric(12,2) NOT NULL DEFAULT 0,
  income_tax numeric(12,2) NOT NULL DEFAULT 0,
  loan_payment numeric(12,2) NOT NULL DEFAULT 0,
  advance_payment numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions numeric(12,2) NOT NULL DEFAULT 0,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'calculated' CHECK (status IN ('calculated','approved','paid','cancelled')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, employee_id)
);

-- ============================================================
-- PAYSLIP COMPONENTS (breakdown of each payroll item)
-- ============================================================
CREATE TABLE IF NOT EXISTS payslip_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item_id uuid NOT NULL REFERENCES payroll_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  component_type text NOT NULL CHECK (component_type IN ('earning','deduction')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  is_fixed boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0
);

-- ============================================================
-- LOANS
-- ============================================================
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  principal numeric(12,2) NOT NULL,
  interest_rate numeric(5,2) NOT NULL DEFAULT 0,
  installments int NOT NULL DEFAULT 1,
  paid_installments int NOT NULL DEFAULT 0,
  balance numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paid','cancelled')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- LOAN PAYMENTS (scheduled)
-- ============================================================
CREATE TABLE IF NOT EXISTS loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_number int NOT NULL,
  due_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  payroll_item_id uuid REFERENCES payroll_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_id, installment_number)
);

-- ============================================================
-- ADVANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  payroll_item_id uuid REFERENCES payroll_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- USERS (app users metadata - role mapping)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid UNIQUE,  -- references auth.users(id)
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text UNIQUE,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','hr_manager','payroll_analyst','employee')),
  is_active boolean NOT NULL DEFAULT true,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  username text,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SYSTEM CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- BACKUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  backup_type text NOT NULL DEFAULT 'manual' CHECK (backup_type IN ('manual','automatic')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed','restored')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_position ON employees(position_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, record_date);
CREATE INDEX IF NOT EXISTS idx_attendance_type ON attendance(record_type);
CREATE INDEX IF NOT EXISTS idx_payroll_items_period ON payroll_items(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee ON payroll_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_loans_employee ON loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_advances_employee ON advances(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Helper: role of current user
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT u.role FROM public.users u WHERE u.auth_id = auth.uid();
$$;

-- Generic policy template: admins and hr_manager/payroll_analyst get broad access;
-- employees get only their own rows.

-- COMPANIES: all authenticated can read; admins can write
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "companies_read" ON companies;
CREATE POLICY "companies_read" ON companies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "companies_write" ON companies;
CREATE POLICY "companies_write" ON companies FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','hr_manager'))
  WITH CHECK (public.current_user_role() IN ('admin','hr_manager'));

-- DEPARTMENTS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "departments_read" ON departments;
CREATE POLICY "departments_read" ON departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "departments_write" ON departments;
CREATE POLICY "departments_write" ON departments FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','hr_manager'))
  WITH CHECK (public.current_user_role() IN ('admin','hr_manager'));

-- POSITIONS
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "positions_read" ON positions;
CREATE POLICY "positions_read" ON positions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "positions_write" ON positions;
CREATE POLICY "positions_write" ON positions FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','hr_manager'))
  WITH CHECK (public.current_user_role() IN ('admin','hr_manager'));

-- EMPLOYEES: admins/hr/payroll full; employees see own row
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employees_read" ON employees;
CREATE POLICY "employees_read" ON employees FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin','hr_manager','payroll_analyst')
    OR user_id = auth.uid()
  );
DROP POLICY IF EXISTS "employees_write" ON employees;
CREATE POLICY "employees_write" ON employees FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','hr_manager','payroll_analyst'))
  WITH CHECK (public.current_user_role() IN ('admin','hr_manager','payroll_analyst'));

-- CONTRACTS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contracts_read" ON contracts;
CREATE POLICY "contracts_read" ON contracts FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin','hr_manager','payroll_analyst')
    OR EXISTS (SELECT 1 FROM employees e WHERE e.id = contracts.employee_id AND e.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "contracts_write" ON contracts;
CREATE POLICY "contracts_write" ON contracts FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','hr_manager'))
  WITH CHECK (public.current_user_role() IN ('admin','hr_manager'));

-- EMPLOYEE DOCUMENTS
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emp_docs_read" ON employee_documents;
CREATE POLICY "emp_docs_read" ON employee_documents FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin','hr_manager','payroll_analyst')
    OR EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_documents.employee_id AND e.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "emp_docs_write" ON employee_documents;
CREATE POLICY "emp_docs_write" ON employee_documents FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','hr_manager'))
  WITH CHECK (public.current_user_role() IN ('admin','hr_manager'));

-- EMPLOYEE HISTORY
ALTER TABLE employee_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emp_hist_read" ON employee_history;
CREATE POLICY "emp_hist_read" ON employee_history FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin','hr_manager','payroll_analyst')
    OR EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_history.employee_id AND e.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "emp_hist_write" ON employee_history;
CREATE POLICY "emp_hist_write" ON employee_history FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin','hr_manager','payroll_analyst'));

-- ATTENDANCE
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_read" ON attendance;
CREATE POLICY "attendance_read" ON attendance FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin','hr_manager','payroll_analyst')
    OR EXISTS (SELECT 1 FROM employees e WHERE e.id = attendance.employee_id AND e.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "attendance_write" ON attendance;
CREATE POLICY "attendance_write" ON attendance FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','hr_manager','payroll_analyst'))
  WITH CHECK (public.current_user_role() IN ('admin','hr_manager','payroll_analyst'));

-- PAYROLL PERIODS
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "periods_read" ON payroll_periods;
CREATE POLICY "periods_read" ON payroll_periods FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "periods_write" ON payroll_periods;
CREATE POLICY "periods_write" ON payroll_periods FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','payroll_analyst','hr_manager'))
  WITH CHECK (public.current_user_role() IN ('admin','payroll_analyst','hr_manager'));

-- PAYROLL ITEMS
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payitems_read" ON payroll_items;
CREATE POLICY "payitems_read" ON payroll_items FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin','payroll_analyst','hr_manager')
    OR EXISTS (SELECT 1 FROM employees e WHERE e.id = payroll_items.employee_id AND e.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "payitems_write" ON payroll_items;
CREATE POLICY "payitems_write" ON payroll_items FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','payroll_analyst','hr_manager'))
  WITH CHECK (public.current_user_role() IN ('admin','payroll_analyst','hr_manager'));

-- PAYSLIP COMPONENTS
ALTER TABLE payslip_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "components_read" ON payslip_components;
CREATE POLICY "components_read" ON payslip_components FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin','payroll_analyst','hr_manager')
    OR EXISTS (
      SELECT 1 FROM payroll_items pi
      JOIN employees e ON e.id = pi.employee_id
      WHERE pi.id = payslip_components.payroll_item_id AND e.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "components_write" ON payslip_components;
CREATE POLICY "components_write" ON payslip_components FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','payroll_analyst','hr_manager'))
  WITH CHECK (public.current_user_role() IN ('admin','payroll_analyst','hr_manager'));

-- LOANS
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loans_read" ON loans;
CREATE POLICY "loans_read" ON loans FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin','payroll_analyst','hr_manager')
    OR EXISTS (SELECT 1 FROM employees e WHERE e.id = loans.employee_id AND e.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "loans_write" ON loans;
CREATE POLICY "loans_write" ON loans FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','payroll_analyst','hr_manager'))
  WITH CHECK (public.current_user_role() IN ('admin','payroll_analyst','hr_manager'));

-- LOAN PAYMENTS
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loanpay_read" ON loan_payments;
CREATE POLICY "loanpay_read" ON loan_payments FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin','payroll_analyst','hr_manager')
    OR EXISTS (
      SELECT 1 FROM loans l JOIN employees e ON e.id = l.employee_id
      WHERE l.id = loan_payments.loan_id AND e.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "loanpay_write" ON loan_payments;
CREATE POLICY "loanpay_write" ON loan_payments FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','payroll_analyst','hr_manager'))
  WITH CHECK (public.current_user_role() IN ('admin','payroll_analyst','hr_manager'));

-- ADVANCES
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "advances_read" ON advances;
CREATE POLICY "advances_read" ON advances FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin','payroll_analyst','hr_manager')
    OR EXISTS (SELECT 1 FROM employees e WHERE e.id = advances.employee_id AND e.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "advances_write" ON advances;
CREATE POLICY "advances_write" ON advances FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','payroll_analyst','hr_manager'))
  WITH CHECK (public.current_user_role() IN ('admin','payroll_analyst','hr_manager'));

-- USERS (metadata): admins manage; users read own
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read" ON users;
CREATE POLICY "users_read" ON users FOR SELECT TO authenticated
  USING (auth_id = auth.uid() OR public.current_user_role() = 'admin');
DROP POLICY IF EXISTS "users_write" ON users;
CREATE POLICY "users_write" ON users FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin' OR auth_id = auth.uid())
  WITH CHECK (public.current_user_role() = 'admin' OR auth_id = auth.uid());

-- AUDIT LOG: admins read; any authenticated insert
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_read" ON audit_log;
CREATE POLICY "audit_read" ON audit_log FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');
DROP POLICY IF EXISTS "audit_insert" ON audit_log;
CREATE POLICY "audit_insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- SYSTEM CONFIG: all read; admins write
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "config_read" ON system_config;
CREATE POLICY "config_read" ON system_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "config_write" ON system_config;
CREATE POLICY "config_write" ON system_config FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- BACKUPS: admins only
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "backups_read" ON backups;
CREATE POLICY "backups_read" ON backups FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');
DROP POLICY IF EXISTS "backups_write" ON backups;
CREATE POLICY "backups_write" ON backups FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
