import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Badge, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { logAudit } from '@/utils/audit';
import { formatDate, fullName, classForStatus } from '@/utils/format';
import { ATTENDANCE_LABELS, type Attendance, type AttendanceType, type Employee } from '@/types';
import { Plus, Pencil, Trash2, Clock, Calendar, CheckCircle2, Timer, LogIn, LogOut } from 'lucide-react';

export function AttendancePage() {
  const { showToast } = useToast();
  const [records, setRecords] = useState<(Attendance & { employees: { first_name: string; last_name: string; code: string } })[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Attendance | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Attendance | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);

  const [form, setForm] = useState({
    employee_id: '', record_date: new Date().toISOString().slice(0, 10),
    check_in: '08:00', check_out: '17:00', record_type: 'work' as AttendanceType,
    hours: '8', notes: '', approved: true,
  });

  const [stats, setStats] = useState({ today: 0, overtime: 0, vacation: 0, permissions: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('attendance')
      .select('*, employees(first_name, last_name, code)')
      .order('record_date', { ascending: false })
      .limit(200);
    if (error) showToast('Error al cargar asistencia', 'error');
    setRecords((data ?? []) as (Attendance & { employees: { first_name: string; last_name: string; code: string } })[]);

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const [{ count: todayCount }, { data: otData }, { count: vacCount }, { count: permCount }] = await Promise.all([
      supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('record_date', today).eq('record_type', 'work'),
      supabase.from('attendance').select('hours').eq('record_type', 'overtime').eq('approved', true).gte('record_date', monthStart),
      supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('record_type', 'vacation').gte('record_date', monthStart),
      supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('record_type', 'permission').gte('record_date', monthStart),
    ]);
    setStats({
      today: todayCount ?? 0,
      overtime: (otData ?? []).reduce((s, r: { hours: number }) => s + (r.hours ?? 0), 0),
      vacation: vacCount ?? 0,
      permissions: permCount ?? 0,
    });
    setLoading(false);
  }, [showToast]);

  const loadEmployees = useCallback(async () => {
    const { data } = await supabase.from('employees').select('*').eq('status', 'active').order('first_name');
    setEmployees(data ?? []);
  }, []);

  useEffect(() => { load(); loadEmployees(); }, [load, loadEmployees]);

  function openCreate() {
    setEditing(null);
    setForm({ employee_id: '', record_date: new Date().toISOString().slice(0, 10), check_in: '08:00', check_out: '17:00', record_type: 'work', hours: '8', notes: '', approved: true });
    setModalOpen(true);
  }

  function openEdit(r: Attendance) {
    setEditing(r);
    setForm({
      employee_id: r.employee_id, record_date: r.record_date,
      check_in: r.check_in ? new Date(r.check_in).toTimeString().slice(0, 5) : '',
      check_out: r.check_out ? new Date(r.check_out).toTimeString().slice(0, 5) : '',
      record_type: r.record_type, hours: String(r.hours), notes: r.notes ?? '', approved: r.approved,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.employee_id) { showToast('Selecciona un empleado', 'error'); return; }
    setSaving(true);
    const payload = {
      employee_id: form.employee_id,
      record_date: form.record_date,
      check_in: form.check_in ? `${form.record_date}T${form.check_in}:00` : null,
      check_out: form.check_out ? `${form.record_date}T${form.check_out}:00` : null,
      record_type: form.record_type,
      hours: parseFloat(form.hours) || 0,
      notes: form.notes || null,
      approved: form.approved,
    };
    if (editing) {
      const { error } = await supabase.from('attendance').update(payload).eq('id', editing.id);
      if (error) { showToast('Error al actualizar', 'error'); setSaving(false); return; }
      await logAudit('Actualizar asistencia', 'attendance', editing.id);
      showToast('Registro actualizado', 'success');
    } else {
      const { data, error } = await supabase.from('attendance').insert(payload).select().single();
      if (error) {
        showToast(error.code === '23505' ? 'Ya existe un registro para este empleado y fecha' : 'Error al crear registro', 'error');
        setSaving(false);
        return;
      }
      await logAudit('Registrar asistencia', 'attendance', data.id);
      showToast('Registro creado', 'success');
    }
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('attendance').delete().eq('id', deleteTarget.id);
    if (error) { showToast('Error al eliminar', 'error'); return; }
    await logAudit('Eliminar asistencia', 'attendance', deleteTarget.id);
    showToast('Registro eliminado', 'success');
    setDeleteTarget(null);
    load();
  }

  async function handleQuickCheckIn() {
    if (!form.employee_id) { showToast('Selecciona un empleado', 'error'); return; }
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 5);
    const { error } = await supabase.from('attendance').insert({
      employee_id: form.employee_id,
      record_date: today,
      check_in: `${today}T${now}:00`,
      record_type: 'work',
      hours: 0,
      approved: false,
    });
    if (error) { showToast(error.code === '23505' ? 'Ya tiene un registro hoy' : 'Error al registrar entrada', 'error'); return; }
    await logAudit('Check-in rápido', 'attendance');
    showToast('Entrada registrada a las ' + now, 'success');
    setCheckInOpen(false);
    load();
  }

  const columns: Column<Attendance & { employees: { first_name: string; last_name: string; code: string } }>[] = [
    {
      key: 'employee_id', header: 'Empleado', sortable: true,
      render: (r) => <span className="font-medium text-ink-900 dark:text-white">{fullName(r.employees.first_name, r.employees.last_name)}</span>,
    },
    { key: 'record_date', header: 'Fecha', sortable: true, render: (r) => formatDate(r.record_date) },
    {
      key: 'record_type', header: 'Tipo', sortable: true,
      render: (r) => <Badge className={classForStatus(r.record_type === 'work' ? 'active' : r.record_type === 'overtime' ? 'processing' : r.record_type === 'vacation' ? 'approved' : 'pending')}>{ATTENDANCE_LABELS[r.record_type]}</Badge>,
    },
    { key: 'hours', header: 'Horas', sortable: true, render: (r) => `${r.hours}h` },
    { key: 'check_in', header: 'Entrada', render: (r) => r.check_in ? new Date(r.check_in).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }) : '—' },
    { key: 'check_out', header: 'Salida', render: (r) => r.check_out ? new Date(r.check_out).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }) : '—' },
    {
      key: 'approved', header: 'Aprobado',
      render: (r) => r.approved
        ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3 mr-1" />Sí</Badge>
        : <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Pendiente</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Registros Hoy" value={stats.today} icon={<Calendar className="h-5 w-5" />} accent="orange" />
        <StatCard label="Horas Extras (mes)" value={`${stats.overtime}h`} icon={<Timer className="h-5 w-5" />} accent="violet" />
        <StatCard label="En Vacaciones" value={stats.vacation} icon={<Clock className="h-5 w-5" />} accent="blue" />
        <StatCard label="Permisos (mes)" value={stats.permissions} icon={<Calendar className="h-5 w-5" />} accent="amber" />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-ink-400">Registros de asistencia</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCheckInOpen(true)}><LogIn className="h-4 w-4" /> Entrada Rápida</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo Registro</Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        searchKeys={['record_date']}
        searchPlaceholder="Buscar por fecha..."
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
        title={editing ? 'Editar Registro' : 'Nuevo Registro de Asistencia'}
        size="lg"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Guardar' : 'Crear'}</Button></>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Select label="Empleado" required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="Selecciona..." options={employees.map((e) => ({ value: e.id, label: `${e.code} · ${fullName(e.first_name, e.last_name)}` }))} />
          </div>
          <Input label="Fecha" type="date" required value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} />
          <Select label="Tipo" value={form.record_type} onChange={(e) => setForm({ ...form, record_type: e.target.value as AttendanceType })} options={Object.entries(ATTENDANCE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          <Input label="Hora de entrada" type="time" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} />
          <Input label="Hora de salida" type="time" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} />
          <Input label="Horas" type="number" step="0.5" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer pb-3">
              <input type="checkbox" checked={form.approved} onChange={(e) => setForm({ ...form, approved: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500/40" />
              <span className="text-sm text-ink-700 dark:text-ink-300">Aprobado</span>
            </label>
          </div>
          <div className="md:col-span-2">
            <Textarea label="Notas" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal
        open={checkInOpen} onClose={() => setCheckInOpen(false)}
        title="Entrada Rápida" description="Registra la entrada de un empleado ahora mismo." size="sm"
        footer={<><Button variant="outline" onClick={() => setCheckInOpen(false)}>Cancelar</Button><Button onClick={handleQuickCheckIn}><LogIn className="h-4 w-4" /> Registrar Entrada</Button></>}
      >
        <Select label="Empleado" required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="Selecciona..." options={employees.map((e) => ({ value: e.id, label: `${e.code} · ${fullName(e.first_name, e.last_name)}` }))} />
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Eliminar Registro" message="¿Eliminar este registro de asistencia?" />
    </div>
  );
}
