/*
# Seed Reference Data

1. Default company, departments, positions, system config.
2. Sample employees, contracts, attendance, loan, advance for dashboard demo.
*/

INSERT INTO companies (name, legal_name, tax_id, address, phone, email, currency)
VALUES ('NovaCorp', 'NovaCorp SRL', '131-12345-6', 'Av. 27 de Febrero 100, Santiago', '809-555-0100', 'info@novacorp.do', 'DOP')
ON CONFLICT DO NOTHING;

INSERT INTO departments (id, name, description) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Administración', 'Dirección y administración general'),
  ('11111111-0000-0000-0000-000000000002', 'Recursos Humanos', 'Gestión de talento humano'),
  ('11111111-0000-0000-0000-000000000003', 'Tecnología', 'Sistemas y desarrollo'),
  ('11111111-0000-0000-0000-000000000004', 'Finanzas', 'Contabilidad y finanzas'),
  ('11111111-0000-0000-0000-000000000005', 'Operaciones', 'Producción y logística'),
  ('11111111-0000-0000-0000-000000000006', 'Ventas', 'Comercial y marketing')
ON CONFLICT DO NOTHING;

INSERT INTO positions (id, name, department_id, base_salary) VALUES
  ('22222222-0000-0000-0000-000000000001', 'Gerente General', '11111111-0000-0000-0000-000000000001', 250000),
  ('22222222-0000-0000-0000-000000000002', 'Analista de RRHH', '11111111-0000-0000-0000-000000000002', 65000),
  ('22222222-0000-0000-0000-000000000003', 'Desarrollador Senior', '11111111-0000-0000-0000-000000000003', 120000),
  ('22222222-0000-0000-0000-000000000004', 'Desarrollador Junior', '11111111-0000-0000-0000-000000000003', 55000),
  ('22222222-0000-0000-0000-000000000005', 'Contador', '11111111-0000-0000-0000-000000000004', 85000),
  ('22222222-0000-0000-0000-000000000006', 'Analista Financiero', '11111111-0000-0000-0000-000000000004', 70000),
  ('22222222-0000-0000-0000-000000000007', 'Supervisor de Operaciones', '11111111-0000-0000-0000-000000000005', 60000),
  ('22222222-0000-0000-0000-000000000008', 'Operario', '11111111-0000-0000-0000-000000000005', 35000),
  ('22222222-0000-0000-0000-000000000009', 'Ejecutivo de Ventas', '11111111-0000-0000-0000-000000000006', 45000),
  ('22222222-0000-0000-0000-000000000010', 'Coordinador de Marketing', '11111111-0000-0000-0000-000000000006', 58000)
ON CONFLICT DO NOTHING;

INSERT INTO system_config (key, value, category, description) VALUES
  ('company_name', 'NovaCorp', 'general', 'Nombre de la empresa'),
  ('currency', 'DOP', 'general', 'Moneda predeterminada'),
  ('afp_rate', '0.0287', 'payroll', 'Tasa AFP (2.87%)'),
  ('sfs_rate', '0.0304', 'payroll', 'Tasa SFS (3.04%) 2024'),
  ('isr_enabled', 'true', 'payroll', 'Impuesto sobre la renta activo'),
  ('overtime_multiplier', '1.5', 'payroll', 'Multiplicador de horas extras'),
  ('work_hours_per_day', '8', 'payroll', 'Horas laborables por día'),
  ('work_days_per_month', '23.83', 'payroll', 'Días laborables mensuales (RD)'),
  ('min_salary', '23880', 'payroll', 'Salario mínimo (RD)'),
  ('theme_default', 'light', 'ui', 'Tema predeterminado'),
  ('backup_enabled', 'true', 'system', 'Copias de seguridad automáticas'),
  ('backup_frequency', 'weekly', 'system', 'Frecuencia de respaldo'),
  ('session_timeout', '60', 'security', 'Tiempo de sesión (minutos)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO employees (id, code, first_name, last_name, birth_date, gender, id_document, email, phone, address, hire_date, status, department_id, position_id, bank_name, bank_account) VALUES
  ('33333333-0000-0000-0000-000000000001', 'EMP-001', 'Carlos', 'Rodríguez', '1985-04-12', 'M', '001-1234567-8', 'carlos.rodriguez@novacorp.do', '809-555-1001', 'Calle El Sol 45', '2020-01-15', 'active', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'Banco Popular', '1234567890'),
  ('33333333-0000-0000-0000-000000000002', 'EMP-002', 'María', 'García', '1990-08-22', 'F', '002-2345678-9', 'maria.garcia@novacorp.do', '809-555-1002', 'Av. Las Américas 12', '2021-03-10', 'active', '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'Banreservas', '2345678901'),
  ('33333333-0000-0000-0000-000000000003', 'EMP-003', 'José', 'Martínez', '1988-11-05', 'M', '003-3456789-0', 'jose.martinez@novacorp.do', '809-555-1003', 'Calle Segunda 78', '2019-06-20', 'active', '11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000003', 'Banco BHD', '3456789012'),
  ('33333333-0000-0000-0000-000000000004', 'EMP-004', 'Ana', 'Sánchez', '1995-02-18', 'F', '004-4567890-1', 'ana.sanchez@novacorp.do', '809-555-1004', 'Residencial Las Palmas', '2022-09-01', 'active', '11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000004', 'Banco Popular', '4567890123'),
  ('33333333-0000-0000-0000-000000000005', 'EMP-005', 'Luis', 'Fernández', '1982-07-30', 'M', '005-5678901-2', 'luis.fernandez@novacorp.do', '809-555-1005', 'Calle Mella 33', '2018-02-14', 'active', '11111111-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000005', 'Banreservas', '5678901234'),
  ('33333333-0000-0000-0000-000000000006', 'EMP-006', 'Patricia', 'Díaz', '1993-12-03', 'F', '006-6789012-3', 'patricia.diaz@novacorp.do', '809-555-1006', 'Av. Independencia 90', '2021-11-15', 'active', '11111111-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000006', 'Banco BHD', '6789012345'),
  ('33333333-0000-0000-0000-000000000007', 'EMP-007', 'Roberto', 'Pérez', '1987-05-25', 'M', '007-7890123-4', 'roberto.perez@novacorp.do', '809-555-1007', 'Calle Duarte 11', '2020-07-08', 'active', '11111111-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000007', 'Banco Popular', '7890123456'),
  ('33333333-0000-0000-0000-000000000008', 'EMP-008', 'Carmen', 'López', '1998-09-14', 'F', '008-8901234-5', 'carmen.lopez@novacorp.do', '809-555-1008', 'Residencial Mirador', '2023-01-20', 'active', '11111111-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000008', 'Banreservas', '8901234567'),
  ('33333333-0000-0000-0000-000000000009', 'EMP-009', 'Manuel', 'Ramírez', '1991-03-08', 'M', '009-9012345-6', 'manuel.ramirez@novacorp.do', '809-555-1009', 'Calle 30 de Marzo 5', '2022-04-12', 'active', '11111111-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000009', 'Banco BHD', '9012345678'),
  ('33333333-0000-0000-0000-000000000010', 'EMP-010', 'Sofía', 'Torres', '1996-06-19', 'F', '010-0123456-7', 'sofia.torres@novacorp.do', '809-555-1010', 'Av. Bolívar 67', '2023-05-03', 'inactive', '11111111-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000010', 'Banco Popular', '0123456789'),
  ('33333333-0000-0000-0000-000000000011', 'EMP-011', 'Eduardo', 'Castro', '1984-10-22', 'M', '011-1234567-8', 'eduardo.castro@novacorp.do', '809-555-1011', 'Calle Núñez 44', '2017-08-30', 'active', '11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000003', 'Banco BHD', '1112345678'),
  ('33333333-0000-0000-0000-000000000012', 'EMP-012', 'Daniela', 'Morales', '1994-01-27', 'F', '012-2345678-9', 'daniela.morales@novacorp.do', '809-555-1012', 'Residencial Atlántico', '2022-10-17', 'active', '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'Banreservas', '1223456789')
ON CONFLICT DO NOTHING;

-- Contracts
INSERT INTO contracts (employee_id, contract_type, start_date, base_salary, currency, work_schedule, status)
SELECT id, 'indefinite', hire_date,
  CASE
    WHEN position_id = '22222222-0000-0000-0000-000000000001' THEN 250000
    WHEN position_id = '22222222-0000-0000-0000-000000000002' THEN 65000
    WHEN position_id = '22222222-0000-0000-0000-000000000003' THEN 120000
    WHEN position_id = '22222222-0000-0000-0000-000000000004' THEN 55000
    WHEN position_id = '22222222-0000-0000-0000-000000000005' THEN 85000
    WHEN position_id = '22222222-0000-0000-0000-000000000006' THEN 70000
    WHEN position_id = '22222222-0000-0000-0000-000000000007' THEN 60000
    WHEN position_id = '22222222-0000-0000-0000-000000000008' THEN 35000
    WHEN position_id = '22222222-0000-0000-0000-000000000009' THEN 45000
    WHEN position_id = '22222222-0000-0000-0000-000000000010' THEN 58000
    ELSE 40000
  END,
  'DOP', 'Lunes a Viernes 8:00-17:00', 'active'
FROM employees
ON CONFLICT DO NOTHING;

-- Link employees to their contract_id
UPDATE employees e SET contract_id = c.id
FROM contracts c WHERE c.employee_id = e.id AND e.contract_id IS NULL;

-- Sample attendance (weekdays last 20 days for active employees)
INSERT INTO attendance (employee_id, record_date, check_in, check_out, record_type, hours, approved)
SELECT
  e.id,
  (CURRENT_DATE - n),
  ((CURRENT_DATE - n)::timestamp + '08:00'::time),
  ((CURRENT_DATE - n)::timestamp + '17:00'::time),
  'work',
  8,
  true
FROM employees e
CROSS JOIN generate_series(1, 20) AS n
WHERE e.status = 'active'
  AND EXTRACT(DOW FROM (CURRENT_DATE - n)) NOT IN (0, 6)
ON CONFLICT DO NOTHING;

-- Some overtime
INSERT INTO attendance (employee_id, record_date, record_type, hours, approved, notes)
SELECT e.id, CURRENT_DATE - 5, 'overtime', 4, true, 'Proyecto urgente'
FROM employees e WHERE e.code IN ('EMP-003','EMP-007','EMP-011')
ON CONFLICT DO NOTHING;

-- Vacation
INSERT INTO attendance (employee_id, record_date, record_type, hours, approved, notes)
SELECT e.id, CURRENT_DATE - 2, 'vacation', 8, true, 'Vacaciones anuales'
FROM employees e WHERE e.code = 'EMP-010'
ON CONFLICT DO NOTHING;

-- A sample loan
INSERT INTO loans (employee_id, principal, interest_rate, installments, paid_installments, balance, status, start_date, notes)
VALUES ('33333333-0000-0000-0000-000000000003', 50000, 12, 10, 2, 40000, 'active', CURRENT_DATE - 60, 'Préstamo personal')
ON CONFLICT DO NOTHING;

-- A sample advance
INSERT INTO advances (employee_id, amount, request_date, reason, status)
VALUES ('33333333-0000-0000-0000-000000000005', 8000, CURRENT_DATE - 3, 'Gastos médicos', 'approved')
ON CONFLICT DO NOTHING;
