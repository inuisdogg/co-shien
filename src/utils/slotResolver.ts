/**
 * 時間枠リゾルバ
 * 施設設定のfacility_time_slotsを正規化し、全コンポーネントで統一的に使用する
 */

import type { FacilityTimeSlot, ResolvedSlotInfo } from '@/types';

// AM/PM フォールバック（facility_time_slots未設定の施設向け）
const DEFAULT_SLOTS: ResolvedSlotInfo[] = [
  { key: 'AM', name: '午前', startTime: '09:00', endTime: '12:00', capacity: 10, displayOrder: 1 },
  { key: 'PM', name: '午後', startTime: '13:00', endTime: '18:00', capacity: 10, displayOrder: 2 },
];

/**
 * facility_time_slotsをResolvedSlotInfo[]に変換
 * 未設定の場合はAM/PMデフォルトを返す
 */
export function resolveTimeSlots(
  timeSlots: FacilityTimeSlot[],
  facilitySettings?: { capacity?: Record<string, number> }
): ResolvedSlotInfo[] {
  if (!timeSlots || timeSlots.length === 0) {
    // facilitySettingsのcapacityがあればデフォルトスロットに反映
    if (facilitySettings?.capacity) {
      return DEFAULT_SLOTS.map(s => ({
        ...s,
        capacity: facilitySettings.capacity?.[s.key]
          || facilitySettings.capacity?.[s.key.toLowerCase()]
          || s.capacity,
      }));
    }
    return DEFAULT_SLOTS;
  }

  const sorted = [...timeSlots].sort((a, b) => a.displayOrder - b.displayOrder);
  return sorted.map(slot => ({
    key: slot.name,
    name: slot.name,
    startTime: slot.startTime,
    endTime: slot.endTime,
    capacity: slot.capacity,
    displayOrder: slot.displayOrder,
  }));
}

/**
 * スロットキーから表示名を取得
 */
export function slotDisplayName(slots: ResolvedSlotInfo[], key: string): string {
  const slot = slots.find(s => s.key === key);
  if (slot) return slot.name;
  // レガシーAM/PMのフォールバック
  if (key === 'AM') return '午前';
  if (key === 'PM') return '午後';
  return key;
}

/**
 * スロットキーから定員を取得
 */
export function slotCapacity(slots: ResolvedSlotInfo[], key: string): number {
  return slots.find(s => s.key === key)?.capacity ?? 0;
}

/**
 * スロットリストからRecord<string, number>の定員マップを構築
 */
export function buildCapacityMap(slots: ResolvedSlotInfo[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const slot of slots) {
    map[slot.key] = slot.capacity;
  }
  return map;
}

/**
 * 'AMPM' や 'ALL' などの全スロット指定を個別スロットキーに展開
 */
export function expandSlotKeys(slots: ResolvedSlotInfo[], slotValue: string): string[] {
  if (slotValue === 'AMPM' || slotValue === 'ALL' || slotValue === '終日') {
    return slots.map(s => s.key);
  }
  return [slotValue];
}
