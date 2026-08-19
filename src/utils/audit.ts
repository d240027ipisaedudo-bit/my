import { supabase } from '@/lib/supabase';

export async function logAudit(
  action: string,
  entity?: string,
  entity_id?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const user = session?.session?.user;
  await supabase.from('audit_log').insert({
    user_id: user?.id ?? null,
    username: user?.email ?? 'sistema',
    action,
    entity: entity ?? null,
    entity_id: entity_id ?? null,
    details: details ?? null,
  });
}

export async function fetchAuditLogs(limit = 100): Promise<{ id: string; username: string | null; action: string; entity: string | null; created_at: string }[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, username, action, entity, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as { id: string; username: string | null; action: string; entity: string | null; created_at: string }[];
}

export async function getRecentActivity(limit = 8): Promise<{ id: string; action: string; entity: string | null; username: string | null; created_at: string }[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, entity, username, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as { id: string; action: string; entity: string | null; username: string | null; created_at: string }[];
}
