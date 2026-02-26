'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  Clock,
  X,
  Send,
  Users,
  Search,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ---- Local types ----
interface StaffAck {
  userId: string;
  name: string;
  acknowledgedAt: string | null;
}

type FilterMode = 'all' | 'acknowledged' | 'pending';

interface RegulationAcknowledgmentPanelProps {
  regulationId: string;
  regulationTitle: string;
  onClose: () => void;
}

const ACCENT = '#00c4cc';

const RegulationAcknowledgmentPanel: React.FC<RegulationAcknowledgmentPanelProps> = ({
  regulationId,
  regulationTitle,
  onClose,
}) => {
  const { facility } = useAuth();
  const [staffList, setStaffList] = useState<StaffAck[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    if (!facility?.id) return;
    setLoading(true);
    try {
      // Fetch staff members
      const { data: staffData } = await supabase
        .from('users')
        .select('id, name, last_name, first_name')
        .eq('facility_id', facility.id)
        .eq('user_type', 'staff');

      // Fetch acknowledgments for this regulation
      const { data: ackData } = await supabase
        .from('regulation_acknowledgments')
        .select('user_id, acknowledged_at')
        .eq('regulation_id', regulationId);

      const ackMap = new Map<string, string>();
      (ackData || []).forEach((a) => {
        ackMap.set(a.user_id, a.acknowledged_at);
      });

      const list: StaffAck[] = (staffData || []).map((s) => ({
        userId: s.id,
        name: s.name || `${s.last_name || ''} ${s.first_name || ''}`.trim() || '(名前なし)',
        acknowledgedAt: ackMap.get(s.id) || null,
      }));

      // Also check employment_records for additional staff
      const { data: empData } = await supabase
        .from('employment_records')
        .select('user_id')
        .eq('facility_id', facility.id)
        .is('end_date', null);

      if (empData && empData.length > 0) {
        const existingIds = new Set(list.map((s) => s.userId));
        const missingUserIds = empData
          .map((e) => e.user_id)
          .filter((id) => !existingIds.has(id));

        if (missingUserIds.length > 0) {
          const { data: moreStaff } = await supabase
            .from('users')
            .select('id, name, last_name, first_name')
            .in('id', missingUserIds);

          (moreStaff || []).forEach((s) => {
            list.push({
              userId: s.id,
              name: s.name || `${s.last_name || ''} ${s.first_name || ''}`.trim() || '(名前なし)',
              acknowledgedAt: ackMap.get(s.id) || null,
            });
          });
        }
      }

      setStaffList(list);
    } catch (err) {
      console.error('Error fetching acknowledgment data:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id, regulationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredStaff = staffList.filter((s) => {
    if (filter === 'acknowledged' && !s.acknowledgedAt) return false;
    if (filter === 'pending' && s.acknowledgedAt) return false;
    if (search && !s.name.includes(search)) return false;
    return true;
  });

  const ackedCount = staffList.filter((s) => s.acknowledgedAt).length;
  const totalCount = staffList.length;

  const handleSendReminder = async () => {
    if (!facility?.id) return;
    setSending(true);
    try {
      const pendingUsers = staffList.filter((s) => !s.acknowledgedAt);
      // Create notifications for pending staff
      const notifications = pendingUsers.map((s) => ({
        facility_id: facility.id,
        user_id: s.userId,
        title: '規定確認のお願い',
        message: `「${regulationTitle}」の確認をお願いします。`,
        type: 'regulation_reminder',
        is_read: false,
      }));

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }
      alert(`${pendingUsers.length}名にリマインダーを送信しました。`);
    } catch (err) {
      console.error('Error sending reminders:', err);
      alert('リマインダーの送信に失敗しました。');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const FILTERS: { id: FilterMode; label: string }[] = [
    { id: 'all', label: '全員' },
    { id: 'acknowledged', label: '確認済' },
    { id: 'pending', label: '未確認' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-800 text-base">確認状況</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{regulationTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Users size={14} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">
              {ackedCount}/{totalCount}名確認済
            </span>
          </div>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: totalCount > 0 ? `${(ackedCount / totalCount) * 100}%` : '0%',
                backgroundColor: ACCENT,
              }}
            />
          </div>
        </div>

        {/* Filters + Search */}
        <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                filter === f.id
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={filter === f.id ? { backgroundColor: ACCENT } : undefined}
            >
              {f.label}
            </button>
          ))}
          <div className="flex-1 min-w-[120px] relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="名前で検索"
              className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00c4cc]"
            />
          </div>
        </div>

        {/* Staff list */}
        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${ACCENT} transparent transparent transparent` }} />
            </div>
          ) : filteredStaff.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">該当するスタッフがいません</p>
          ) : (
            <div className="space-y-1">
              {filteredStaff.map((s) => (
                <div
                  key={s.userId}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    {s.acknowledgedAt ? (
                      <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                    ) : (
                      <Clock size={16} className="text-gray-300 shrink-0" />
                    )}
                    <span className="text-sm text-gray-700">{s.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {s.acknowledgedAt ? formatDate(s.acknowledgedAt) : '未確認'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4">
          <button
            onClick={handleSendReminder}
            disabled={sending || staffList.filter((s) => !s.acknowledgedAt).length === 0}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-40"
            style={{ backgroundColor: ACCENT }}
          >
            <Send size={14} />
            {sending ? '送信中...' : 'リマインダー送信（未確認者へ）'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegulationAcknowledgmentPanel;
