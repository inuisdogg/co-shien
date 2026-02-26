/**
 * 実績記録と連絡帳 - ダッシュボード
 * 実績記録（内部業務記録）と連絡帳（保護者向け通信）を明確に分離
 * 完了状況のトラッキングと過去未記録の管理
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
  FileText,
  MessageSquare,
  Utensils,
  Heart,
  Smile,
  Moon,
  Droplet,
  Save,
  Loader2,
  AlertTriangle,
  Mail,
  PenLine,
  Filter,
  ArrowLeft,
  Send,
} from 'lucide-react';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useAuth } from '@/contexts/AuthContext';
import { ScheduleItem, UsageRecord, ContactLog, ContactLogFormData } from '@/types';
import UsageRecordForm from '@/components/schedule/UsageRecordForm';
import { supabase } from '@/lib/supabase';

// フェーズ設定
const FEATURE_PHASE = parseInt(process.env.NEXT_PUBLIC_FEATURE_PHASE || '1', 10);

// 体調・機嫌・食欲のラベル
const HEALTH_LABELS: Record<string, { label: string; color: string }> = {
  excellent: { label: '良好', color: 'bg-green-100 text-green-700' },
  good: { label: '普通', color: 'bg-blue-100 text-blue-700' },
  fair: { label: 'やや不良', color: 'bg-yellow-100 text-yellow-700' },
  poor: { label: '不良', color: 'bg-red-100 text-red-700' },
};

const MOOD_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  very_happy: { label: 'とても元気', emoji: '😄', color: 'bg-green-100 text-green-700' },
  happy: { label: '元気', emoji: '😊', color: 'bg-blue-100 text-blue-700' },
  neutral: { label: '普通', emoji: '😐', color: 'bg-gray-100 text-gray-700' },
  sad: { label: 'やや元気なし', emoji: '😔', color: 'bg-yellow-100 text-yellow-700' },
  upset: { label: '元気なし', emoji: '😢', color: 'bg-red-100 text-red-700' },
};

const APPETITE_LABELS: Record<string, { label: string; color: string }> = {
  excellent: { label: '完食', color: 'bg-green-100 text-green-700' },
  good: { label: 'ほぼ完食', color: 'bg-blue-100 text-blue-700' },
  fair: { label: '半分程度', color: 'bg-yellow-100 text-yellow-700' },
  poor: { label: '少量', color: 'bg-orange-100 text-orange-700' },
  none: { label: '食べず', color: 'bg-red-100 text-red-700' },
};

// ビュー状態の型
type ViewState =
  | { type: 'dashboard' }
  | { type: 'usage-list'; date: string }
  | { type: 'usage-form'; schedule: ScheduleItem }
  | { type: 'contact-list'; date: string }
  | { type: 'contact-form'; schedule: ScheduleItem };

// フィルタータイプ
type FilterType = 'all' | 'usage-incomplete' | 'contact-incomplete' | 'all-complete';

// 児童ごとの完了状態
type ChildDayStatus = {
  schedule: ScheduleItem;
  usageRecord: UsageRecord | undefined;
  contactLog: ContactLog | undefined;
  hasRecord: boolean;
  hasContact: boolean;
  isSigned: boolean;
};

// 日別のサマリー
type DaySummary = {
  total: number;
  recordCompleted: number;
  contactCompleted: number;
  contactSigned: number;
  children: ChildDayStatus[];
};

export default function DailyLogView() {
  const { facility } = useAuth();
  const {
    schedules,
    children: facilityChildren,
    usageRecords,
    contactLogs,
    timeSlots,
    getUsageRecordByScheduleId,
    getContactLogByScheduleId,
    addUsageRecord,
    updateUsageRecord,
    deleteUsageRecord,
    addContactLog,
    updateContactLog,
    deleteContactLog,
  } = useFacilityData();

  // 時間枠の名前を動的に取得
  const slotInfo = useMemo(() => {
    if (timeSlots.length >= 2) {
      const sorted = [...timeSlots].sort((a, b) => a.displayOrder - b.displayOrder);
      return {
        AM: { name: sorted[0]?.name || '午前' },
        PM: { name: sorted[1]?.name || '午後' },
      };
    } else if (timeSlots.length === 1) {
      return {
        AM: { name: timeSlots[0].name || '終日' },
        PM: null,
      };
    }
    return {
      AM: { name: '午前' },
      PM: { name: '午後' },
    };
  }, [timeSlots]);

  // UI状態
  const [viewState, setViewState] = useState<ViewState>({ type: 'dashboard' });
  const [dashboardTab, setDashboardTab] = useState<'usage' | 'contact'>('usage');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [contactFormData, setContactFormData] = useState<Partial<ContactLogFormData>>({});
  const [signerName, setSignerName] = useState('');
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [signTargetScheduleId, setSignTargetScheduleId] = useState<string | null>(null);

  // 今日の日付文字列
  const todayStr = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  // 日付フォーマットヘルパー
  const formatDate = useCallback((dateStr: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${m}月${d}日(${days[date.getDay()]})`;
  }, []);

  const formatDateFull = useCallback((dateStr: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${y}年${m}月${d}日(${days[date.getDay()]})`;
  }, []);

  // 各日のスケジュールと実績・連絡帳状況
  const dayStatusMap = useMemo(() => {
    const map: Record<string, DaySummary> = {};

    schedules.forEach(schedule => {
      if (!map[schedule.date]) {
        map[schedule.date] = { total: 0, recordCompleted: 0, contactCompleted: 0, contactSigned: 0, children: [] };
      }
      const usageRecord = getUsageRecordByScheduleId(schedule.id);
      const contactLog = getContactLogByScheduleId(schedule.id);
      const hasRecord = !!usageRecord;
      const hasContact = !!contactLog;
      const isSigned = !!(contactLog?.isSigned);
      map[schedule.date].total++;
      if (hasRecord) map[schedule.date].recordCompleted++;
      if (hasContact) map[schedule.date].contactCompleted++;
      if (isSigned) map[schedule.date].contactSigned++;
      map[schedule.date].children.push({ schedule, usageRecord, contactLog, hasRecord, hasContact, isSigned });
    });

    // 名前順でソート
    Object.values(map).forEach(day => {
      day.children.sort((a, b) => {
        if (a.schedule.slot !== b.schedule.slot) {
          return a.schedule.slot === 'AM' ? -1 : 1;
        }
        return a.schedule.childName.localeCompare(b.schedule.childName, 'ja');
      });
    });

    return map;
  }, [schedules, getUsageRecordByScheduleId, getContactLogByScheduleId]);

  // 今日の概要
  const todayInfo = dayStatusMap[todayStr];
  const todayTotal = todayInfo?.total || 0;
  const todayRecordCompleted = todayInfo?.recordCompleted || 0;
  const todayContactCompleted = todayInfo?.contactCompleted || 0;
  const todayContactSigned = todayInfo?.contactSigned || 0;

  // 過去の未記録を集計（過去7日分をチェック）
  const overdueItems = useMemo(() => {
    const items: { date: string; usageIncomplete: number; contactIncomplete: number }[] = [];
    const today = new Date();

    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayInfo = dayStatusMap[dateStr];
      if (dayInfo && dayInfo.total > 0) {
        const usageIncomplete = dayInfo.total - dayInfo.recordCompleted;
        const contactIncomplete = dayInfo.total - dayInfo.contactCompleted;
        if (usageIncomplete > 0 || contactIncomplete > 0) {
          items.push({ date: dateStr, usageIncomplete, contactIncomplete });
        }
      }
    }

    return items;
  }, [dayStatusMap, todayStr]);

  const totalOverdueUsage = overdueItems.reduce((sum, i) => sum + i.usageIncomplete, 0);
  const totalOverdueContact = overdueItems.reduce((sum, i) => sum + i.contactIncomplete, 0);
  const totalOverdue = totalOverdueUsage + totalOverdueContact;

  // 日数計算（色分け用）
  const getDaysOverdue = useCallback((dateStr: string): number => {
    const today = new Date(todayStr);
    const target = new Date(dateStr);
    const diffMs = today.getTime() - target.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }, [todayStr]);

  // フィルターされた児童一覧
  const getFilteredChildren = useCallback((date: string): ChildDayStatus[] => {
    const dayInfo = dayStatusMap[date];
    if (!dayInfo) return [];

    switch (filterType) {
      case 'usage-incomplete':
        return dayInfo.children.filter(c => !c.hasRecord);
      case 'contact-incomplete':
        return dayInfo.children.filter(c => !c.hasContact);
      case 'all-complete':
        return dayInfo.children.filter(c => c.hasRecord && c.hasContact);
      default:
        return dayInfo.children;
    }
  }, [dayStatusMap, filterType]);

  // 児童のイニシャルアバター生成
  const getInitials = (name: string): string => {
    return name.slice(0, 1);
  };

  // 実績保存
  const handleSaveUsageRecord = async (data: any) => {
    const schedule = viewState.type === 'usage-form' ? viewState.schedule : null;
    if (!schedule) return;

    try {
      const existingRecord = getUsageRecordByScheduleId(schedule.id);
      if (existingRecord) {
        await updateUsageRecord(existingRecord.id, data);
      } else {
        await addUsageRecord(data);
      }
    } catch (error) {
      console.error('実績保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  // 実績削除
  const handleDeleteUsageRecord = async () => {
    const schedule = viewState.type === 'usage-form' ? viewState.schedule : null;
    if (!schedule) return;

    const existingRecord = getUsageRecordByScheduleId(schedule.id);
    if (existingRecord) {
      if (confirm('この実績を削除しますか？')) {
        try {
          await deleteUsageRecord(existingRecord.id);
        } catch (error) {
          console.error('削除エラー:', error);
          alert('削除に失敗しました');
        }
      }
    }
  };

  // 連絡帳フォーム初期化
  const initContactForm = useCallback((schedule: ScheduleItem) => {
    const existingContactLog = getContactLogByScheduleId(schedule.id);
    if (existingContactLog) {
      setContactFormData({
        activities: existingContactLog.activities || '',
        healthStatus: existingContactLog.healthStatus,
        mood: existingContactLog.mood,
        appetite: existingContactLog.appetite,
        mealMain: existingContactLog.mealMain,
        mealSide: existingContactLog.mealSide,
        mealNotes: existingContactLog.mealNotes || '',
        toiletCount: existingContactLog.toiletCount || 0,
        toiletNotes: existingContactLog.toiletNotes || '',
        napStartTime: existingContactLog.napStartTime || '',
        napEndTime: existingContactLog.napEndTime || '',
        napNotes: existingContactLog.napNotes || '',
        staffComment: existingContactLog.staffComment || '',
        parentMessage: existingContactLog.parentMessage || '',
        status: existingContactLog.status || 'draft',
      });
    } else {
      setContactFormData({
        activities: '',
        mealMain: false,
        mealSide: false,
        mealNotes: '',
        toiletCount: 0,
        toiletNotes: '',
        napStartTime: '',
        napEndTime: '',
        napNotes: '',
        staffComment: '',
        parentMessage: '',
        status: 'draft',
      });
    }
  }, [getContactLogByScheduleId]);

  // 連絡帳保存 (下書き or 送信)
  const handleSaveContactLog = async (mode: 'draft' | 'submit' = 'draft') => {
    const schedule = viewState.type === 'contact-form' ? viewState.schedule : null;
    if (!schedule) return;

    setIsSaving(true);
    try {
      const existingContactLog = getContactLogByScheduleId(schedule.id);
      const status = mode === 'submit' ? 'submitted' : 'draft';
      const data: ContactLogFormData = {
        childId: schedule.childId,
        scheduleId: schedule.id,
        date: schedule.date,
        slot: schedule.slot as 'AM' | 'PM',
        status,
        ...contactFormData,
      };

      if (existingContactLog) {
        await updateContactLog(existingContactLog.id, { ...data, status });
      } else {
        await addContactLog({ ...data, status });
      }

      // When submitting to parent, create a notification record
      if (mode === 'submit') {
        try {
          const currentFacilityId = facility?.id || existingContactLog?.facilityId || '';
          // Look up the child's owner (parent user)
          const { data: childData } = await supabase
            .from('children')
            .select('owner_profile_id, name')
            .eq('id', schedule.childId)
            .single();

          if (childData?.owner_profile_id && currentFacilityId) {
            await supabase.from('notifications').insert({
              id: `notif-contact-${schedule.id}-${Date.now()}`,
              facility_id: currentFacilityId,
              user_id: childData.owner_profile_id,
              type: 'contact_book_submitted',
              title: '連絡帳が届きました',
              message: `${childData.name}さんの${schedule.date}の連絡帳が届きました。内容を確認して署名してください。`,
              is_read: false,
            });
          }
        } catch (notifErr) {
          console.error('通知作成エラー:', notifErr);
          // Notification failure should not block the save
        }
        alert('連絡帳を保護者に送信しました');
      } else {
        alert('連絡帳を下書き保存しました');
      }
      // リストに戻る
      setViewState({ type: 'contact-list', date: schedule.date });
    } catch (error) {
      console.error('連絡帳保存エラー:', error);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // CloudSign（署名）処理
  const handleSign = async (scheduleId: string) => {
    setSignTargetScheduleId(scheduleId);
    setSignerName('');
    setShowSignDialog(true);
  };

  const confirmSign = async () => {
    if (!signTargetScheduleId || !signerName.trim()) return;

    setIsSaving(true);
    try {
      const contactLog = getContactLogByScheduleId(signTargetScheduleId);
      if (contactLog) {
        await updateContactLog(contactLog.id, {
          isSigned: true,
          signedAt: new Date().toISOString(),
          signatureData: signerName.trim(),
        } as any);
      }
      setShowSignDialog(false);
      setSignTargetScheduleId(null);
      setSignerName('');
    } catch (error) {
      console.error('署名エラー:', error);
      alert('署名に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // ナビゲーションヘルパー
  const goToDashboard = () => {
    setViewState({ type: 'dashboard' });
    setFilterType('all');
  };

  const goToUsageList = (date: string) => {
    setViewState({ type: 'usage-list', date });
  };

  const goToContactList = (date: string) => {
    setViewState({ type: 'contact-list', date });
  };

  // バッチモード用: 未完了の次の児童に移動
  const goToNextIncompleteUsage = (currentSchedule: ScheduleItem) => {
    const dayInfo = dayStatusMap[currentSchedule.date];
    if (!dayInfo) return;
    const incompleteChildren = dayInfo.children.filter(c => !c.hasRecord);
    const currentIndex = incompleteChildren.findIndex(c => c.schedule.id === currentSchedule.id);
    if (currentIndex < incompleteChildren.length - 1) {
      const nextSchedule = incompleteChildren[currentIndex + 1].schedule;
      setViewState({ type: 'usage-form', schedule: nextSchedule });
    } else {
      setViewState({ type: 'usage-list', date: currentSchedule.date });
    }
  };

  const goToNextIncompleteContact = (currentSchedule: ScheduleItem) => {
    const dayInfo = dayStatusMap[currentSchedule.date];
    if (!dayInfo) return;
    const incompleteChildren = dayInfo.children.filter(c => !c.hasContact);
    const currentIndex = incompleteChildren.findIndex(c => c.schedule.id === currentSchedule.id);
    if (currentIndex < incompleteChildren.length - 1) {
      const nextSchedule = incompleteChildren[currentIndex + 1].schedule;
      initContactForm(nextSchedule);
      setViewState({ type: 'contact-form', schedule: nextSchedule });
    } else {
      setViewState({ type: 'contact-list', date: currentSchedule.date });
    }
  };

  // 署名確認ダイアログ
  const SignDialog = () => {
    if (!showSignDialog) return null;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <PenLine className="w-5 h-5 text-[#00c4cc]" />
              保護者署名（CloudSign）
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-[13px] text-gray-600">
              連絡帳の内容を確認の上、保護者名を入力して署名してください。
            </p>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">署名者名</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-[13px]"
                placeholder="保護者のお名前を入力"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowSignDialog(false); setSignTargetScheduleId(null); }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={confirmSign}
                disabled={!signerName.trim() || isSaving}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-[#00c4cc] hover:bg-[#00b0b8] rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PenLine className="w-4 h-4" />
                )}
                署名する
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ステータスバッジコンポーネント
  const StatusBadge = ({ hasRecord, hasContact, isSigned, mode, contactStatus }: {
    hasRecord: boolean;
    hasContact: boolean;
    isSigned: boolean;
    mode: 'usage' | 'contact';
    contactStatus?: string;
  }) => {
    if (mode === 'usage') {
      return hasRecord ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-medium">
          <CheckCircle className="w-3 h-3" /> 完了
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[11px] font-medium">
          <Clock className="w-3 h-3" /> 未記録
        </span>
      );
    }
    // contact mode: status-based badges
    if (contactStatus === 'signed' || isSigned) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-medium">
          <CheckCircle className="w-3 h-3" /> 署名済
        </span>
      );
    }
    if (contactStatus === 'submitted') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[11px] font-medium">
          <Send className="w-3 h-3" /> 送信済
        </span>
      );
    }
    if (hasContact && contactStatus === 'draft') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[11px] font-medium">
          <PenLine className="w-3 h-3" /> 下書き
        </span>
      );
    }
    if (hasContact) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[11px] font-medium">
          <PenLine className="w-3 h-3" /> 署名待ち
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[11px] font-medium">
        <Clock className="w-3 h-3" /> 未記録
      </span>
    );
  };

  // 過日の色分け
  const getOverdueColor = (dateStr: string): string => {
    const days = getDaysOverdue(dateStr);
    if (days >= 2) return 'border-red-300 bg-red-50';
    if (days >= 1) return 'border-amber-300 bg-amber-50';
    return 'border-gray-100 bg-white';
  };

  const getOverdueTextColor = (dateStr: string): string => {
    const days = getDaysOverdue(dateStr);
    if (days >= 2) return 'text-red-600';
    if (days >= 1) return 'text-amber-600';
    return 'text-gray-600';
  };

  // ==== ダッシュボード表示 ====
  if (viewState.type === 'dashboard') {
    return (
      <div className="space-y-5">
        <SignDialog />

        {/* ヘッダー */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#00c4cc] to-[#00b0b8] px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-6 h-6" />
                  実績と連絡帳
                </h1>
                <p className="text-white/80 text-sm mt-1">
                  {formatDateFull(todayStr)}
                </p>
              </div>
              <div className="text-right">
                <div className="text-white/80 text-xs">本日の利用者</div>
                <div className="text-3xl font-bold text-white">{todayTotal}<span className="text-base font-normal ml-1">名</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* 過去未記録バナー */}
        {totalOverdue > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">
                  {totalOverdue}件の未記録があります
                </p>
                <div className="mt-2 space-y-1">
                  {overdueItems.map(item => (
                    <div key={item.date} className="flex items-center gap-2 text-[13px]">
                      <span className={`font-medium ${getOverdueTextColor(item.date)}`}>
                        {formatDate(item.date)}:
                      </span>
                      {item.usageIncomplete > 0 && (
                        <button
                          onClick={() => goToUsageList(item.date)}
                          className="text-red-600 hover:text-red-800 underline"
                        >
                          実績{item.usageIncomplete}件
                        </button>
                      )}
                      {item.usageIncomplete > 0 && item.contactIncomplete > 0 && (
                        <span className="text-red-400">/</span>
                      )}
                      {item.contactIncomplete > 0 && (
                        <button
                          onClick={() => goToContactList(item.date)}
                          className="text-red-600 hover:text-red-800 underline"
                        >
                          連絡帳{item.contactIncomplete}件
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* タブ切り替え: 実績記録 / 連絡帳 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setDashboardTab('usage')}
              className={`flex-1 px-6 py-3.5 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                dashboardTab === 'usage'
                  ? 'text-[#00c4cc] border-b-2 border-[#00c4cc] bg-[#00c4cc]/5'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              実績記録
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                todayRecordCompleted === todayTotal && todayTotal > 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {todayRecordCompleted}/{todayTotal}
              </span>
            </button>
            <button
              onClick={() => setDashboardTab('contact')}
              className={`flex-1 px-6 py-3.5 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                dashboardTab === 'contact'
                  ? 'text-[#00c4cc] border-b-2 border-[#00c4cc] bg-[#00c4cc]/5'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              連絡帳
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                todayContactCompleted === todayTotal && todayTotal > 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {todayContactCompleted}/{todayTotal}
              </span>
            </button>
          </div>

          {/* セクション説明 */}
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            {dashboardTab === 'usage' ? (
              <p className="text-xs text-gray-500">
                サービス提供の内部業務記録です。当日または後日まとめて記載できます。
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                保護者向けの連絡帳です。記入後、保護者の電子署名（CloudSign）が必要です。
              </p>
            )}
          </div>

          {/* 本日のクイックアクション */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">
                本日 - {formatDate(todayStr)}
              </h3>
              <button
                onClick={() => dashboardTab === 'usage' ? goToUsageList(todayStr) : goToContactList(todayStr)}
                className="text-xs font-medium text-[#00c4cc] hover:text-[#00b0b8] transition-colors"
              >
                一覧を開く →
              </button>
            </div>

            {/* フィルター */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {([
                { key: 'all' as FilterType, label: '全員' },
                { key: 'usage-incomplete' as FilterType, label: '実績未完了' },
                { key: 'contact-incomplete' as FilterType, label: '連絡帳未完了' },
                { key: 'all-complete' as FilterType, label: '全て完了' },
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterType(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filterType === f.key
                      ? 'bg-[#00c4cc] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* 児童グリッド */}
            {todayTotal === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">本日の利用予約はありません</p>
              </div>
            ) : (
              <div className="space-y-2">
                {getFilteredChildren(todayStr).map(({ schedule, hasRecord, hasContact, isSigned, contactLog }) => (
                  <div
                    key={schedule.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-all"
                  >
                    {/* アバター */}
                    <div className="w-9 h-9 rounded-full bg-[#00c4cc]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#00c4cc]">{getInitials(schedule.childName)}</span>
                    </div>

                    {/* 名前 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800 truncate">{schedule.childName}</p>
                      <p className="text-[11px] text-gray-400">
                        {schedule.slot === 'AM' ? slotInfo.AM.name : (slotInfo.PM?.name || '午後')}
                      </p>
                    </div>

                    {/* ステータス */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge hasRecord={hasRecord} hasContact={hasContact} isSigned={isSigned} mode="usage" contactStatus={contactLog?.status} />
                      <StatusBadge hasRecord={hasRecord} hasContact={hasContact} isSigned={isSigned} mode="contact" contactStatus={contactLog?.status} />
                    </div>

                    {/* アクション */}
                    <button
                      onClick={() => {
                        if (dashboardTab === 'usage') {
                          setViewState({ type: 'usage-form', schedule });
                        } else {
                          initContactForm(schedule);
                          setViewState({ type: 'contact-form', schedule });
                        }
                      }}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-[#00c4cc] bg-[#00c4cc]/10 hover:bg-[#00c4cc]/20 rounded-lg transition-colors"
                    >
                      {dashboardTab === 'usage'
                        ? (hasRecord ? '編集' : '記録')
                        : (hasContact ? '編集' : '記入')
                      }
                    </button>
                  </div>
                ))}

                {getFilteredChildren(todayStr).length === 0 && (
                  <div className="text-center py-6 text-gray-400">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-300" />
                    <p className="text-sm">条件に該当する児童はいません</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 過去日リンク */}
          {overdueItems.length > 0 && (
            <div className="border-t border-gray-100 px-5 py-4">
              <h4 className="text-xs font-bold text-gray-500 mb-3">過去の未記録</h4>
              <div className="space-y-2">
                {overdueItems.slice(0, 5).map(item => {
                  const daysAgo = getDaysOverdue(item.date);
                  return (
                    <div
                      key={item.date}
                      className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${getOverdueColor(item.date)}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] font-medium ${getOverdueTextColor(item.date)}`}>
                          {formatDate(item.date)}
                        </span>
                        <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                          daysAgo >= 2 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {daysAgo}日前
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {dashboardTab === 'usage' && item.usageIncomplete > 0 && (
                          <button
                            onClick={() => goToUsageList(item.date)}
                            className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                              daysAgo >= 2
                                ? 'text-red-700 bg-red-100 hover:bg-red-200'
                                : 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                            }`}
                          >
                            実績 {item.usageIncomplete}件 →
                          </button>
                        )}
                        {dashboardTab === 'contact' && item.contactIncomplete > 0 && (
                          <button
                            onClick={() => goToContactList(item.date)}
                            className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                              daysAgo >= 2
                                ? 'text-red-700 bg-red-100 hover:bg-red-200'
                                : 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                            }`}
                          >
                            連絡帳 {item.contactIncomplete}件 →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==== 実績記録一覧 ====
  if (viewState.type === 'usage-list') {
    const { date } = viewState;
    const dayInfo = dayStatusMap[date];
    const children = getFilteredChildren(date);
    const daysAgo = getDaysOverdue(date);

    return (
      <div className="space-y-5">
        {/* ヘッダー */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#00c4cc] to-[#00b0b8] px-6 py-4">
            <div className="flex items-center gap-3">
              <button onClick={goToDashboard} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="flex-1">
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  実績記録
                </h1>
                <p className="text-white/80 text-sm mt-0.5 flex items-center gap-2">
                  {formatDateFull(date)}
                  {daysAgo > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      daysAgo >= 2 ? 'bg-red-500/80 text-white' : 'bg-amber-500/80 text-white'
                    }`}>
                      {daysAgo}日前
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right text-white">
                <div className="text-[11px] opacity-80">完了</div>
                <div className="text-xl font-bold">
                  {dayInfo?.recordCompleted || 0}/{dayInfo?.total || 0}
                </div>
              </div>
            </div>
          </div>

          {/* フィルター */}
          <div className="flex gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50 flex-wrap">
            {([
              { key: 'all' as FilterType, label: '全員' },
              { key: 'usage-incomplete' as FilterType, label: '未完了のみ' },
              { key: 'all-complete' as FilterType, label: '完了のみ' },
            ]).map(f => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterType === f.key
                    ? 'bg-[#00c4cc] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 児童一覧 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {!dayInfo || dayInfo.total === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>この日の利用予約はありません</p>
            </div>
          ) : children.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-300" />
              <p className="text-sm">条件に該当する児童はいません</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* スロット別表示 */}
              {['AM', 'PM'].map(slot => {
                const slotChildren = children.filter(c => c.schedule.slot === slot);
                if (slotChildren.length === 0) return null;
                const slotName = slot === 'AM' ? slotInfo.AM.name : (slotInfo.PM?.name || '午後');

                return (
                  <div key={slot}>
                    <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100">
                      <span className={`text-xs font-bold ${slot === 'AM' ? 'text-blue-600' : 'text-orange-600'}`}>
                        {slotName}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">({slotChildren.length}名)</span>
                    </div>
                    {slotChildren.map(({ schedule, hasRecord }) => (
                      <button
                        key={schedule.id}
                        onClick={() => setViewState({ type: 'usage-form', schedule })}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-all text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-[#00c4cc]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-[#00c4cc]">{getInitials(schedule.childName)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-gray-800 truncate">{schedule.childName}</p>
                        </div>
                        <StatusBadge hasRecord={hasRecord} hasContact={false} isSigned={false} mode="usage" />
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==== 実績記録フォーム ====
  if (viewState.type === 'usage-form') {
    const { schedule } = viewState;
    const existingRecord = getUsageRecordByScheduleId(schedule.id);

    return (
      <div className="space-y-0">
        <SignDialog />

        {/* 戻るボタン */}
        <div className="bg-white rounded-t-xl shadow-sm border border-gray-100 border-b-0 px-5 py-3">
          <button
            onClick={() => setViewState({ type: 'usage-list', date: schedule.date })}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{formatDate(schedule.date)} の実績一覧に戻る</span>
          </button>
        </div>

        <div className="bg-white rounded-b-xl shadow-sm border border-gray-100 overflow-hidden">
          <UsageRecordForm
            scheduleItem={schedule}
            initialData={existingRecord}
            onSave={handleSaveUsageRecord}
            onDelete={handleDeleteUsageRecord}
          />
        </div>
      </div>
    );
  }

  // ==== 連絡帳一覧 ====
  if (viewState.type === 'contact-list') {
    const { date } = viewState;
    const dayInfo = dayStatusMap[date];
    const children = getFilteredChildren(date);
    const daysAgo = getDaysOverdue(date);

    return (
      <div className="space-y-5">
        <SignDialog />

        {/* ヘッダー */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#00c4cc] to-[#00b0b8] px-6 py-4">
            <div className="flex items-center gap-3">
              <button onClick={goToDashboard} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="flex-1">
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  連絡帳
                </h1>
                <p className="text-white/80 text-sm mt-0.5 flex items-center gap-2">
                  {formatDateFull(date)}
                  {daysAgo > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      daysAgo >= 2 ? 'bg-red-500/80 text-white' : 'bg-amber-500/80 text-white'
                    }`}>
                      {daysAgo}日前
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right text-white">
                <div className="text-[11px] opacity-80">記入 / 署名</div>
                <div className="text-xl font-bold">
                  {dayInfo?.contactCompleted || 0} / {dayInfo?.contactSigned || 0}
                </div>
              </div>
            </div>
          </div>

          {/* フィルター */}
          <div className="flex gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50 flex-wrap">
            {([
              { key: 'all' as FilterType, label: '全員' },
              { key: 'contact-incomplete' as FilterType, label: '未記入のみ' },
              { key: 'all-complete' as FilterType, label: '記入済みのみ' },
            ]).map(f => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterType === f.key
                    ? 'bg-[#00c4cc] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 児童一覧 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {!dayInfo || dayInfo.total === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>この日の利用予約はありません</p>
            </div>
          ) : children.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-300" />
              <p className="text-sm">条件に該当する児童はいません</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {['AM', 'PM'].map(slot => {
                const slotChildren = children.filter(c => c.schedule.slot === slot);
                if (slotChildren.length === 0) return null;
                const slotName = slot === 'AM' ? slotInfo.AM.name : (slotInfo.PM?.name || '午後');

                return (
                  <div key={slot}>
                    <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100">
                      <span className={`text-xs font-bold ${slot === 'AM' ? 'text-blue-600' : 'text-orange-600'}`}>
                        {slotName}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">({slotChildren.length}名)</span>
                    </div>
                    {slotChildren.map(({ schedule, hasContact, isSigned, contactLog }) => (
                      <div
                        key={schedule.id}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-all"
                      >
                        <div className="w-9 h-9 rounded-full bg-[#00c4cc]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-[#00c4cc]">{getInitials(schedule.childName)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-gray-800 truncate">{schedule.childName}</p>
                          {isSigned && contactLog?.signatureData && (
                            <p className="text-[11px] text-emerald-600">
                              署名: {contactLog.signatureData} ({contactLog.signedAt ? new Date(contactLog.signedAt).toLocaleDateString('ja-JP') : ''})
                            </p>
                          )}
                        </div>
                        <StatusBadge hasRecord={false} hasContact={hasContact} isSigned={isSigned} mode="contact" contactStatus={contactLog?.status} />
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              initContactForm(schedule);
                              setViewState({ type: 'contact-form', schedule });
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-[#00c4cc] bg-[#00c4cc]/10 hover:bg-[#00c4cc]/20 rounded-lg transition-colors"
                          >
                            {hasContact ? '編集' : '記入'}
                          </button>
                          {hasContact && !isSigned && (
                            <button
                              onClick={() => handleSign(schedule.id)}
                              className="px-3 py-1.5 text-xs font-bold text-white bg-[#00c4cc] hover:bg-[#00b0b8] rounded-lg transition-colors flex items-center gap-1"
                            >
                              <PenLine className="w-3 h-3" />
                              署名
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==== 連絡帳フォーム ====
  if (viewState.type === 'contact-form') {
    const { schedule } = viewState;
    const existingContactLog = getContactLogByScheduleId(schedule.id);

    return (
      <div className="space-y-0">
        <SignDialog />

        {/* 戻るボタン + ヘッダー */}
        <div className="bg-white rounded-t-xl shadow-sm border border-gray-100 border-b-0 px-5 py-3">
          <button
            onClick={() => setViewState({ type: 'contact-list', date: schedule.date })}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{formatDate(schedule.date)} の連絡帳一覧に戻る</span>
          </button>
        </div>

        <div className="bg-white rounded-b-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* 児童情報ヘッダー */}
          <div className="bg-gradient-to-r from-[#00c4cc]/10 to-white px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00c4cc]/15 flex items-center justify-center">
                <span className="text-base font-bold text-[#00c4cc]">{getInitials(schedule.childName)}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">{schedule.childName}</h3>
                <p className="text-sm text-gray-500">
                  {formatDateFull(schedule.date)}{' '}
                  {schedule.slot === 'AM' ? slotInfo.AM.name : (slotInfo.PM?.name || '午後')}
                </p>
              </div>
              {existingContactLog && (
                <span className={`ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                  existingContactLog.status === 'signed' || existingContactLog.isSigned
                    ? 'bg-emerald-100 text-emerald-700'
                    : existingContactLog.status === 'submitted'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {existingContactLog.status === 'signed' || existingContactLog.isSigned ? (
                    <><CheckCircle className="w-3.5 h-3.5" /> 署名済み</>
                  ) : existingContactLog.status === 'submitted' ? (
                    <><Send className="w-3.5 h-3.5" /> 送信済み・署名待ち</>
                  ) : (
                    <><PenLine className="w-3.5 h-3.5" /> 下書き</>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* 連絡帳フォーム本体 */}
          <div className="p-6 space-y-6">
            {/* 今日の活動 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#00c4cc]" />
                今日の活動内容
              </label>
              <textarea
                value={contactFormData.activities || ''}
                onChange={(e) => setContactFormData({ ...contactFormData, activities: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-[13px]"
                placeholder="今日行った活動を記入してください"
              />
            </div>

            {/* 体調・機嫌・食欲 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 体調 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-400" />
                  体調
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(HEALTH_LABELS).map(([key, { label, color }]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setContactFormData({ ...contactFormData, healthStatus: key as ContactLog['healthStatus'] })}
                      className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                        contactFormData.healthStatus === key
                          ? `${color} border-current`
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 機嫌 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Smile className="w-4 h-4 text-yellow-500" />
                  機嫌
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(MOOD_LABELS).map(([key, { label, emoji, color }]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setContactFormData({ ...contactFormData, mood: key as ContactLog['mood'] })}
                      className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                        contactFormData.mood === key
                          ? `${color} border-current`
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {emoji} {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 食欲 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-orange-400" />
                  食欲
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(APPETITE_LABELS).map(([key, { label, color }]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setContactFormData({ ...contactFormData, appetite: key as ContactLog['appetite'] })}
                      className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                        contactFormData.appetite === key
                          ? `${color} border-current`
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 食事 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-orange-400" />
                食事
              </label>
              <div className="flex items-center gap-4 mb-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={contactFormData.mealMain || false}
                    onChange={(e) => setContactFormData({ ...contactFormData, mealMain: e.target.checked })}
                    className="w-4 h-4 text-[#00c4cc] rounded"
                  />
                  <span className="text-sm text-gray-700">主食</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={contactFormData.mealSide || false}
                    onChange={(e) => setContactFormData({ ...contactFormData, mealSide: e.target.checked })}
                    className="w-4 h-4 text-[#00c4cc] rounded"
                  />
                  <span className="text-sm text-gray-700">副食</span>
                </label>
              </div>
              <input
                type="text"
                value={contactFormData.mealNotes || ''}
                onChange={(e) => setContactFormData({ ...contactFormData, mealNotes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-[13px]"
                placeholder="食事に関するメモ"
              />
            </div>

            {/* 排泄・睡眠 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 排泄 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-blue-400" />
                  排泄
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-600">トイレ回数:</span>
                  <input
                    type="number"
                    min={0}
                    value={contactFormData.toiletCount || 0}
                    onChange={(e) => setContactFormData({ ...contactFormData, toiletCount: parseInt(e.target.value) || 0 })}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-[13px]"
                  />
                  <span className="text-sm text-gray-600">回</span>
                </div>
                <input
                  type="text"
                  value={contactFormData.toiletNotes || ''}
                  onChange={(e) => setContactFormData({ ...contactFormData, toiletNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-[13px]"
                  placeholder="排泄に関するメモ"
                />
              </div>

              {/* 睡眠 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  お昼寝
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="time"
                    value={contactFormData.napStartTime || ''}
                    onChange={(e) => setContactFormData({ ...contactFormData, napStartTime: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-[13px]"
                  />
                  <span className="text-gray-500">~</span>
                  <input
                    type="time"
                    value={contactFormData.napEndTime || ''}
                    onChange={(e) => setContactFormData({ ...contactFormData, napEndTime: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-[13px]"
                  />
                </div>
                <input
                  type="text"
                  value={contactFormData.napNotes || ''}
                  onChange={(e) => setContactFormData({ ...contactFormData, napNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-[13px]"
                  placeholder="睡眠に関するメモ"
                />
              </div>
            </div>

            {/* スタッフからのコメント */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#00c4cc]" />
                スタッフからのコメント
              </label>
              <textarea
                value={contactFormData.staffComment || ''}
                onChange={(e) => setContactFormData({ ...contactFormData, staffComment: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-[13px]"
                placeholder="今日の様子やエピソードなど"
              />
            </div>

            {/* 保護者への連絡事項 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                保護者への連絡事項
              </label>
              <textarea
                value={contactFormData.parentMessage || ''}
                onChange={(e) => setContactFormData({ ...contactFormData, parentMessage: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-[13px]"
                placeholder="持ち物のお願いなど"
              />
            </div>

            {/* 保護者からの返信（既存の場合） */}
            {existingContactLog?.parentReply && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <label className="block text-sm font-bold text-purple-700 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  保護者からの返信
                </label>
                <p className="text-[13px] text-purple-800 whitespace-pre-wrap">{existingContactLog.parentReply}</p>
                {existingContactLog.parentReplyAt && (
                  <p className="text-[11px] text-purple-500 mt-2">
                    {new Date(existingContactLog.parentReplyAt).toLocaleString('ja-JP')}
                  </p>
                )}
              </div>
            )}

            {/* 署名状態表示 */}
            {existingContactLog?.isSigned && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-800">保護者署名済み</span>
                </div>
                {existingContactLog.signatureData && (
                  <p className="text-[13px] text-emerald-700 mt-1">
                    署名者: {existingContactLog.signatureData}
                  </p>
                )}
                {existingContactLog.signedAt && (
                  <p className="text-[11px] text-emerald-500 mt-1">
                    署名日時: {new Date(existingContactLog.signedAt).toLocaleString('ja-JP')}
                  </p>
                )}
              </div>
            )}

            {/* ステータスとボタン */}
            <div className="pt-4 border-t border-gray-200 space-y-3">
              {/* Status indicator for submitted/signed */}
              {existingContactLog?.status === 'submitted' && !existingContactLog.isSigned && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">送信済み・署名待ち</span>
                </div>
              )}

              {existingContactLog?.status === 'signed' && existingContactLog.signedAt && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">
                    署名済み - {existingContactLog.parentSignerName || existingContactLog.signatureData || ''}{' '}
                    ({new Date(existingContactLog.signedAt).toLocaleString('ja-JP')})
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1" />
                {/* 下書き保存 */}
                <button
                  onClick={() => handleSaveContactLog('draft')}
                  disabled={isSaving || existingContactLog?.status === 'signed'}
                  className="flex items-center gap-2 px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 font-bold rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  下書き保存
                </button>
                {/* 保護者に送信 */}
                <button
                  onClick={() => {
                    if (confirm('この連絡帳を保護者に送信しますか？送信後、保護者の署名が必要になります。')) {
                      handleSaveContactLog('submit');
                    }
                  }}
                  disabled={isSaving || existingContactLog?.status === 'signed'}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  保護者に送信
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // フォールバック
  return null;
}
