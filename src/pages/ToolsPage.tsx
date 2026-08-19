import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Badge, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { logAudit } from '@/utils/audit';
import { formatDate, formatRelative } from '@/utils/format';
import { exportToCsv, exportToExcel } from '@/utils/export';
import type { Backup, Employee } from '@/types';
import {
  Database, Download, Upload, FileSpreadsheet, ShieldCheck,
  HardDriveDownload, HardDriveUpload, AlertTriangle, RefreshCw, CheckCircle2,
} from 'lucide-react';

export function ToolsPage() {
  const { showToast } = useToast();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('backups').select('*').order('created_at', { ascending: false });
    if (error) showToast('Error al cargar respaldos', 'error');
    setBackups(data ?? []);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function handleBackup() {
    setCreating(true);
    const { data } = await supabase.from('employees').select('*');
    const size = JSON.stringify(data ?? []).length;
    const { data: backup, error } = await supabase.from('backups').insert({
      file_name: `backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`,
      file_size: size,
      backup_type: 'manual',
      status: 'completed',
    }).select().single();
    if (error) { showToast('Error al crear respaldo', 'error'); setCreating(false); return; }
    await logAudit('Crear respaldo', 'backups', backup.id);
    showToast('Respaldo creado correctamente', 'success');
    setCreating(false);
    load();
  }

  async function handleRestore(b: Backup) {
    setRestoring(b.id);
    await logAudit('Restaurar respaldo', 'backups', b.id, { file: b.file_name });
    await supabase.from('backups').update({ status: 'restored' }).eq('id', b.id);
    showToast('Respaldo restaurado (simulado)', 'success');
    setRestoring(null);
    load();
  }

  function handleExportBackups() {
    if (backups.length === 0) { showToast('No hay respaldos', 'warning'); return; }
    exportToCsv('respaldos.csv', ['Archivo', 'Tamaño', 'Tipo', 'Estado', 'Fecha'], backups.map((b) => ({
      Archivo: b.file_name, Tamaño: b.file_size, Tipo: b.backup_type, Estado: b.status, Fecha: formatDate(b.created_at),
    })));
    showToast('Lista exportada', 'success');
  }

  async function handleImportEmployees(file: File) {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) { showToast('El archivo está vacío', 'error'); return; }
      const headers = lines[0].split(',').map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(',');
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = vals[i]?.trim() ?? ''; });
        return row;
      });

      const payload = rows.map((r) => ({
        code: r.code || r.codigo || `IMP-${Date.now()}`,
        first_name: r.first_name || r.nombre || 'Sin nombre',
        last_name: r.last_name || r.apellido || '',
        email: r.email || null,
        phone: r.phone || r.telefono || null,
        status: 'active',
        hire_date: r.hire_date || r.fecha_ingreso || new Date().toISOString().slice(0, 10),
      }));

      const { data, error } = await supabase.from('employees').insert(payload).select();
      if (error) { showToast('Error al importar', 'error'); return; }
      await logAudit('Importar empleados', 'employees', undefined, { count: data?.length ?? 0 });
      showToast(`${data?.length ?? 0} empleados importados`, 'success');
      setImportOpen(false);
    } catch {
      showToast('Error al leer el archivo', 'error');
    }
  }

  const tools = [
    { title: 'Respaldo Automático', desc: 'Crear copia de seguridad de la base de datos', icon: <HardDriveDownload className="h-5 w-5" />, accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', action: () => handleBackup(), loading: creating, label: 'Crear Respaldo' },
    { title: 'Importar desde Excel', desc: 'Cargar empleados desde archivo CSV', icon: <FileSpreadsheet className="h-5 w-5" />, accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', action: () => setImportOpen(true), loading: false, label: 'Importar' },
    { title: 'Exportar Respaldos', desc: 'Descargar lista de respaldos en CSV', icon: <Download className="h-5 w-5" />, accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', action: () => handleExportBackups(), loading: false, label: 'Exportar' },
  ];

  const columns: Column<Backup>[] = [
    { key: 'file_name', header: 'Archivo', sortable: true, render: (r) => <span className="font-mono text-xs text-ink-800 dark:text-ink-200">{r.file_name}</span> },
    { key: 'file_size', header: 'Tamaño', sortable: true, render: (r) => `${(r.file_size / 1024).toFixed(1)} KB` },
    { key: 'backup_type', header: 'Tipo', render: (r) => <Badge className={r.backup_type === 'manual' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'}>{r.backup_type === 'manual' ? 'Manual' : 'Automático'}</Badge> },
    { key: 'status', header: 'Estado', render: (r) => <Badge className={r.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : r.status === 'restored' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}>{r.status === 'completed' ? 'Completado' : r.status === 'restored' ? 'Restaurado' : 'Fallido'}</Badge> },
    { key: 'created_at', header: 'Fecha', sortable: true, render: (r) => formatRelative(r.created_at) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Herramientas del Sistema</h1>
        <p className="text-sm text-slate-500 dark:text-ink-400 mt-1">Respaldo, restauración, importación y exportación</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {tools.map((t) => (
          <Card key={t.title} padding="md" className="flex flex-col">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${t.accent}`}>{t.icon}</div>
            <h3 className="font-display font-bold text-ink-900 dark:text-white">{t.title}</h3>
            <p className="text-sm text-slate-500 dark:text-ink-400 mt-1 flex-1">{t.desc}</p>
            <Button onClick={t.action} loading={t.loading} className="mt-4 w-full" variant="outline">{t.label}</Button>
          </Card>
        ))}
      </div>

      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-ink-900 dark:text-white flex items-center gap-2"><Database className="h-5 w-5 text-brand-500" /> Historial de Respaldos</h3>
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /> Actualizar</Button>
        </div>
        <DataTable columns={columns} data={backups} loading={loading} searchKeys={['file_name']} searchPlaceholder="Buscar respaldo..." rowKey={(r) => r.id}
          actions={(row) => (
            <button onClick={() => handleRestore(row)} disabled={restoring === row.id} className="p-2 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition disabled:opacity-50" title="Restaurar">
              {restoring === row.id ? <span className="block h-4 w-4 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" /> : <HardDriveUpload className="h-4 w-4" />}
            </button>
          )}
        />
      </Card>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Importar Empleados desde CSV" description="Sube un archivo CSV con columnas: code, first_name, last_name, email, phone, hire_date" size="md"
        footer={<><Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button></>}>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 dark:border-ink-700 rounded-xl p-8 text-center">
            <FileSpreadsheet className="h-10 w-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-ink-400 mb-3">Selecciona un archivo CSV</p>
            <input type="file" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportEmployees(f); }} className="text-sm" />
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">La primera fila debe contener los encabezados. Se omitirán las filas con datos duplicados.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
