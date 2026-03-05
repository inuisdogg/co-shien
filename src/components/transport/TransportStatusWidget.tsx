'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Bus, MapPin, Clock, CheckCircle2, Radio } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type SessionRow = {
  id: string; mode: 'pickup' | 'dropoff';
  status: 'preparing' | 'active' | 'completed' | 'cancelled';
  driver_staff_id: string | null;
  route_stops: Array<{ order: number; childName: string }>;
  current_stop_index: number; started_at: string | null;
};

type WidgetSession = {
  id: string; mode: 'pickup' | 'dropoff';
  status: 'preparing' | 'active'; driverStaffId: string | null;
  driverName: string | null; totalStops: number;
  completedStops: number; startedAt: string | null;
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  preparing: { label: '準備中', cls: 'bg-yellow-100 text-yellow-700' },
  active: { label: '進行中', cls: 'bg-green-100 text-green-700' },
};

function mapRow(r: SessionRow): Omit<WidgetSession, 'driverName'> {
  const stops = r.route_stops || [];
  return { id: r.id, mode: r.mode, status: r.status as WidgetSession['status'],
    driverStaffId: r.driver_staff_id, totalStops: stops.length,
    completedStops: Math.min(r.current_stop_index ?? 0, stops.length), startedAt: r.started_at };
}

function fmtTime(s: string | null): string {
  if (!s) return '--:--';
  const d = new Date(s);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface TransportStatusWidgetProps { facilityId: string }

export default function TransportStatusWidget({ facilityId }: TransportStatusWidgetProps) {
  const [sessions, setSessions] = useState<WidgetSession[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { toast } = useToast();
  const today = new Date().toISOString().split('T')[0];

  // Fetch active/preparing sessions + resolve driver names
  useEffect(() => {
    if (!facilityId) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('transport_sessions')
          .select('id, mode, status, driver_staff_id, route_stops, current_stop_index, started_at')
          .eq('facility_id', facilityId).eq('date', today)
          .in('status', ['active', 'preparing']);
        if (!data) { setSessions([]); setLoading(false); return; }

        const mapped = (data as SessionRow[]).map(mapRow);
        const driverIds = [...new Set(mapped.map(s => s.driverStaffId).filter(Boolean))] as string[];
        let driverMap: Record<string, string> = {};
        if (driverIds.length > 0) {
          // staffテーブルから取得
          const staffIds = driverIds.filter(id => !id.startsWith('emp-'));
          const empIds = driverIds.filter(id => id.startsWith('emp-')).map(id => id.replace('emp-', ''));
          if (staffIds.length > 0) {
            const { data: staffRows } = await supabase.from('staff').select('id, name').in('id', staffIds);
            if (staffRows) staffRows.forEach(u => { driverMap[u.id] = u.name; });
          }
          // employment_records経由のスタッフ
          if (empIds.length > 0) {
            const { data: empRows } = await supabase.from('employment_records').select('id, users!inner(last_name, first_name)').in('id', empIds);
            if (empRows) empRows.forEach((r: any) => { driverMap[`emp-${r.id}`] = `${r.users?.last_name || ''}${r.users?.first_name || ''}`; });
          }
        }
        setSessions(mapped.map(s => ({
          ...s, driverName: s.driverStaffId ? (driverMap[s.driverStaffId] || null) : null,
        })));
      } catch (err) {
        console.error('送迎ステータス取得エラー:', err);
        toast.error('送迎ステータスの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [facilityId, today]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!facilityId) return;
    const channel = supabase
      .channel(`transport_widget:${facilityId}:${today}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'transport_sessions',
        filter: `facility_id=eq.${facilityId}`,
      }, (payload) => {
        const row = (payload.new || {}) as SessionRow;
        if (!row.id) return;
        // Remove completed/cancelled sessions from widget
        if (row.status === 'completed' || row.status === 'cancelled') {
          setSessions(prev => prev.filter(s => s.id !== row.id));
          return;
        }
        if (row.status !== 'active' && row.status !== 'preparing') return;
        const updated = mapRow(row);
        setSessions(prev => {
          const idx = prev.findIndex(s => s.id === updated.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...prev[idx], ...updated, driverName: prev[idx].driverName };
            return next;
          }
          return [...prev, { ...updated, driverName: null }];
        });
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [facilityId, today]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-40" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Bus className="w-4 h-4" />
          <span className="text-sm">本日の送迎なし</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map(session => {
        const pct = session.totalStops > 0
          ? Math.round((session.completedStops / session.totalStops) * 100) : 0;
        const cfg = STATUS_CFG[session.status] || STATUS_CFG.preparing;
        return (
          <div key={session.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
            {/* Mode icon + label + status badge */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10">
                  <Bus className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-bold text-gray-800">
                  {session.mode === 'pickup' ? 'お迎え' : 'お送り'}
                </span>
                {session.status === 'active' && (
                  <Radio className="w-3.5 h-3.5 text-green-500 animate-pulse" />
                )}
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>
                {cfg.label}
              </span>
            </div>
            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {session.completedStops}/{session.totalStops}箇所完了
                </span>
                <span>{pct}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: '#00c4cc' }} />
              </div>
            </div>
            {/* Driver name + start time */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{session.driverName ? `担当: ${session.driverName}` : '担当: 未割当'}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />{fmtTime(session.startedAt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
