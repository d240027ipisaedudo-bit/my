import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { logAudit } from '@/utils/audit';
import { formatDate, getInitials, classForStatus } from '@/utils/format';
import { ROLE_LABELS, type Employee } from '@/types';
import { User, Mail, Calendar, Building2, Briefcase, Phone, CreditCard, Lock, Moon, Sun, Shield, CheckCircle2 } from 'lucide-react';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [employee, setEmployee] = useState<(Employee & { departments: { name: string } | null; positions: { name: string } | null }) | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? '');

  useEffect(() => {
    if (user?.employee_id) {
      supabase.from('employees').select('*, departments(name), positions(name)').eq('id', user.employee_id).maybeSingle().then(({ data }) => {
        setEmployee(data as (Employee & { departments: { name: string } | null; positions: { name: string } | null }) | null);
      });
    }
  }, [user]);

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('users').update({ full_name: fullName }).eq('id', user.id);
    if (error) { showToast('Error al guardar', 'error'); setSaving(false); return; }
    await logAudit('Actualizar perfil', 'users', user.id);
    showToast('Perfil actualizado', 'success');
    setSaving(false);
    setEditing(false);
    refreshUser();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Mi Perfil</h1>

      <Card padding="lg" className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-brand-500 to-brand-600 -mx-8 -mt-8 mb-6" />
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <div className="h-20 w-20 rounded-2xl bg-brand-500/15 flex items-center justify-center text-brand-600 dark:text-brand-400 text-2xl font-bold flex-shrink-0 -mt-12 ring-4 ring-white dark:ring-ink-900">
            {getInitials(user?.full_name.split(' ')[0] ?? 'U', user?.full_name.split(' ')[1] ?? '')}
          </div>
          <div className="flex-1 pt-2">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display font-bold text-xl text-ink-900 dark:text-white">{user?.full_name}</h2>
                <p className="text-sm text-slate-500 dark:text-ink-400">@{user?.username}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{ROLE_LABELS[user?.role ?? 'employee']}</Badge>
                  {user?.is_active && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3 mr-1" />Activo</Badge>}
                </div>
              </div>
              <Button variant={editing ? 'outline' : 'secondary'} onClick={() => setEditing(!editing)}>
                {editing ? 'Cancelar' : 'Editar Perfil'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card padding="md">
          <h3 className="font-display font-bold text-ink-900 dark:text-white mb-4">Información de Cuenta</h3>
          {editing ? (
            <div className="space-y-4">
              <Input label="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Input label="Usuario" value={user?.username ?? ''} disabled />
              <Input label="Correo" value={user?.email ?? ''} disabled />
              <Button onClick={handleSaveProfile} loading={saving}>Guardar Cambios</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { icon: <User className="h-4 w-4" />, label: 'Nombre', value: user?.full_name },
                { icon: <Mail className="h-4 w-4" />, label: 'Correo', value: user?.email },
                { icon: <Shield className="h-4 w-4" />, label: 'Rol', value: ROLE_LABELS[user?.role ?? 'employee'] },
                { icon: <Calendar className="h-4 w-4" />, label: 'Último acceso', value: user?.last_login ? formatDate(user.last_login, true) : 'Nunca' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-ink-800 last:border-0">
                  <span className="text-slate-400">{f.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400">{f.label}</p>
                    <p className="text-sm font-medium text-ink-800 dark:text-ink-200">{f.value ?? '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {employee && (
          <Card padding="md">
            <h3 className="font-display font-bold text-ink-900 dark:text-white mb-4">Información Laboral</h3>
            <div className="space-y-3">
              {[
                { icon: <User className="h-4 w-4" />, label: 'Código', value: employee.code },
                { icon: <Building2 className="h-4 w-4" />, label: 'Departamento', value: employee.departments?.name },
                { icon: <Briefcase className="h-4 w-4" />, label: 'Puesto', value: employee.positions?.name },
                { icon: <Calendar className="h-4 w-4" />, label: 'Fecha de ingreso', value: formatDate(employee.hire_date) },
                { icon: <Phone className="h-4 w-4" />, label: 'Teléfono', value: employee.phone },
                { icon: <CreditCard className="h-4 w-4" />, label: 'Banco', value: employee.bank_name },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-ink-800 last:border-0">
                  <span className="text-slate-400">{f.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400">{f.label}</p>
                    <p className="text-sm font-medium text-ink-800 dark:text-ink-200">{f.value ?? '—'}</p>
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <Badge className={classForStatus(employee.status)}>{employee.status === 'active' ? 'Activo' : employee.status}</Badge>
              </div>
            </div>
          </Card>
        )}

        <Card padding="md">
          <h3 className="font-display font-bold text-ink-900 dark:text-white mb-4">Preferencias</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-ink-800/50">
              <div className="flex items-center gap-3">
                {theme === 'light' ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-violet-400" />}
                <div>
                  <p className="text-sm font-medium text-ink-800 dark:text-ink-200">Tema de la interfaz</p>
                  <p className="text-xs text-slate-400">Cambia entre modo claro y oscuro</p>
                </div>
              </div>
              <button onClick={toggleTheme} className="relative h-7 w-12 rounded-full bg-slate-200 dark:bg-brand-500 transition">
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${theme === 'dark' ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-ink-800/50">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-ink-800 dark:text-ink-200">Seguridad</p>
                  <p className="text-xs text-slate-400">Cambia tu contraseña</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => showToast('Función disponible próximamente', 'info')}>Cambiar</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
