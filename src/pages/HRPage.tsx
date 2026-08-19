import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { logAudit } from '@/utils/audit';
import { formatCurrency, formatDate, getInitials, fullName, classForStatus, isValidEmail } from '@/utils/format';
import { STATUS_LABELS, type Employee, type Department, type Position, type EmployeeStatus } from '@/types';
import { Users, Building2, Briefcase, Plus, Pencil, Trash2, Eye, Phone, Mail, MapPin, Calendar, CreditCard, FileText, History } from 'lucide-react';

type Tab = 'employees' | 'departments' | 'positions';

export function HRPage() {
  const [tab, setTab] = useState<Tab>('employees');
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-ink-800">
        {([
          { id: 'employees' as Tab, label: 'Empleados', icon: <Users className="h-4 w-4" /> },
          { id: 'departments' as Tab, label: 'Departamentos', icon: <Building2 className="h-4 w-4" /> },
          { id: 'positions' as Tab, label: 'Puestos', icon: <Briefcase className="h-4 w-4" /> },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              tab === t.id
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-ink-800 dark:hover:text-ink-200'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'employees' && <EmployeesTab />}
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'positions' && <PositionsTab />}
    </div>
  );
}

/* ============ EMPLOYEES ============ */

function EmployeesTab() {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<(Employee & { departments: { name: string } | null; positions: { name: string } | null })[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [history, setHistory] = useState<{ id: string; action: string; field: string | null; created_at: string }[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: '', first_name: '', last_name: '', birth_date: '', gender: 'M',
    id_document: '', email: '', phone: '', address: '', hire_date: new Date().toISOString().slice(0, 10),
    status: 'active' as EmployeeStatus, department_id: '', position_id: '', bank_name: '', bank_account: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('employees')
      .select('*, departments(name), positions(name)')
      .order('created_at', { ascending: false });
    if (error) showToast('Error al cargar empleados', 'error');
    setEmployees((data ?? []) as (Employee & { departments: { name: string } | null; positions: { name: string } | null })[]);
    setLoading(false);
  }, [showToast]);

  const loadMeta = useCallback(async () => {
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from('departments').select('*').order('name'),
      supabase.from('positions').select('*').order('name'),
    ]);
    setDepartments(d ?? []);
    setPositions(p ?? []);
  }, []);

  useEffect(() => { loadEmployees(); loadMeta(); }, [loadEmployees, loadMeta]);

  function openCreate() {
    setEditing(null);
    setForm({
      code: `EMP-${String(employees.length + 1).padStart(3, '0')}`,
      first_name: '', last_name: '', birth_date: '', gender: 'M',
      id_document: '', email: '', phone: '', address: '', hire_date: new Date().toISOString().slice(0, 10),
      status: 'active', department_id: '', position_id: '', bank_name: '', bank_account: '',
    });
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({
      code: emp.code, first_name: emp.first_name, last_name: emp.last_name,
      birth_date: emp.birth_date ?? '', gender: emp.gender ?? 'M',
      id_document: emp.id_document ?? '', email: emp.email ?? '', phone: emp.phone ?? '',
      address: emp.address ?? '', hire_date: emp.hire_date, status: emp.status,
      department_id: emp.department_id ?? '', position_id: emp.position_id ?? '',
      bank_name: emp.bank_name ?? '', bank_account: emp.bank_account ?? '',
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = 'El nombre es obligatorio';
    if (!form.last_name.trim()) e.last_name = 'El apellido es obligatorio';
    if (!form.code.trim()) e.code = 'El código es obligatorio';
    if (form.email && !isValidEmail(form.email)) e.email = 'Correo no válido';
    if (!form.hire_date) e.hire_date = 'La fecha de ingreso es obligatoria';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      ...form,
      department_id: form.department_id || null,
      position_id: form.position_id || null,
      birth_date: form.birth_date || null,
    };
    if (editing) {
      const { error } = await supabase.from('employees').update(payload).eq('id', editing.id);
      if (error) { showToast('Error al actualizar empleado', 'error'); setSaving(false); return; }
      await logAudit('Actualizar empleado', 'employees', editing.id, { code: form.code });
      showToast('Empleado actualizado correctamente', 'success');
    } else {
      const { data, error } = await supabase.from('employees').insert(payload).select().single();
      if (error) { showToast(error.code === '23505' ? 'Ya existe un empleado con ese código o documento' : 'Error al crear empleado', 'error'); setSaving(false); return; }
      await logAudit('Crear empleado', 'employees', data.id, { code: form.code });
      showToast('Empleado creado correctamente', 'success');
    }
    setSaving(false);
    setModalOpen(false);
    loadEmployees();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('employees').delete().eq('id', deleteTarget.id);
    if (error) { showToast('Error al eliminar empleado', 'error'); return; }
    await logAudit('Eliminar empleado', 'employees', deleteTarget.id, { code: deleteTarget.code });
    showToast('Empleado eliminado', 'success');
    setDeleteTarget(null);
    loadEmployees();
  }

  async function openHistory(emp: Employee) {
    const { data } = await supabase
      .from('employee_history')
      .select('id, action, field, created_at')
      .eq('employee_id', emp.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory((data ?? []) as { id: string; action: string; field: string | null; created_at: string }[]);
    setHistoryOpen(true);
  }

  const columns: Column<Employee & { departments: { name: string } | null; positions: { name: string } | null }>[] = [
    {
      key: 'first_name', header: 'Empleado', sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-brand-500/15 flex items-center justify-center text-brand-600 dark:text-brand-400 text-xs font-semibold flex-shrink-0">
            {getInitials(row.first_name, row.last_name)}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-ink-900 dark:text-white truncate">{fullName(row.first_name, row.last_name)}</p>
            <p className="text-xs text-slate-400">{row.code}</p>
          </div>
        </div>
      ),
    },
    { key: 'departments', header: 'Departamento', render: (row) => row.departments?.name ?? '—' },
    { key: 'positions', header: 'Puesto', render: (row) => row.positions?.name ?? '—' },
    { key: 'email', header: 'Correo', render: (row) => row.email ?? '—' },
    { key: 'phone', header: 'Teléfono', render: (row) => row.phone ?? '—' },
    {
      key: 'status', header: 'Estado', sortable: true,
      render: (row) => <Badge className={classForStatus(row.status)}>{STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status}</Badge>,
    },
    { key: 'hire_date', header: 'Ingreso', sortable: true, render: (row) => formatDate(row.hire_date) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-ink-400">{employees.length} empleados registrados</p>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo Empleado</Button>
      </div>

      <DataTable
        columns={columns}
        data={employees}
        loading={loading}
        searchKeys={['first_name', 'last_name', 'code', 'email', 'phone']}
        searchPlaceholder="Buscar empleado..."
        rowKey={(r) => r.id}
        actions={(row) => (
          <>
            <button onClick={() => setViewing(row)} className="p-2 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition" title="Ver"><Eye className="h-4 w-4" /></button>
            <button onClick={() => openHistory(row)} className="p-2 rounded-lg text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition" title="Historial"><History className="h-4 w-4" /></button>
            <button onClick={() => openEdit(row)} className="p-2 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition" title="Editar"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => setDeleteTarget(row)} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
          </>
        )}
      />

      {/* Create/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Empleado' : 'Nuevo Empleado'}
        description="Completa la información del empleado. Los campos marcados con * son obligatorios."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Guardar Cambios' : 'Crear Empleado'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Código" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} error={errors.code} />
          <Input label="Cédula / Documento" value={form.id_document} onChange={(e) => setForm({ ...form, id_document: e.target.value })} />
          <Input label="Nombre" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} error={errors.first_name} />
          <Input label="Apellido" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} error={errors.last_name} />
          <Input label="Fecha de nacimiento" type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
          <Select label="Género" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} options={[{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }, { value: 'O', label: 'Otro' }]} />
          <Input label="Correo electrónico" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} icon={<Mail className="h-4 w-4" />} />
          <Input label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} icon={<Phone className="h-4 w-4" />} />
          <Input label="Fecha de ingreso" type="date" required value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} error={errors.hire_date} />
          <Select label="Estado" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EmployeeStatus })} options={[
            { value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' },
            { value: 'suspended', label: 'Suspendido' }, { value: 'terminated', label: 'Desvinculado' },
          ]} />
          <Select label="Departamento" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} placeholder="Sin departamento" options={departments.map((d) => ({ value: d.id, label: d.name }))} />
          <Select label="Puesto" value={form.position_id} onChange={(e) => setForm({ ...form, position_id: e.target.value })} placeholder="Sin puesto" options={positions.map((p) => ({ value: p.id, label: p.name }))} />
          <Input label="Banco" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} icon={<CreditCard className="h-4 w-4" />} />
          <Input label="Cuenta bancaria" value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} />
          <div className="md:col-span-2">
            <Textarea label="Dirección" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* View modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Detalle del Empleado" size="lg">
        {viewing && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-brand-500/15 flex items-center justify-center text-brand-600 dark:text-brand-400 text-xl font-bold">
                {getInitials(viewing.first_name, viewing.last_name)}
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-ink-900 dark:text-white">{fullName(viewing.first_name, viewing.last_name)}</h3>
                <p className="text-sm text-slate-500">{viewing.code} · <Badge className={classForStatus(viewing.status)}>{STATUS_LABELS[viewing.status as keyof typeof STATUS_LABELS]}</Badge></p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Cédula', value: viewing.id_document, icon: <FileText className="h-4 w-4" /> },
                { label: 'Correo', value: viewing.email, icon: <Mail className="h-4 w-4" /> },
                { label: 'Teléfono', value: viewing.phone, icon: <Phone className="h-4 w-4" /> },
                { label: 'Fecha de ingreso', value: formatDate(viewing.hire_date), icon: <Calendar className="h-4 w-4" /> },
                { label: 'Banco', value: viewing.bank_name, icon: <CreditCard className="h-4 w-4" /> },
                { label: 'Cuenta', value: viewing.bank_account },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">{f.icon}</span>
                  <div>
                    <p className="text-xs text-slate-400">{f.label}</p>
                    <p className="font-medium text-ink-800 dark:text-ink-200">{f.value || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
            {viewing.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400">Dirección</p>
                  <p className="font-medium text-ink-800 dark:text-ink-200">{viewing.address}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* History modal */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Historial del Empleado" size="md">
        <div className="space-y-3">
          {history.length > 0 ? history.map((h) => (
            <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-ink-800/50">
              <History className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm text-ink-800 dark:text-ink-200">{h.action}</p>
                <p className="text-xs text-slate-400">{formatDate(h.created_at, true)}</p>
              </div>
            </div>
          )) : <p className="text-sm text-slate-400 text-center py-8">Sin historial registrado</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Empleado"
        message={`¿Estás seguro de eliminar a ${deleteTarget ? fullName(deleteTarget.first_name, deleteTarget.last_name) : ''}? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}

/* ============ DEPARTMENTS ============ */

function DepartmentsTab() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('departments').select('*').order('name');
    if (error) showToast('Error al cargar departamentos', 'error');
    setItems(data ?? []);
    const { data: empData } = await supabase.from('employees').select('department_id');
    const c: Record<string, number> = {};
    (empData ?? []).forEach((r: { department_id: string | null }) => {
      if (r.department_id) c[r.department_id] = (c[r.department_id] ?? 0) + 1;
    });
    setCounts(c);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setName(''); setDescription(''); setModalOpen(true); }
  function openEdit(d: Department) { setEditing(d); setName(d.name); setDescription(d.description ?? ''); setModalOpen(true); }

  async function handleSave() {
    if (!name.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('departments').update({ name, description }).eq('id', editing.id);
      if (error) { showToast('Error al actualizar', 'error'); setSaving(false); return; }
      await logAudit('Actualizar departamento', 'departments', editing.id, { name });
      showToast('Departamento actualizado', 'success');
    } else {
      const { data, error } = await supabase.from('departments').insert({ name, description }).select().single();
      if (error) { showToast('Error al crear', 'error'); setSaving(false); return; }
      await logAudit('Crear departamento', 'departments', data.id, { name });
      showToast('Departamento creado', 'success');
    }
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('departments').delete().eq('id', deleteTarget.id);
    if (error) { showToast('No se puede eliminar: tiene empleados asignados', 'error'); setDeleteTarget(null); return; }
    await logAudit('Eliminar departamento', 'departments', deleteTarget.id, { name: deleteTarget.name });
    showToast('Departamento eliminado', 'success');
    setDeleteTarget(null);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-ink-400">{items.length} departamentos</p>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo Departamento</Button>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card p-6 h-32 animate-pulse bg-slate-100 dark:bg-ink-800" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((d) => (
            <Card key={d.id} padding="md" className="hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between">
                <div className="h-11 w-11 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(d)} className="p-2 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteTarget(d)} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <h3 className="mt-3 font-display font-bold text-ink-900 dark:text-white">{d.name}</h3>
              <p className="text-sm text-slate-500 dark:text-ink-400 mt-1 line-clamp-2">{d.description || 'Sin descripción'}</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge className="bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-ink-300">{counts[d.id] ?? 0} empleados</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Departamento' : 'Nuevo Departamento'} size="sm"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Guardar' : 'Crear'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea label="Descripción" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Eliminar Departamento" message={`¿Eliminar el departamento "${deleteTarget?.name}"?`} />
    </div>
  );
}

/* ============ POSITIONS ============ */

function PositionsTab() {
  const { showToast } = useToast();
  const [items, setItems] = useState<(Position & { departments: { name: string } | null })[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null);
  const [form, setForm] = useState({ name: '', department_id: '', base_salary: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('positions').select('*, departments(name)').order('name');
    if (error) showToast('Error al cargar puestos', 'error');
    setItems((data ?? []) as (Position & { departments: { name: string } | null })[]);
    const { data: d } = await supabase.from('departments').select('*').order('name');
    setDepartments(d ?? []);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm({ name: '', department_id: '', base_salary: '', description: '' }); setModalOpen(true); }
  function openEdit(p: Position) { setEditing(p); setForm({ name: p.name, department_id: p.department_id ?? '', base_salary: String(p.base_salary), description: p.description ?? '' }); setModalOpen(true); }

  async function handleSave() {
    if (!form.name.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    setSaving(true);
    const payload = { name: form.name, department_id: form.department_id || null, base_salary: parseFloat(form.base_salary) || 0, description: form.description };
    if (editing) {
      const { error } = await supabase.from('positions').update(payload).eq('id', editing.id);
      if (error) { showToast('Error al actualizar', 'error'); setSaving(false); return; }
      await logAudit('Actualizar puesto', 'positions', editing.id, { name: form.name });
      showToast('Puesto actualizado', 'success');
    } else {
      const { data, error } = await supabase.from('positions').insert(payload).select().single();
      if (error) { showToast('Error al crear', 'error'); setSaving(false); return; }
      await logAudit('Crear puesto', 'positions', data.id, { name: form.name });
      showToast('Puesto creado', 'success');
    }
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('positions').delete().eq('id', deleteTarget.id);
    if (error) { showToast('No se puede eliminar: tiene empleados asignados', 'error'); setDeleteTarget(null); return; }
    await logAudit('Eliminar puesto', 'positions', deleteTarget.id, { name: deleteTarget.name });
    showToast('Puesto eliminado', 'success');
    setDeleteTarget(null);
    load();
  }

  const columns: Column<Position & { departments: { name: string } | null }>[] = [
    { key: 'name', header: 'Puesto', sortable: true, render: (r) => <span className="font-medium text-ink-900 dark:text-white">{r.name}</span> },
    { key: 'departments', header: 'Departamento', render: (r) => r.departments?.name ?? '—' },
    { key: 'base_salary', header: 'Salario Base', sortable: true, render: (r) => <span className="font-medium">{formatCurrency(r.base_salary)}</span> },
    { key: 'description', header: 'Descripción', render: (r) => r.description ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-ink-400">{items.length} puestos</p>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo Puesto</Button>
      </div>
      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        searchKeys={['name']}
        searchPlaceholder="Buscar puesto..."
        rowKey={(r) => r.id}
        actions={(row) => (
          <>
            <button onClick={() => openEdit(row)} className="p-2 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => setDeleteTarget(row)} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"><Trash2 className="h-4 w-4" /></button>
          </>
        )}
      />
      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Puesto' : 'Nuevo Puesto'}
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Guardar' : 'Crear'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Nombre" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Departamento" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} placeholder="Sin departamento" options={departments.map((d) => ({ value: d.id, label: d.name }))} />
          <Input label="Salario base" type="number" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} />
          <Textarea label="Descripción" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Eliminar Puesto" message={`¿Eliminar el puesto "${deleteTarget?.name}"?`} />
    </div>
  );
}
