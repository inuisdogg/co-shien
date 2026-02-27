import { supabase } from '@/lib/supabase';

interface AuditLogEntry {
  facilityId?: string;
  userId?: string;
  userName?: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'view_sensitive';
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      facility_id: entry.facilityId || null,
      user_id: entry.userId || null,
      user_name: entry.userName || null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId || null,
      details: entry.details || null,
    });
  } catch (e) {
    // Silently fail - audit logging should never break the app
    console.error('Audit log failed:', e);
  }
}
