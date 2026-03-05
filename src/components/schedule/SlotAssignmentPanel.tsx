/**
 * スロット割り当てパネル
 * 日付クリック時に開くモーダル
 * カードグリッド＋送迎グループ表示
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { X, Plus, Trash2, Calendar, AlertTriangle, Users, Zap } from 'lucide-react';
import { TimeSlot, ScheduleItem, Child, UsageRecord, ResolvedSlotInfo, TransportVehicle } from '@/types';
import ChildPickerPopup, { SelectedChildWithTransport } from './ChildPickerPopup';
import { calculateAgeWithMonths } from '@/utils/ageCalculation';
import { useToast } from '@/components/ui/Toast';
import { resolveTimeSlots, slotDisplayName, expandSlotKeys } from '@/utils/slotResolver';
import ConfirmModal from '@/components/common/ConfirmModal';

// レガシー時間枠情報の型（後方互換性のため維持）
interface LegacySlotInfoType {
  AM: { name: string; startTime: string; endTime: string };
  PM: { name: string; startTime: string; endTime: string } | null;
}

interface SlotAssignmentPanelProps {
  date: string;
  schedules: ScheduleItem[];
  childList: Child[];
  capacity: Record<string, number>;
  slotInfo?: LegacySlotInfoType;
  resolvedSlots?: ResolvedSlotInfo[];
  transportCapacity?: { pickup: number; dropoff: number };
  transportVehicles?: TransportVehicle[];
  onClose: () => void;
  onAddSchedule: (data: {
    date: string;
    childId: string;
    childName: string;
    slot: TimeSlot;
    hasPickup: boolean;
    hasDropoff: boolean;
    pickupMethod?: string | null;
    dropoffMethod?: string | null;
  }) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
  onMoveSchedule: (id: string, newSlot: TimeSlot) => Promise<void>;
  onUpdateTransport?: (id: string, hasPickup: boolean, hasDropoff: boolean, pickupMethod?: string | null, dropoffMethod?: string | null) => Promise<void>;
  getUsageRecordByScheduleId: (scheduleId: string) => UsageRecord | undefined;
  onScheduleItemClick: (item: ScheduleItem) => void;
  onBulkRegisterDay?: (date: string) => Promise<{ added: number; skipped: number }>;
}

// 送迎方法の表示名を取得
function getTransportLabel(method: string | null | undefined, vehicles: TransportVehicle[]): string {
  if (!method) return '';
  if (method === 'walk') return '徒歩';
  const vehicle = vehicles.find(v => v.id === method);
  return vehicle ? vehicle.name : method;
}

// 送迎バッジの短縮表示
function getTransportBadge(method: string | null | undefined, vehicles: TransportVehicle[]): string {
  if (!method) return '';
  if (method === 'walk') return '🚶';
  const vehicle = vehicles.find(v => v.id === method);
  if (vehicle) {
    // "1号車" → "🚐1"
    const match = vehicle.name.match(/(\d+)/);
    return match ? `🚐${match[1]}` : '🚐';
  }
  return '🚐';
}

// 送迎方法のサイクル切替（なし→徒歩→vehicle-1→vehicle-2→...→なし）
function cycleTransportMethod(current: string | null | undefined, vehicles: TransportVehicle[]): string | null {
  const options: (string | null)[] = [null, 'walk', ...vehicles.map(v => v.id)];
  const currentIdx = options.indexOf(current || null);
  const nextIdx = (currentIdx + 1) % options.length;
  return options[nextIdx];
}

// 送迎グループの決定（pickup_method優先で分類）
function getTransportGroup(schedule: ScheduleItem): string {
  // pickupMethodが設定されている場合はそれを使う
  if (schedule.pickupMethod) return schedule.pickupMethod;
  // 後方互換: has_pickup=true but no method → 'legacy-pickup'
  if (schedule.hasPickup) return 'legacy-pickup';
  return 'none';
}

export default function SlotAssignmentPanel({
  date,
  schedules,
  childList,
  capacity,
  slotInfo,
  resolvedSlots: resolvedSlotsProp,
  transportCapacity = { pickup: 3, dropoff: 3 },
  transportVehicles = [],
  onClose,
  onAddSchedule,
  onDeleteSchedule,
  onMoveSchedule,
  onUpdateTransport,
  getUsageRecordByScheduleId,
  onScheduleItemClick,
  onBulkRegisterDay,
}: SlotAssignmentPanelProps) {
  const { toast } = useToast();
  const [pickerSlot, setPickerSlot] = useState<TimeSlot | null>(null);
  const [processing, setProcessing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // 動的スロット解決
  const slots: ResolvedSlotInfo[] = useMemo(() => {
    if (resolvedSlotsProp && resolvedSlotsProp.length > 0) {
      return resolvedSlotsProp;
    }
    const legacySlots: ResolvedSlotInfo[] = [];
    if (slotInfo) {
      legacySlots.push({
        key: 'AM',
        name: slotInfo.AM.name,
        startTime: slotInfo.AM.startTime,
        endTime: slotInfo.AM.endTime,
        capacity: capacity['AM'] ?? 10,
        displayOrder: 1,
      });
      if (slotInfo.PM) {
        legacySlots.push({
          key: 'PM',
          name: slotInfo.PM.name,
          startTime: slotInfo.PM.startTime,
          endTime: slotInfo.PM.endTime,
          capacity: capacity['PM'] ?? 10,
          displayOrder: 2,
        });
      }
    } else {
      return resolveTimeSlots([], { capacity: capacity as Record<string, number> });
    }
    return legacySlots;
  }, [resolvedSlotsProp, slotInfo, capacity]);

  // 日付情報
  const dateInfo = useMemo(() => {
    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    return { year, month, day, dayOfWeek, dayName: dayNames[dayOfWeek], isWeekend: dayOfWeek === 0 || dayOfWeek === 6 };
  }, [date]);

  // スロット別スケジュール
  const schedulesBySlot = useMemo(() => {
    const daySchedules = schedules.filter(s => s.date === date);
    const grouped: Record<string, ScheduleItem[]> = {};
    for (const slot of slots) {
      grouped[slot.key] = daySchedules.filter(s => s.slot === slot.key);
    }
    return grouped;
  }, [schedules, date, slots]);

  const allDaySchedules = useMemo(() => Object.values(schedulesBySlot).flat(), [schedulesBySlot]);
  const registeredChildIds = useMemo(() => allDaySchedules.map(s => s.childId), [allDaySchedules]);

  // パターン一致判定
  const isPatternMatch = useCallback((child: Child, slot: TimeSlot) => {
    if (!child.patternDays?.includes(dateInfo.dayOfWeek)) return false;
    const timeSlot = child.patternTimeSlots?.[dateInfo.dayOfWeek];
    return timeSlot === slot || timeSlot === 'AMPM' || timeSlot === 'ALL';
  }, [dateInfo.dayOfWeek]);

  // 児童追加
  const handleAddChildrenWithTransport = async (children: SelectedChildWithTransport[], slot: TimeSlot) => {
    setProcessing(true);
    try {
      for (const item of children) {
        const child = childList.find(c => c.id === item.childId);
        if (!child) continue;
        await onAddSchedule({
          date,
          childId: child.id,
          childName: child.name,
          slot,
          hasPickup: item.hasPickup || !!item.pickupMethod,
          hasDropoff: item.hasDropoff || !!item.dropoffMethod,
          pickupMethod: item.pickupMethod,
          dropoffMethod: item.dropoffMethod,
        });
      }
      toast.success(`${children.length}名を登録しました`);
    } catch {
      toast.error('登録に失敗しました。もう一度お試しください。');
    } finally {
      setProcessing(false);
      setPickerSlot(null);
    }
  };

  // 児童削除
  const handleRemoveChild = (scheduleId: string) => {
    setConfirmModal({
      isOpen: true,
      title: '予約の削除',
      message: 'この児童の予約を削除しますか？',
      confirmLabel: '削除',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setProcessing(true);
        try {
          await onDeleteSchedule(scheduleId);
          toast.success('予約を削除しました');
        } catch (err) {
          console.error('Error deleting schedule:', err);
          toast.error('削除に失敗しました。もう一度お試しください。');
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  // 送迎バッジサイクルクリック
  const handleCycleTransport = async (schedule: ScheduleItem, field: 'pickup' | 'dropoff') => {
    if (!onUpdateTransport) return;
    setProcessing(true);
    try {
      if (field === 'pickup') {
        const newMethod = cycleTransportMethod(schedule.pickupMethod, transportVehicles);
        await onUpdateTransport(
          schedule.id,
          !!newMethod,
          schedule.hasDropoff,
          newMethod,
          undefined,
        );
      } else {
        const newMethod = cycleTransportMethod(schedule.dropoffMethod, transportVehicles);
        await onUpdateTransport(
          schedule.id,
          schedule.hasPickup,
          !!newMethod,
          undefined,
          newMethod,
        );
      }
    } catch (err) {
      console.error('Error updating transport:', err);
      toast.error('送迎情報の更新に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  // パターン一括登録
  const handleBulkRegister = async () => {
    if (!onBulkRegisterDay) return;
    setProcessing(true);
    try {
      const result = await onBulkRegisterDay(date);
      toast.success(`${result.added}名を一括登録しました（スキップ: ${result.skipped}名）`);
    } catch {
      toast.error('一括登録に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  // この日をリセット
  const handleResetDay = () => {
    const schedulesWithoutRecord = allDaySchedules.filter(s => !getUsageRecordByScheduleId(s.id));
    if (schedulesWithoutRecord.length === 0) {
      toast.warning('削除可能な予約がありません（実績登録済みの予約は削除できません）');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'この日の予約をリセット',
      message: `この日の予約${schedulesWithoutRecord.length}件を削除しますか？\n※実績登録済みの予約は除外されます`,
      confirmLabel: '削除',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setProcessing(true);
        try {
          for (const s of schedulesWithoutRecord) {
            await onDeleteSchedule(s.id);
          }
          toast.success(`${schedulesWithoutRecord.length}件の予約を削除しました`);
        } catch (err) {
          console.error('Error resetting day:', err);
          toast.error('リセットに失敗しました。もう一度お試しください。');
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  // スロットカラー
  const slotColors = useMemo(() => {
    const palettes = [
      { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', headerBg: 'bg-blue-100' },
      { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', headerBg: 'bg-orange-100' },
      { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', headerBg: 'bg-green-100' },
      { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', headerBg: 'bg-purple-100' },
    ];
    const map: Record<string, typeof palettes[0]> = {};
    slots.forEach((s, i) => { map[s.key] = palettes[i % palettes.length]; });
    return map;
  }, [slots]);

  // 送迎グループ別にスケジュールを分類
  const groupSchedulesByTransport = useCallback((slotSchedules: ScheduleItem[]) => {
    const groups: { key: string; label: string; icon: string; schedules: ScheduleItem[] }[] = [];

    // 車両ごと
    for (const vehicle of transportVehicles) {
      const vehicleSchedules = slotSchedules.filter(s => s.pickupMethod === vehicle.id || s.dropoffMethod === vehicle.id);
      if (vehicleSchedules.length > 0) {
        groups.push({
          key: vehicle.id,
          label: `${vehicle.name}`,
          icon: '🚐',
          schedules: vehicleSchedules,
        });
      }
    }

    // 徒歩
    const walkSchedules = slotSchedules.filter(s =>
      (s.pickupMethod === 'walk' || s.dropoffMethod === 'walk') &&
      !transportVehicles.some(v => s.pickupMethod === v.id || s.dropoffMethod === v.id)
    );
    if (walkSchedules.length > 0) {
      groups.push({ key: 'walk', label: '徒歩', icon: '🚶', schedules: walkSchedules });
    }

    // 保護者送迎（methodなし）
    const alreadyGrouped = new Set(groups.flatMap(g => g.schedules.map(s => s.id)));
    const noneSchedules = slotSchedules.filter(s => !alreadyGrouped.has(s.id));
    if (noneSchedules.length > 0) {
      groups.push({ key: 'none', label: '保護者送迎', icon: '👤', schedules: noneSchedules });
    }

    return groups;
  }, [transportVehicles]);

  // カード描画
  const renderChildCard = (schedule: ScheduleItem, slotKey: TimeSlot) => {
    const child = childList.find(c => c.id === schedule.childId);
    if (!child) return null;

    const hasRecord = !!getUsageRecordByScheduleId(schedule.id);
    const patternMatch = isPatternMatch(child, slotKey);
    const ageDisplay = child.birthDate
      ? calculateAgeWithMonths(child.birthDate).display
      : child.age ? `${child.age}歳` : null;

    const pickupBadge = getTransportBadge(schedule.pickupMethod, transportVehicles);
    const dropoffBadge = getTransportBadge(schedule.dropoffMethod, transportVehicles);

    return (
      <div
        key={schedule.id}
        className={`group relative bg-white border rounded-xl p-3 transition-all hover:shadow-md ${
          hasRecord ? 'border-green-300 bg-green-50/30' : 'border-gray-200 hover:border-primary/40'
        }`}
      >
        {/* 削除ボタン（ホバーで表示） */}
        {!hasRecord && (
          <button
            onClick={() => handleRemoveChild(schedule.id)}
            disabled={processing}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm text-xs disabled:opacity-50"
            title="削除"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* 児童名（クリックでdetailへ） */}
        <button
          onClick={() => onScheduleItemClick(schedule)}
          className="w-full text-left"
        >
          <p className="text-sm font-bold text-gray-800 truncate">{child.name}</p>
          {ageDisplay && (
            <p className="text-[11px] text-gray-400 mt-0.5">{ageDisplay}</p>
          )}
        </button>

        {/* バッジ行 */}
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {patternMatch && (
            <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded font-medium">
              パターン
            </span>
          )}
          {hasRecord && (
            <span className="text-[9px] bg-green-100 text-green-700 px-1 py-0.5 rounded font-medium">
              実績済
            </span>
          )}
        </div>

        {/* 送迎バッジ */}
        <div className="flex items-center gap-1 mt-1.5">
          <button
            onClick={() => !hasRecord && handleCycleTransport(schedule, 'pickup')}
            disabled={hasRecord || processing}
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
              schedule.pickupMethod
                ? 'bg-teal-100 text-teal-700'
                : schedule.hasPickup
                  ? 'bg-teal-500 text-white'
                  : 'bg-gray-100 text-gray-400'
            } ${!hasRecord ? 'cursor-pointer hover:ring-1 hover:ring-teal-300' : 'cursor-default'}`}
            title="迎え（タップで切替）"
          >
            迎{pickupBadge || (schedule.hasPickup ? '✓' : '—')}
          </button>
          <button
            onClick={() => !hasRecord && handleCycleTransport(schedule, 'dropoff')}
            disabled={hasRecord || processing}
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
              schedule.dropoffMethod
                ? 'bg-teal-100 text-teal-700'
                : schedule.hasDropoff
                  ? 'bg-teal-500 text-white'
                  : 'bg-gray-100 text-gray-400'
            } ${!hasRecord ? 'cursor-pointer hover:ring-1 hover:ring-teal-300' : 'cursor-default'}`}
            title="送り（タップで切替）"
          >
            送{dropoffBadge || (schedule.hasDropoff ? '✓' : '—')}
          </button>
        </div>
      </div>
    );
  };

  // スロットセクション
  const renderSlotSection = (slot: TimeSlot) => {
    const slotSchedules = schedulesBySlot[slot] || [];
    const slotInfoResolved = slots.find(s => s.key === slot);
    const slotCap = slotInfoResolved?.capacity ?? capacity[slot] ?? 0;
    const remaining = slotCap - slotSchedules.length;
    const isFull = remaining <= 0;
    const colors = slotColors[slot] || { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', headerBg: 'bg-gray-100' };

    const groups = transportVehicles.length > 0
      ? groupSchedulesByTransport(slotSchedules)
      : [{ key: 'all', label: '', icon: '', schedules: slotSchedules }];

    return (
      <div key={slot} className={`border rounded-lg overflow-hidden ${colors.border}`}>
        {/* スロットヘッダー */}
        <div className={`px-3 py-2 flex items-center justify-between ${colors.headerBg}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className={`font-bold text-sm ${colors.text}`}>
              {slotDisplayName(slots, slot)}
            </h3>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-gray-500" />
              <span className={`text-xs font-medium ${isFull ? 'text-red-600' : 'text-gray-600'}`}>
                {slotSchedules.length}/{slotCap}
              </span>
              {remaining > 0 && (
                <span className="text-xs text-gray-400">残{remaining}</span>
              )}
            </div>
          </div>

          {!isFull && (
            <button
              onClick={() => setPickerSlot(slot)}
              disabled={processing}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-primary hover:bg-primary-dark rounded transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              追加
            </button>
          )}
        </div>

        {/* カードグリッド */}
        <div className="bg-white p-3">
          {slotSchedules.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              児童が登録されていません
            </div>
          ) : transportVehicles.length > 0 ? (
            // 送迎グループ別表示
            <div className="space-y-3">
              {groups.map(group => (
                <div key={group.key}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm">{group.icon}</span>
                    <span className="text-xs font-bold text-gray-600">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-gray-400">({group.schedules.length}名)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {group.schedules.map(s => renderChildCard(s, slot))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // グループなし（車両未設定時）
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {slotSchedules.map(s => renderChildCard(s, slot))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 lg:p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[95vh] lg:max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        {/* ヘッダー */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-primary to-primary-dark">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-white" />
            <h2 className="text-lg font-bold text-white">
              {dateInfo.year}年{dateInfo.month}月{dateInfo.day}日
              <span className={`ml-2 text-sm font-normal ${dateInfo.isWeekend ? 'text-yellow-200' : 'text-white/90'}`}>
                ({dateInfo.dayName})
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onBulkRegisterDay && (
              <button
                onClick={handleBulkRegister}
                disabled={processing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                パターン一括
              </button>
            )}
            <button
              onClick={handleResetDay}
              disabled={processing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              リセット
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3">
          {slots.map(s => renderSlotSection(s.key))}
        </div>

        {/* フッター */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            登録済み: <span className="font-bold text-gray-800">{registeredChildIds.length}名</span>
            <span className="text-xs text-gray-500 ml-2">
              （{slots.map(s => `${slotDisplayName(slots, s.key)}${(schedulesBySlot[s.key] || []).length}`).join(' / ')}）
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors shadow-sm"
          >
            閉じる
          </button>
        </div>
      </div>

      {/* 児童選択ポップアップ */}
      <ChildPickerPopup
        isOpen={!!pickerSlot}
        onClose={() => setPickerSlot(null)}
        childList={childList}
        targetSlot={pickerSlot || slots[0]?.key || 'AM'}
        date={date}
        resolvedSlots={slots}
        transportVehicles={transportVehicles}
        alreadyRegisteredIds={
          pickerSlot
            ? (schedulesBySlot[pickerSlot] || []).map(s => s.childId)
            : []
        }
        onSelect={(childIds) => handleAddChildrenWithTransport(
          childIds.map(id => {
            const child = childList.find(c => c.id === id);
            const tp = child?.transportPattern?.[dateInfo.dayOfWeek];
            return {
              childId: id,
              hasPickup: child?.needsPickup || !!tp?.pickup,
              hasDropoff: child?.needsDropoff || !!tp?.dropoff,
              pickupMethod: tp?.pickup || null,
              dropoffMethod: tp?.dropoff || null,
            };
          }),
          pickerSlot!
        )}
        onSelectWithTransport={(children) => handleAddChildrenWithTransport(children, pickerSlot!)}
      />

      {/* 確認モーダル */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel="キャンセル"
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* 処理中オーバーレイ */}
      {processing && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg px-6 py-4 shadow-lg">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm text-gray-600">処理中...</p>
          </div>
        </div>
      )}
    </div>
  );
}
