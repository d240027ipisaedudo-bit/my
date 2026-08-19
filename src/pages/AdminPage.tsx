import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Badge, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { logAudit, fetchAuditLogs } from '@/utils/audit';
import { formatDate, formatRelative, fullName, classForStatus } from '@/utils/format';
import { ROLE_LABELS, type AppUser, type SystemConfig, type AuditLog, type UserRole } from '@/types';
import { Users, Settings, ScrollText, Shield, Plus, Pencil, Trash2, Save, UserCog, Lock, Database, Activity } from 'lucide-react';

type Tab = 'users' | 'config' | 'audit' | 'company';

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-ink-800">
        {([
          { id: 'users' as Tab, label: 'Usuarios', icon: <Users className="h-4 w-4" /> },
          { id: 'config' as Tab, label: 'Configuración', icon: <Settings className="h-4 w-4" /> },
          { id: 'audit' as Tab, label: 'Auditoría', icon: <ScrollText className="h-4 w-4" /> },
          { id: 'company' as Tab, label: 'Empresa', icon: <Database className="h-4 w-4" /> },
        ]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              tab === t.id ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-ink-800 dark:hover:text-ink-200'
            }`}>{t.icon}{t.label}</button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'config' && <ConfigTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'company' && <CompanyTab />}
    </div>
  );
}

/* ============ USERS ============ */

function UsersTab() {
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ username: '', full_name: '', email: '', role: 'employee' as UserRole, is_active: true });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) showToast('Error al cargar usuarios', 'error');
    setUsers((data ?? []) as AppUser[]);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm({ username: '', full_name: '', email: '', role: 'employee', is_active: true }); setModalOpen(true); }
  function openEdit(u: AppUser) { setEditing(u); setForm({ username: u.username, full_name: u.full_name, email: u.email ?? '', role: u.role, is_active: u.is_active }); setModalOpen(true); }

  async function handleSave() {
    if (!form.username.trim() || !form.full_name.trim()) { showToast('Completa los campos', 'error'); return; }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('users').update(form).eq('id', editing.id);
      if (error) { showToast('Error al actualizar', 'error'); setSaving(false); return; }
      await logAudit('Actualizar usuario', 'users', editing.id, { username: form.username });
      showToast('Usuario actualizado', 'success');
    } else {
      const { data, error } = await supabase.from('users').insert({ ...form, auth_id: null }).select().single();
      if (error) { showToast('Error al crear usuario', 'error'); setSaving(false); return; }
      await logAudit('Crear usuario', 'users', data.id, { username: form.username });
      showToast('Usuario creado', 'success');
    }
    setSaving(false); setModalOpen(false); load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.id === currentUser?.id) { showToast('No puedes eliminar tu propia cuenta', 'error'); setDeleteTarget(null); return; }
    const { error } = await supabase.from('users').delete().eq('id', deleteTarget.id);
    if (error) { showToast('Error al eliminar', 'error'); return; }
    await logAudit('Eliminar usuario', 'users', deleteTarget.id);
    showToast('Usuario eliminado', 'success');
    setDeleteTarget(null); load();
  }

  const columns: Column<AppUser>[] = [
    { key: 'full_name', header: 'Nombre', sortable: true, render: (r) => <span className="font-medium text-ink-900 dark:text-white">{r.full_name}</span> },
    { key: 'username', header: 'Usuario', sortable: true },
    { key: 'email', header: 'Correo', render: (r) => r.email ?? '—' },
    { key: 'role', header: 'Rol', sortable: true, render: (r) => <Badge className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{ROLE_LABELS[r.role]}</Badge> },
    { key: 'last_login', header: 'Último acceso', render: (r) => r.last_login ? formatRelative(r.last_login) : 'Nunca' },
    { key: 'is_active', header: 'Estado', render: (r) => r.is_active ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Activo</Badge> : <Badge className="bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-ink-300">Inactivo</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-ink-400">{users.length} usuarios</p>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo Usuario</Button>
      </div>
      <DataTable columns={columns} data={users} loading={loading} searchKeys={['full_name', 'username', 'email']} searchPlaceholder="Buscar usuario..." rowKey={(r) => r.id}
        actions={(row) => (<>
          <button onClick={() => openEdit(row)} className="p-2 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => setDeleteTarget(row)} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"><Trash2 className="h-4 w-4" /></button>
        </>)}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Usuario' : 'Nuevo Usuario'} size="md"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Guardar' : 'Crear'}</Button></>}>
        <div className="space-y-4">
          <Input label="Nombre completo" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <Input label="Nombre de usuario" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Input label="Correo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Select label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} options={Object.entries(ROLE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500/40" />
            <span className="text-sm text-ink-700 dark:text-ink-300">Usuario activo</span>
          </label>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Eliminar Usuario" message={`¿Eliminar a "${deleteTarget?.full_name}"?`} />
    </div>
  );
}

/* ============ CONFIG ============ */

function ConfigTab() {
  const { showToast } = useToast();
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('system_config').select('*').order('category').order('key');
    if (error) showToast('Error al cargar configuración', 'error');
    setConfigs(data ?? []);
    const v: Record<string, string> = {};
    (data ?? []).forEach((c) => { v[c.key] = c.value; });
    setValues(v);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    for (const [key, value] of Object.entries(values)) {
      await supabase.from('system_config').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
    }
    await logAudit('Actualizar configuración', 'system_config');
    showToast('Configuración guardada', 'success');
    setSaving(false);
  }

  const categories = [...new Set(configs.map((c) => c.category))];
  const categoryLabels: Record<string, string> = { general: 'General', payroll: 'Nómina', ui: 'Interfaz', system: 'Sistema', security: 'Seguridad' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-ink-400">Parámetros del sistema</p>
        <Button onClick={handleSave} loading={saving}><Save className="h-4 w-4" /> Guardar Cambios</Button>
      </div>
      {loading ? (
        <div className="card p-6 animate-pulse h-40 bg-slate-100 dark:bg-ink-800" />
      ) : (
        <div className="space-y-5">
          {categories.map((cat) => (
            <Card key={cat} padding="md">
              <h3 className="font-display font-bold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
                <Settings className="h-4 w-4 text-brand-500" /> {categoryLabels[cat] ?? cat}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {configs.filter((c) => c.category === cat).map((c) => (
                  <div key={c.id}>
                    <label className="label-base">{c.description ?? c.key}</label>
                    <input
                      className="input-base"
                      value={values[c.key] ?? ''}
                      onChange={(e) => setValues({ ...values, [c.key]: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-slate-400">{c.key}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ AUDIT ============ */

function AuditTab() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs(100).then((data) => {
      setLogs(data as AuditLog[]);
      setLoading(false);
    }).catch(() => {
      showToast('Error al cargar auditoría', 'error');
      setLoading(false);
    });
  }, [showToast]);

  const columns: Column<AuditLog>[] = [
    { key: 'created_at', header: 'Fecha', sortable: true, render: (r) => formatDate(r.created_at, true) },
    { key: 'username', header: 'Usuario', render: (r) => r.username ?? 'Sistema' },
    { key: 'action', header: 'Acción', sortable: true, render: (r) => <span className="font-medium text-ink-900 dark:text-white">{r.action}</span> },
    { key: 'entity', header: 'Entidad', render: (r) => r.entity ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Eventos" value={logs.length} icon={<Activity className="h-5 w-5" />} accent="orange" />
        <StatCard label="Hoy" value={logs.filter((l) => formatDate(l.created_at) === formatDate(new Date())).length} icon={<ScrollText className="h-5 w-5" />} accent="blue" />
        <StatCard label="Usuarios Activos" value={new Set(logs.map((l) => l.username).filter(Boolean)).size} icon={<Users className="h-5 w-5" />} accent="emerald" />
      </div>
      <DataTable columns={columns} data={logs} loading={loading} searchKeys={['action', 'username', 'entity']} searchPlaceholder="Buscar en auditoría..." rowKey={(r) => r.id} />
    </div>
  );
}

/* ============ COMPANY ============ */

function CompanyTab() {
  const { showToast } = useToast();
  const [company, setCompany] = useState<{ id: string; name: string; legal_name: string | null; tax_id: string | null; address: string | null; phone: string | null; email: string | null; currency: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('companies').select('*').limit(1).maybeSingle().then(({ data }) => {
      setCompany(data as typeof company);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    if (!company) return;
    setSaving(true);
    const { error } = await supabase.from('companies').update({
      name: company.name, legal_name: company.legal_name, tax_id: company.tax_id,
      address: company.address, phone: company.phone, email: company.email, currency: company.currency,
    }).eq('id', company.id);
    if (error) { showToast('Error al guardar', 'error'); setSaving(false); return; }
    await logAudit('Actualizar empresa', 'companies', company.id);
    showToast('Datos de empresa guardados', 'success');
    setSaving(false);
  }

  if (loading) return <div className="card p-6 animate-pulse h-60 bg-slate-100 dark:bg-ink-800" />;
  if (!company) return <p className="text-sm text-slate-400">No hay datos de empresa</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-ink-400">Información de la empresa</p>
        <Button onClick={handleSave} loading={saving}><Save className="h-4 w-4" /> Guardar</Button>
      </div>
      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nombre comercial" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
          <Input label="Razón social" value={company.legal_name ?? ''} onChange={(e) => setCompany({ ...company, legal_name: e.target.value })} />
          <Input label="RNC / Tax ID" value={company.tax_id ?? ''} onChange={(e) => setCompany({ ...company, tax_id: e.target.value })} />
          <Input label="Moneda" value={company.currency} onChange={(e) => setCompany({ ...company, currency: e.target.value })} />
          <Input label="Teléfono" value={company.phone ?? ''} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
          <Input label="Correo" value={company.email ?? ''} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
          <div className="md:col-span-2"><Textarea label="Dirección" rows={2} value={company.address ?? ''} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></div>
        </div>
      </Card>
    </div>
  );
}
